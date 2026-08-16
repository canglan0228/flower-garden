/*
 * 从 Wikimedia Commons 为每朵花抓取真实照片并本地化。
 * 优先按学名搜索，其次英文名、中文名；下载后若有 sharp 则压缩为 WebP。
 * 可断点续跑：已有图片且元数据完整的条目会跳过。
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = path.join(ROOT, 'seed', 'flowers.tsv');
const IMG_DIR = path.join(ROOT, 'images');
const DATA_DIR = path.join(ROOT, 'data');
const META_FILE = path.join(DATA_DIR, 'image-meta.json');
const MISSING_FILE = path.join(DATA_DIR, 'missing.json');
const UA = 'FlowerGardenBot/1.0 (personal static flower website; contact: none)';

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(IMG_DIR, { recursive: true });

function parseSeed() {
  const lines = readFileSync(SEED, 'utf8').split(/\r?\n/);
  const rows = [];
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 9) continue;
    if (parts[0].trim() === 'name') continue;
    const [name, en, latin, family, colors, aliases, meaning, season, blurb] = parts;
    rows.push({
      name: name.trim(),
      en: (en || '').trim(),
      latin: (latin || '').trim(),
      family: (family || '').trim(),
      colors: (colors || '').split('、').map((s) => s.trim()).filter(Boolean),
      aliases: (aliases || '').split('、').map((s) => s.trim()).filter(Boolean),
      meaning: (meaning || '').trim(),
      season: (season || '').trim(),
      blurb: (blurb || '').trim()
    });
  }
  return rows;
}

function slugify(latin) {
  return String(latin || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function curlText(url) {
  const { stdout } = await execFileP('curl.exe', [
    '-s', '-L', '--compressed', '--connect-timeout', '12', '--max-time', '30',
    '--retry', '3', '--retry-delay', '1', '--retry-all-errors', '-A', UA, url
  ], {
    maxBuffer: 16 * 1024 * 1024
  });
  return stdout;
}

async function curlDownload(url, dest) {
  await execFileP('curl.exe', [
    '-4', '-s', '-L', '--compressed', '--connect-timeout', '15', '--max-time', '60',
    '--retry', '4', '--retry-delay', '2', '--retry-all-errors', '-A', UA, '-o', dest, url
  ], {
    maxBuffer: 16 * 1024 * 1024
  });
}

async function verifyImage(dest) {
  const buf = readFileSync(dest);
  const head = buf.subarray(0, 12);
  const isJpeg = head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF;
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47;
  const isWebp = head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP';
  const isGif = head.toString('ascii', 0, 4) === 'GIF8';
  if (!(isJpeg || isPng || isWebp || isGif)) {
    throw new Error('下载内容不是图片（可能被限流返回错误页）');
  }
}

async function searchCommons(query) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '800'
  });
  const url = `https://commons.wikimedia.org/w/api.php?${params}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await curlText(url);
      const data = JSON.parse(text);
      const pages = data.query && data.query.pages ? Object.values(data.query.pages) : [];
      return pages
        .map((p) => {
          const ii = p.imageinfo && p.imageinfo[0];
          if (!ii) return null;
          const em = ii.extmetadata || {};
          return {
            title: p.title,
            mime: ii.mime || '',
            width: ii.width || 0,
            height: ii.height || 0,
            thumbUrl: ii.thumburl || ii.url,
            url: ii.descriptionurl || ii.url,
            artist: stripHtml(em.Artist ? em.Artist.value : ''),
            license: em.LicenseShortName ? em.LicenseShortName.value : '',
            licenseUrl: em.LicenseUrl ? em.LicenseUrl.value : ''
          };
        })
        .filter(Boolean);
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(800 * (attempt + 1));
    }
  }
  return [];
}

const BAD_WORDS = [
  'logo', 'stamp', 'coin', 'banknote', 'flag', 'coat of arms', 'heraldry',
  'drawing', 'painting', 'illustration', 'seal', 'diagram', 'postage',
  'map', 'icon', 'silhouette', 'logo of', 'emblem',
  'erythema', 'nodosum', 'dermatology', 'disease', 'syndrome', 'lesion',
  'anatomy', 'surgery', 'histolog', 'patholog', 'bacteri', 'virus',
  'micrograph', 'microscope', 'insect', 'larva', 'caterpillar', 'fossil',
  'skeleton', 'x-ray', 'radiograph', 'ultrasound', 'chart', 'graph',
  'herbarium', 'stamp of', 'banknote of', 'coat of arms of', 'emblem of',
  'drawing of', 'painting of', 'illustration of', 'symbol of'
];

function scoreCandidate(c, query) {
  const title = c.title.toLowerCase();
  if (!['image/jpeg', 'image/png'].includes(c.mime)) return -1;
  if (c.width < 600 || c.height < 600) return -1;
  if (BAD_WORDS.some((w) => title.includes(w))) return -1;

  const hasCJK = /[\u4e00-\u9fff]/.test(query);
  let score = 0;

  if (hasCJK) {
    if (!title.includes(query.toLowerCase())) return -1;
    score += 6;
  } else {
    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
    let hit = 0;
    for (const t of tokens) {
      if (title.includes(t)) {
        score += 3;
        hit++;
      }
    }
    if (hit === 0) return -1;
    if (hit === tokens.length) score += 2;
  }

  if (c.mime === 'image/jpeg') score += 1;
  const mp = (c.width * c.height) / 1e6;
  if (mp >= 1 && mp <= 14) score += 1;
  if (mp > 14) score -= 2;
  return score;
}

async function pickBest(query) {
  const candidates = await searchCommons(query);
  const scored = candidates
    .map((c) => ({ c, s: scoreCandidate(c, query) }))
    .filter((x) => x.s >= 0);
  if (!scored.length) return null;
  scored.sort((a, b) => b.s - a.s);
  return scored[0].c;
}

function makeFileWriter(filePath, initial) {
  let data = initial;
  let chain = Promise.resolve();
  return {
    get: () => data,
    update(fn) {
      chain = chain.then(() => {
        data = fn(data);
        writeFileSync(filePath, JSON.stringify(data, null, 2));
      });
      return chain;
    }
  };
}

async function downloadTo(url, dest) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await curlDownload(url, dest);
      await verifyImage(dest);
      return;
    } catch (err) {
      lastErr = err;
      console.log(`[retry] 下载失败重试 ${attempt + 1}/3`);
      await sleep(6000 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function main() {
  const rows = parseSeed();
  let meta = {};
  if (existsSync(META_FILE)) meta = JSON.parse(readFileSync(META_FILE, 'utf8'));
  const metaWriter = makeFileWriter(META_FILE, meta);

  const queue = [];
  for (const row of rows) {
    const slug = slugify(row.latin);
    const m = meta[slug];
    const hasFile = m && existsSync(path.join(IMG_DIR, `${slug}.${m.ext || 'jpg'}`));
    if (hasFile) {
      console.log(`[skip] ${row.name} (${slug})`);
      continue;
    }
    queue.push({ row, slug });
  }
  console.log(`[start] ${queue.length} to fetch / ${rows.length} total`);

  const missing = [];
  let sharp = null;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.log('[info] sharp 不可用，将保留原图');
  }

  const CONCURRENCY = 4;
  const results = new Map();
  let cursor = 0;
  let doneCount = queue.filter((q) => false).length;
  const skippedCount = rows.length - queue.length;

  async function worker() {
    while (cursor < queue.length) {
      const job = queue[cursor++];
      const { row, slug } = job;
    const queries = [
      row.latin,
      `${row.latin} flower`,
      row.en,
      `${row.en} flower`,
      row.name
    ].filter((q) => q && q.length > 1);

    let chosen = null;
    let queryUsed = '';
    for (const q of queries) {
      try {
        chosen = await pickBest(q);
      } catch (err) {
        console.log(`[warn] query failed ${q}: ${err && err.message}`);
      }
      queryUsed = q;
      if (chosen) break;
      await sleep(500);
    }

    if (!chosen) {
      missing.push({ id: slug, name: row.name, latin: row.latin, reason: 'no candidate' });
      console.log(`[MISS] ${row.name}`);
      continue;
    }

    try {
      if (sharp) {
        const dest = path.join(IMG_DIR, `${slug}.webp`);
        const tmp = path.join(IMG_DIR, `${slug}.tmp`);
        await downloadTo(chosen.thumbUrl, tmp);
        await sharp(tmp).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 78 }).toFile(dest);
        results.set(slug, {
          title: chosen.title,
          artist: chosen.artist,
          license: chosen.license,
          licenseUrl: chosen.licenseUrl,
          source: chosen.url,
          queryUsed,
          ext: 'webp'
        });
      } else {
        const dest = path.join(IMG_DIR, `${slug}.jpg`);
        await downloadTo(chosen.thumbUrl, dest);
        results.set(slug, {
          title: chosen.title,
          artist: chosen.artist,
          license: chosen.license,
          licenseUrl: chosen.licenseUrl,
          source: chosen.url,
          queryUsed,
          ext: 'jpg'
        });
      }
      await metaWriter.update((d) => {
        const next = Object.assign({}, d);
        results.forEach((v, k) => { next[k] = v; });
        return next;
      });
      doneCount++;
      console.log(`[OK] ${skippedCount + doneCount}/${rows.length} ${row.name} <- ${chosen.title} (${chosen.license})`);
    } catch (err) {
      missing.push({ id: slug, name: row.name, latin: row.latin, reason: String((err && err.message) || err) });
      console.log(`[ERR] ${row.name}: ${err && err.message}`);
    } finally {
      try { await import('node:fs').then((fs) => fs.promises.unlink(path.join(IMG_DIR, `${slug}.tmp`))); } catch {}
    }
    await sleep(300);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  writeFileSync(MISSING_FILE, JSON.stringify(missing, null, 2));
  console.log(`[done] fetched ${rows.length - missing.length} / ${rows.length}, missing ${missing.length}`);
  if (missing.length) {
    console.log('[missing]', missing.map((m) => `${m.name}(${m.latin})`).join('、'));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/*
 * 混合图源抓取：fpcn.net（快）→ iNaturalist（全）→ GBIF（备）。
 * fpcn 按中文名检索文章取图；iNaturalist 按学名查询分类单元取 CC 照片；
 * 下载后统一压缩为 WebP，输出兼容 data/image-meta.json。
 * 可断点续跑，输出与 Wikimedia 脚本兼容的 data/image-meta.json。
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import readline from 'node:readline';
import { promisify } from 'node:util';
import { ROOT, IMG_DIR, DATA_DIR, META_FILE, MISSING_FILE, parseSeed, slugify, normLatin } from './lib/seed.mjs';

const execFileP = promisify(execFile);
const UA = 'FlowerGardenBot/1.0 (personal static flower website; contact: none)';
const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const PPBC_PYTHON = 'C:/Program Files/WindowsApps/PythonSoftwareFoundation.Python.3.13_3.13.3824.0_x64__qbz5n2kfra8p0/python3.13.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(IMG_DIR, { recursive: true });

async function curlText(url) {
  const { stdout } = await execFileP('curl.exe', [
    '-s', '-L', '--compressed', '--connect-timeout', '12', '--max-time', '30',
    '--retry', '3', '--retry-delay', '1', '--retry-all-errors', '-A', UA, url
  ], { maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

async function curlDownload(url, dest) {
  await execFileP('curl.exe', [
    '-s', '-L', '--compressed', '--connect-timeout', '15', '--max-time', '60',
    '--retry', '3', '--retry-delay', '1', '--retry-all-errors', '-A', UA, '-o', dest, url
  ], { maxBuffer: 16 * 1024 * 1024 });
}

async function ppbcDownload(url, dest) {
  await execFileP('curl.exe', [
    '-s', '-L', '--compressed', '--connect-timeout', '15', '--max-time', '60',
    '--retry', '3', '--retry-delay', '1', '--retry-all-errors',
    '-A', UA_BROWSER, '-H', 'Referer: https://ppbc.iplant.cn/', '-o', dest, url
  ], { maxBuffer: 16 * 1024 * 1024 });
}

async function verifyImage(dest) {
  const buf = readFileSync(dest);
  const head = buf.subarray(0, 12);
  const isJpeg = head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF;
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47;
  const isWebp = head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP';
  if (!(isJpeg || isPng || isWebp)) throw new Error('下载内容不是图片');
}

async function downloadPhoto(url, dest) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await curlDownload(url, dest);
      await verifyImage(dest);
      return;
    } catch (err) {
      lastErr = err;
      await sleep(3000 * (attempt + 1));
    }
  }
  throw lastErr;
}

const LICENSE_PRIORITY = ['cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa'];
const NO_DERIV = ['cc-by-nd', 'cc-by-nc-nd'];

function licenseRank(code) {
  const c = String(code || '').toLowerCase().trim();
  if (NO_DERIV.includes(c)) return -1;
  const idx = LICENSE_PRIORITY.indexOf(c);
  return idx >= 0 ? idx : -1;
}

function licenseUrlFor(code) {
  const c = String(code || '').toLowerCase();
  if (c === 'cc0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (c.startsWith('cc-by')) return `https://creativecommons.org/licenses/${c.slice(3)}/4.0/`;
  return '';
}

function gbifLicense(code) {
  const c = String(code || '').toLowerCase();
  if (c.includes('cc0') || c.includes('publicdomain') || c.includes('pdm')) return 'cc0';
  const m = c.match(/cc-?by(?:-([a-z0-9]+))?/);
  if (!m) return '';
  return m[1] ? `cc-by-${m[1]}` : 'cc-by';
}

async function findTaxon(query) {
  const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&per_page=10`;
  const data = JSON.parse(await curlText(url));
  const results = data.results || [];
  const want = normLatin(query);
  let best = null;
  let bestScore = -1;
  for (const t of results) {
    if (t.is_active === false) continue;
    if (!['species', 'subspecies', 'variety', 'form', 'hybrid'].includes(t.rank)) continue;
    let score = 0;
    const name = normLatin(t.name);
    if (want && name === want) score += 100;
    else if (want && name.startsWith(want)) score += 50;
    else if (want && want.startsWith(name.split(' ')[0])) score += 10;
    if (t.observations_count) score += Math.min(20, t.observations_count / 1000);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

async function findPhotos(taxonId) {
  const url = `https://api.inaturalist.org/v1/observations?taxon_id=${taxonId}&per_page=30&photos=true&order=desc&order_by=created_at`;
  const data = JSON.parse(await curlText(url));
  const obs = data.results || [];
  const photos = [];
  for (const o of obs) {
    for (const p of o.photos || []) {
      const rank = licenseRank(p.license_code);
      if (rank < 0) continue;
      photos.push({
        rank,
        quality: o.quality_grade === 'research' ? 0 : 1,
        url: p.url,
        attribution: p.attribution || '',
        license: p.license_code || '',
        obsId: o.id,
        obsUri: o.uri || ''
      });
    }
  }
  photos.sort((a, b) => a.quality - b.quality || a.rank - b.rank);
  return photos[0] || null;
}

function toLarge(url) {
  return String(url || '').replace(/\/square\./, '/large.').replace(/\/medium\./, '/large.');
}

function toMedium(url) {
  return String(url || '').replace(/\/square\./, '/medium.');
}

async function downloadPick(photo, slug) {
  const destWebp = path.join(IMG_DIR, `${slug}.webp`);
  const tmp = path.join(IMG_DIR, `${slug}.tmp`);
  const sharp = (await import('sharp')).default;
  const candidates = [toLarge(photo.url), toMedium(photo.url), photo.url];
  let lastErr;
  for (const url of candidates) {
    try {
      await downloadPhoto(url, tmp);
      await sharp(tmp).rotate().resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 78 }).toFile(destWebp);
      try { await import('node:fs').then((fs) => fs.promises.unlink(tmp)); } catch {}
      return url;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function gbifFallback(row, slug) {
  const matchUrl = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(row.latin)}`;
  const match = JSON.parse(await curlText(matchUrl));
  if (!match.usageKey) return null;
  const mediaUrl = `https://api.gbif.org/v1/species/${match.usageKey}/media`;
  const media = JSON.parse(await curlText(mediaUrl));
  const candidates = (media.results || [])
    .filter((m) => m.type === 'StillImage')
    .map((m) => {
      let host = '';
      try { host = new URL(m.identifier).hostname; } catch {}
      return Object.assign({}, m, { host, license: gbifLicense(m.license) });
    })
    .filter((m) => ['inaturalist-open-data.s3.amazonaws.com', 'static.inaturalist.org'].includes(m.host))
    .filter((m) => licenseRank(m.license) >= 0)
    .sort((a, b) => licenseRank(a.license) - licenseRank(b.license));
  if (!candidates.length) return null;
  const c = candidates[0];
  const sharp = (await import('sharp')).default;
  const destWebp = path.join(IMG_DIR, `${slug}.webp`);
  const tmp = path.join(IMG_DIR, `${slug}.tmp`);
  try {
    await downloadPhoto(c.identifier, tmp);
    await sharp(tmp).rotate().resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 78 }).toFile(destWebp);
    try { await import('node:fs').then((fs) => fs.promises.unlink(tmp)); } catch {}
  } catch {
    try { await import('node:fs').then((fs) => fs.promises.unlink(tmp)); } catch {}
    return null;
  }
  return {
    url: c.identifier,
    license: c.license || '',
    attribution: c.creator || '',
    title: c.title || row.latin,
    obsUri: c.references || ''
  };
}

/* ---------- fpcn.net 快速源 ---------- */
async function fpcnSearch(name) {
  const url = `http://www.fpcn.net/apps/search.php?q=${encodeURIComponent(name)}`;
  const html = await curlText(url);
  const items = [];
  const re = /<a href="(\/a\/[^"]+)">\s*<h4 class="title">\s*(.*?)<\/h4>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    if (title) items.push({ href: m[1], title });
  }
  let best = null;
  let bestScore = -1;
  for (const it of items) {
    let score = 0;
    if (it.title === name) score += 100;
    else if (it.title.startsWith(name)) {
      score += 50;
      const rest = it.title.slice(name.length).trim();
      if (/^[a-zA-Z(（]/.test(rest)) score += 30;
    }
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return bestScore >= 50 ? best : null;
}

async function fpcnFirstImage(href) {
  const re = /(?:src|data-src|data-original)="(\/uploads\/allimg\/[^"]+\.(?:jpg|jpeg|png|gif))"/gi;
  const m = re.exec(href);
  return m ? `http://www.fpcn.net${m[1]}` : null;
}

function latinTokens(latin) {
  return String(latin || '')
    .toLowerCase()
    .replace(/[×x]/g, ' ')
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 3);
}

function articleHasLatin(html, latin) {
  const tokens = latinTokens(latin);
  if (!tokens.length) return true;
  const text = String(html).toLowerCase();
  return tokens.every((t) => text.includes(t));
}

async function fpcnFetch(row, slug) {
  try {
    const article = await fpcnSearch(row.name);
    if (!article) return null;
    const destWebp = path.join(IMG_DIR, `${slug}.webp`);
    const tmp = path.join(IMG_DIR, `${slug}.tmp`);
    const sharp = (await import('sharp')).default;
    const html = await curlText(`http://www.fpcn.net${article.href}`);
    if (!articleHasLatin(html, row.latin)) {
      console.log(`[warn] fpcn 学名不符 ${row.name}: ${article.title} / ${row.latin}`);
      return null;
    }
    const imgUrl = await fpcnFirstImage(html);
    if (imgUrl) {
      await downloadPhoto(imgUrl, tmp);
      await sharp(tmp).rotate().resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 78 }).toFile(destWebp);
      try { await import('node:fs').then((fs) => fs.promises.unlink(tmp)); } catch {}
      return {
        title: article.title,
        artist: '花卉图片网（fpcn.net）',
        license: '公开网络图片',
        licenseUrl: '',
        source: imgUrl,
        queryUsed: 'fpcn',
        ext: 'webp'
      };
    }
    return null;
  } catch (err) {
    try { await import('node:fs').then((fs) => fs.promises.unlink(path.join(IMG_DIR, `${slug}.tmp`))); } catch {}
    console.log(`[warn] fpcn 失败 ${row.name}: ${err && err.message}`);
    return null;
  }
}

/* ---------- ppbc.iplant.cn 浏览器 worker ---------- */
class PPBCClient {
  constructor() {
    this.child = null;
    this.pending = new Map();
    this.seq = 0;
    this.failed = false;
  }

  async start() {
    this.child = spawn(PPBC_PYTHON, ['scripts/ppbc-worker.py'], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }
    });
    const reader = readline.createInterface({ input: this.child.stdout });
    reader.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        const cb = this.pending.get(msg.id);
        if (cb) {
          this.pending.delete(msg.id);
          cb(msg);
        }
      } catch {}
    });
    this.child.on('error', () => { this.failed = true; });
    this.child.on('exit', () => {
      this.failed = true;
      for (const cb of this.pending.values()) cb({ ok: false, error: 'ppbc worker exited' });
      this.pending.clear();
    });
    await new Promise((resolve, reject) => {
      this.child.once('spawn', resolve);
      this.child.once('error', reject);
    });
  }

  call(op, data) {
    if (this.failed) return Promise.resolve({ ok: false, error: 'worker unavailable' });
    const id = ++this.seq;
    const payload = { id, op, ...data };
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: 'ppbc timeout' });
      }, 90000);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      try {
        this.child.stdin.write(JSON.stringify(payload) + '\n');
      } catch {
        clearTimeout(timer);
        resolve({ ok: false, error: 'write failed' });
      }
    });
  }

  close() {
    try { this.child.stdin.end(); } catch {}
  }
}

async function ppbcFetch(row, slug, client) {
  const s = await client.call('search', { name: row.name, latin: row.latin, en: row.en, aliases: row.aliases || [] });
  if (!s.ok) return null;
  const p = await client.call('page', { tuId: s.tuId });
  if (!p.ok) return null;
  const destWebp = path.join(IMG_DIR, `${slug}.webp`);
  const tmp = path.join(IMG_DIR, `${slug}.tmp`);
  try {
    await ppbcDownload(p.full, tmp);
    await verifyImage(tmp);
    const sharp = (await import('sharp')).default;
    await sharp(tmp).rotate().resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 78 }).toFile(destWebp);
    return {
      title: s.label || p.title,
      artist: p.artist,
      license: 'ppbc 个人娱乐授权',
      licenseUrl: '',
      source: `https://ppbc.iplant.cn/tu/${s.tuId}`,
      queryUsed: 'ppbc',
      ext: 'webp'
    };
  } finally {
    try { await import('node:fs').then((fs) => fs.promises.unlink(tmp)); } catch {}
  }
}

async function main() {
  const rows = parseSeed();
  let meta = {};
  if (existsSync(META_FILE)) meta = JSON.parse(readFileSync(META_FILE, 'utf8'));

  let queue = [];
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

  let doneCount = 0;
  const skippedCount = rows.length - queue.length;

  /* Phase A：ppbc 浏览器抓取（串行、限速）
     提速模式：设置 PPBC_SKIP=1 则本轮跳过 ppbc 只跑 iNat 并行；
     之后再设 INAT_SKIP=1 单独跑 ppbc 为 iNat 漏掉的种类补图。 */
  if (!process.env.PPBC_SKIP && queue.length) {
    const ppbc = new PPBCClient();
    let ppbcOk = false;
    try {
      await ppbc.start();
      ppbcOk = true;
      console.log('[ppbc] worker 已启动');
    } catch (err) {
      console.log(`[warn] ppbc worker 启动失败：${err && err.message}，跳过 ppbc 源`);
    }
    if (ppbcOk) {
      const leftover = [];
      for (const job of queue) {
        const { row, slug } = job;
        let entry = null;
        try {
          entry = await ppbcFetch(row, slug, ppbc);
        } catch (err) {
          console.log(`[warn] ppbc 失败 ${row.name}: ${err && err.message}`);
        }
        if (entry) {
          meta[slug] = entry;
          writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
          doneCount++;
          console.log(`[OK] ${skippedCount + doneCount}/${rows.length} ${row.name} <- ${entry.title} (ppbc)`);
        } else {
          leftover.push(job);
          console.log(`[ppbc-miss] ${row.name}`);
        }
        await sleep(600);
      }
      ppbc.close();
      queue = leftover;
      console.log(`[ppbc-done] 剩余 ${queue.length} 种交给 iNaturalist`);
    }
  }

  const missing = [];
  const CONCURRENCY = 10;
  let cursor = 0;
  const inatSkip = !!process.env.INAT_SKIP;

  async function worker() {
    while (!inatSkip && cursor < queue.length) {
      const { row, slug } = queue[cursor++];

      const fpcnEntry = await fpcnFetch(row, slug);
      if (fpcnEntry) {
        meta[slug] = fpcnEntry;
        writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
        doneCount++;
        console.log(`[OK] ${skippedCount + doneCount}/${rows.length} ${row.name} <- ${fpcnEntry.title} (fpcn)`);
        await sleep(150);
        continue;
      }

      const queries = [row.latin, row.en, row.name, ...(row.aliases || [])].filter((q) => q && q.length > 1);
      let result = null;
      let queryUsed = '';
      for (const q of queries) {
        try {
          const taxon = await findTaxon(q);
          if (taxon) {
            let photo = null;
            if (taxon.default_photo && licenseRank(taxon.default_photo.license_code) >= 0) {
              photo = {
                url: taxon.default_photo.medium_url || taxon.default_photo.url,
                license_code: taxon.default_photo.license_code,
                license: taxon.default_photo.license_code || '',
                attribution: taxon.default_photo.attribution || '',
                obsId: taxon.id,
                obsUri: '',
                isDefault: true
              };
            }
            if (!photo) photo = await findPhotos(taxon.id);
            if (photo) {
              result = {
                photo,
                taxonName: taxon.name,
                queryUsed: q
              };
              break;
            }
          }
        } catch (err) {
          console.log(`[warn] ${row.name} query ${q}: ${err && err.message}`);
        }
        await sleep(200);
      }

      try {
        let metaEntry;
        if (result) {
          const { photo, taxonName, queryUsed } = result;
          const url = await downloadPick(photo, slug);
          metaEntry = {
            title: photo.isDefault
              ? `${taxonName}（iNaturalist 分类 ${photo.obsId}）`
              : `${taxonName}（iNaturalist 观察 ${photo.obsId}）`,
            artist: photo.attribution,
            license: photo.license,
            licenseUrl: licenseUrlFor(photo.license),
            source: url,
            queryUsed,
            ext: 'webp'
          };
        } else {
          const gbif = await gbifFallback(row, slug);
          if (gbif) {
            metaEntry = {
              title: gbif.title,
              artist: gbif.attribution,
              license: gbif.license,
              licenseUrl: licenseUrlFor(gbif.license),
              source: gbif.obsUri || gbif.url,
              queryUsed: 'gbif',
              ext: 'webp'
            };
          }
        }

        if (metaEntry) {
          meta[slug] = metaEntry;
          writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
          doneCount++;
          console.log(`[OK] ${skippedCount + doneCount}/${rows.length} ${row.name} <- ${metaEntry.title} (${metaEntry.license})`);
        } else {
          missing.push({ id: slug, name: row.name, latin: row.latin, reason: 'no cc photo' });
          console.log(`[MISS] ${row.name}`);
        }
      } catch (err) {
        missing.push({ id: slug, name: row.name, latin: row.latin, reason: String((err && err.message) || err) });
        console.log(`[ERR] ${row.name}: ${err && err.message}`);
      }
      await sleep(200);
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

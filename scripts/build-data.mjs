/*
 * 由种子清单 + 图片元数据生成浏览器可直接使用的 data/flowers.js。
 * 存在未配图条目时构建失败，保证交付时 100% 配图。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = path.join(ROOT, 'seed', 'flowers.tsv');
const META_FILE = path.join(ROOT, 'data', 'image-meta.json');
const OUT_FILE = path.join(ROOT, 'data', 'flowers.js');

function parseSeed() {
  const lines = readFileSync(SEED, 'utf8').split(/\r?\n/);
  const rows = [];
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 9) continue;
    if (parts[0].trim() === 'name') continue;
    const [name, en, latin, family, colors, aliases, meaning, season, blurb, morph, culture, care] = parts;
    rows.push({
      name: name.trim(),
      en: (en || '').trim(),
      latin: (latin || '').trim(),
      family: (family || '').trim(),
      colors: (colors || '').split('、').map((s) => s.trim()).filter(Boolean),
      aliases: (aliases || '').split('、').map((s) => s.trim()).filter(Boolean),
      meaning: (meaning || '').trim(),
      season: (season || '').trim(),
      blurb: (blurb || '').trim(),
      morph: (morph || '').trim(),
      culture: (culture || '').trim(),
      care: (care || '').trim()
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

const rows = parseSeed();
const meta = existsSync(META_FILE) ? JSON.parse(readFileSync(META_FILE, 'utf8')) : {};

const flowers = [];
const missing = [];

for (const row of rows) {
  const id = slugify(row.latin);
  const m = meta[id];
  if (!m || !existsSync(path.join(ROOT, 'images', `${id}.${m.ext || 'jpg'}`))) {
    missing.push({ id, name: row.name, latin: row.latin });
    continue;
  }
  flowers.push({
    id,
    name: row.name,
    en: row.en,
    latin: row.latin,
    family: row.family,
    colors: row.colors,
    aliases: row.aliases,
    meaning: row.meaning,
    season: row.season,
    blurb: row.blurb,
    morph: row.morph,
    culture: row.culture,
    care: row.care,
    image: `images/${id}.${m.ext}`,
    credit: {
      author: m.artist || 'Wikimedia Commons',
      license: m.license || 'Unknown',
      licenseUrl: m.licenseUrl || '',
      source: m.source || ''
    }
  });
}

if (missing.length) {
  console.error(`[build-fail] ${missing.length} 朵花缺少图片:`);
  for (const m of missing) console.error(`  - ${m.name} (${m.latin})`);
  process.exit(1);
}

mkdirSync(path.dirname(OUT_FILE), { recursive: true });
const js = `/* 由 scripts/build-data.mjs 生成，请勿手工编辑 */\nglobalThis.FLOWERS = ${JSON.stringify(flowers, null, 2)};\n`;
writeFileSync(OUT_FILE, js, 'utf8');
console.log(`[build-ok] ${flowers.length} 朵花已写入 data/flowers.js`);

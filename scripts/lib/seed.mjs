/* 共享：路径、种子清单解析、学名 slug 化 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SEED = path.join(ROOT, 'seed', 'flowers.tsv');
export const IMG_DIR = path.join(ROOT, 'images');
export const DATA_DIR = path.join(ROOT, 'data');
export const META_FILE = path.join(DATA_DIR, 'image-meta.json');
export const MISSING_FILE = path.join(DATA_DIR, 'missing.json');

export function parseSeed() {
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

export function slugify(latin) {
  return String(latin || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normLatin(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[×x]/g, ' ')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

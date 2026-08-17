/*
 * 把 seed/stories.tsv（中文名 → 小故事）合并回 seed/flowers.tsv 的第 13 列。
 * 全部条目都有故事时才会写回；缺失则报错并保持文件不变。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = path.join(ROOT, 'seed', 'flowers.tsv');
const STORIES = path.join(ROOT, 'seed', 'stories.tsv');

const seedLines = readFileSync(SEED, 'utf8').split(/\r?\n/);
const storyLines = readFileSync(STORIES, 'utf8').split(/\r?\n/);

const stories = new Map();
for (const raw of storyLines) {
  const line = raw.replace(/\r$/, '');
  if (!line || line.startsWith('#')) continue;
  const idx = line.indexOf('\t');
  if (idx <= 0) continue;
  const name = line.slice(0, idx).trim();
  const text = line.slice(idx + 1).trim();
  if (!name || !text) continue;
  if (stories.has(name)) {
    console.error(`[merge-fail] 故事重复：${name}`);
    process.exit(1);
  }
  stories.set(name, text);
}

const missing = [];
const out = [];
for (const raw of seedLines) {
  const line = raw.replace(/\r$/, '');
  if (!line || line.startsWith('#')) {
    if (line.startsWith('# 列：')) {
      out.push('# 列：中文名 | 英文名 | 学名 | 科 | 颜色（、分隔） | 别名（、分隔） | 花语 | 花期 | 简介 | 形态特征 | 花语与文化 | 分布与养护 | 小故事');
    } else {
      out.push(line);
    }
    continue;
  }
  const parts = line.split('\t');
  if (parts.length < 9 || parts[0].trim() === 'name') {
    out.push(line);
    continue;
  }
  const name = parts[0].trim();
  const story = stories.get(name);
  if (!story) missing.push(name);
  parts[12] = story || '';
  out.push(parts.join('\t'));
}

if (missing.length) {
  console.error(`[merge-fail] ${missing.length} 朵花缺少故事：`);
  missing.forEach((n) => console.error('  - ' + n));
  process.exit(1);
}

writeFileSync(SEED, out.join('\r\n') + (out.length ? '\r\n' : ''), 'utf8');
console.log(`[merge-ok] 已写入 ${stories.size} 条故事到 seed/flowers.tsv`);

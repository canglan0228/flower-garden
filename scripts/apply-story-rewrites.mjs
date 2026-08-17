/*
 * 把 seed/story-long-rewrites.tsv 里（中文名 → 扩写故事）整段替换 seed/stories.tsv 对应条目。
 * 全部命中才写回，否则报错保持原样。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORIES = path.join(ROOT, 'seed', 'stories.tsv');
const REWRITES = path.join(ROOT, 'seed', 'story-long-rewrites.tsv');

const rewrites = new Map();
for (const raw of readFileSync(REWRITES, 'utf8').split(/\r?\n/)) {
  const line = raw.replace(/\r$/, '');
  if (!line || line.startsWith('#')) continue;
  const idx = line.indexOf('\t');
  if (idx <= 0) continue;
  const name = line.slice(0, idx).trim();
  const text = line.slice(idx + 1).trim();
  if (!name || !text) continue;
  if (rewrites.has(name)) {
    console.error(`[rewrite-fail] 重复条目：${name}`);
    process.exit(1);
  }
  rewrites.set(name, text);
}

const out = [];
let applied = 0;
for (const raw of readFileSync(STORIES, 'utf8').split(/\r?\n/)) {
  const line = raw.replace(/\r$/, '');
  if (!line || line.startsWith('#')) {
    out.push(line);
    continue;
  }
  const idx = line.indexOf('\t');
  const name = line.slice(0, idx).trim();
  const rewrite = rewrites.get(name);
  if (!rewrite) {
    out.push(line);
    continue;
  }
  out.push(name + '\t' + rewrite);
  rewrites.delete(name);
  applied++;
}

if (rewrites.size) {
  console.error(`[rewrite-fail] ${rewrites.size} 条未命中：`);
  rewrites.forEach((v, k) => console.error('  - ' + k));
  process.exit(1);
}

writeFileSync(STORIES, out.join('\r\n') + '\r\n', 'utf8');
console.log(`[rewrite-ok] 已扩写 ${applied} 条故事`);

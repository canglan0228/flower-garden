/*
 * 把 seed/story-fixes-*.tsv 里的补充句追加到 seed/stories.tsv 对应条目的故事末尾。
 * 全部命中才写回，否则报错保持原样。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED_DIR = path.join(ROOT, 'seed');
const STORIES = path.join(SEED_DIR, 'stories.tsv');

function readLines(file) {
  return readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.replace(/\r$/, ''));
}

const fixes = new Map();
let files = readdirSync(SEED_DIR)
  .filter((f) => /^story-fixes-.*\.tsv$/.test(f))
  .sort();
if (process.argv.length > 2) {
  const wanted = new Set(process.argv.slice(2));
  files = files.filter((f) => wanted.has(f));
}
for (const file of files) {
  for (const raw of readLines(path.join(SEED_DIR, file))) {
    if (!raw || raw.startsWith('#')) continue;
    const idx = raw.indexOf('\t');
    if (idx <= 0) continue;
    const name = raw.slice(0, idx).trim();
    const text = raw.slice(idx + 1).trim();
    if (!name || !text) continue;
    if (fixes.has(name)) {
      console.error(`[fix-fail] 补充句重复：${name}`);
      process.exit(1);
    }
    fixes.set(name, text);
  }
}

const storyLines = readLines(STORIES);
const missing = [];
let applied = 0;
const out = [];
for (const line of storyLines) {
  if (!line || line.startsWith('#')) {
    out.push(line);
    continue;
  }
  const idx = line.indexOf('\t');
  const name = line.slice(0, idx).trim();
  const text = line.slice(idx + 1).trim();
  if (!name) {
    out.push(line);
    continue;
  }
  const fix = fixes.get(name);
  if (!fix) {
    out.push(line);
    continue;
  }
  const suffix = /[。！？!?]$/.test(text) ? fix : '。' + fix;
  out.push(name + '\t' + text + suffix);
  fixes.delete(name);
  applied++;
}

if (fixes.size) {
  console.error(`[fix-fail] ${fixes.size} 条补充句未命中：`);
  fixes.forEach((v, k) => console.error('  - ' + k));
  process.exit(1);
}

writeFileSync(STORIES, out.join('\r\n') + '\r\n', 'utf8');
console.log(`[fix-ok] 已补长 ${applied} 条故事`);

/*
 * 把 seed/story-tail-fixes.tsv 里的新尾句替换 stories.tsv 对应条目的末句。
 * 若提供第二个参数（基准文件），则从基准文件取对应条目原文再替换末句（用于修复误追加）。
 * 全部命中才写回，否则报错保持原样。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORIES = path.join(ROOT, 'seed', 'stories.tsv');
const FIXES = path.join(ROOT, 'seed', 'story-tail-fixes.tsv');
const BASE = process.argv[2];

const fixes = new Map();
for (const raw of readFileSync(FIXES, 'utf8').split(/\r?\n/)) {
  const line = raw.replace(/\r$/, '');
  if (!line || line.startsWith('#')) continue;
  const idx = line.indexOf('\t');
  if (idx <= 0) continue;
  const name = line.slice(0, idx).trim();
  const text = line.slice(idx + 1).trim().replace(/。+$/, '');
  if (!name || !text) continue;
  if (fixes.has(name)) {
    console.error(`[tail-fail] 重复条目：${name}`);
    process.exit(1);
  }
  fixes.set(name, text);
}

function replaceTail(story, tail) {
  const s = String(story || '').replace(/。+$/, '');
  const idx = s.lastIndexOf('。');
  const head = idx >= 0 ? s.slice(0, idx + 1) : '';
  return head + tail + '。';
}

const out = [];
let applied = 0;
const baseRows = BASE ? new Map(
  readFileSync(BASE, 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('\t');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
) : null;
for (const raw of readFileSync(STORIES, 'utf8').split(/\r?\n/)) {
  const line = raw.replace(/\r$/, '');
  if (!line || line.startsWith('#')) {
    out.push(line);
    continue;
  }
  const idx = line.indexOf('\t');
  const name = line.slice(0, idx).trim();
  const fix = fixes.get(name);
  if (!fix) {
    out.push(line);
    continue;
  }
  const baseText = baseRows ? baseRows.get(name) : null;
  const story = baseText != null ? baseText : line.slice(idx + 1);
  out.push(name + '\t' + replaceTail(story, fix));
  fixes.delete(name);
  applied++;
}

if (fixes.size) {
  console.error(`[tail-fail] ${fixes.size} 条未命中：`);
  fixes.forEach((v, k) => console.error('  - ' + k));
  process.exit(1);
}

writeFileSync(STORIES, out.join('\r\n') + '\r\n', 'utf8');
console.log(`[tail-ok] 已替换 ${applied} 条故事尾句`);

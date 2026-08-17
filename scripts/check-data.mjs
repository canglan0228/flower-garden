/*
 * 数据完整性校验：字段、id 唯一性、图片文件存在、来源标注齐全。
 */
import { existsSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import('../data/flowers.js');
const flowers = globalThis.FLOWERS;

const errors = [];
const warnings = [];

if (!Array.isArray(flowers) || flowers.length < 300) {
  errors.push(`条目数不足：当前 ${flowers ? flowers.length : 0}，要求 >= 300`);
}

const seen = new Set();
for (const f of flowers || []) {
  if (!f || typeof f !== 'object') {
    errors.push('存在非法条目');
    continue;
  }
  if (seen.has(f.id)) errors.push(`id 重复：${f.id}`);
  seen.add(f.id);

  for (const key of ['id', 'name', 'latin', 'family', 'meaning', 'season', 'blurb', 'story', 'image']) {
    if (!f[key] || !String(f[key]).trim()) errors.push(`${f.id || '?'}: 缺少 ${key}`);
  }
  if (!Array.isArray(f.colors) || !f.colors.length) errors.push(`${f.id}: colors 为空`);
  if (!Array.isArray(f.aliases)) errors.push(`${f.id}: aliases 不是数组`);
  for (const key of ['morph', 'culture', 'care']) {
    const v = String(f[key] || '');
    if (v.length < 8) errors.push(`${f.id}: ${key} 过短（${v.length} 字，要求 >= 8）`);
  }
  const storyLen = String(f.story || '').length;
  if (storyLen < 60) errors.push(`${f.id}: story 过短（${storyLen} 字，要求 >= 60）`);
  else if (storyLen < 100) warnings.push(`${f.id}: story 偏短（${storyLen} 字，建议 100-150）`);
  const detailLen = String(f.morph || '').length + String(f.culture || '').length + String(f.care || '').length;
  if (detailLen < 35) errors.push(`${f.id}: 形态/文化/养护合计过短（${detailLen} 字，要求 >= 35）`);
  if (!f.credit || !f.credit.author || !f.credit.license || !f.credit.source) {
    errors.push(`${f.id}: 图片来源标注不完整`);
  }
  const imgPath = path.join(ROOT, f.image);
  if (!existsSync(imgPath)) {
    errors.push(`${f.id}: 图片文件不存在 ${f.image}`);
  } else if (statSync(imgPath).size < 5000) {
    warnings.push(`${f.id}: 图片过小 (${statSync(imgPath).size} bytes)`);
  }
}

console.log(`[check] 共 ${flowers ? flowers.length : 0} 朵花`);
if (warnings.length) {
  console.log(`[warn] ${warnings.length} 条警告`);
  warnings.forEach((w) => console.log('  - ' + w));
}
if (errors.length) {
  console.error(`[fail] ${errors.length} 条错误`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}

const totalBytes = flowers.reduce((sum, f) => sum + (existsSync(path.join(ROOT, f.image)) ? statSync(path.join(ROOT, f.image)).size : 0), 0);
console.log(`[ok] 校验通过，图片总大小约 ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

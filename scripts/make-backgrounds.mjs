/*
 * 把 Pixabay 下载的候选图压缩为网站背景 WebP。
 * 用法：node scripts/make-backgrounds.mjs <源图目录>
 * 源图目录中需存在 src/ 子目录内的文件，见 SOURCES 映射。
 */
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'backgrounds');

const SOURCES = [
  { file: '02-sakura-beach.png', out: 'bg-01.webp' },
  { file: '03-blossom-tree.png', out: 'bg-02.webp' },
  { file: '08-anime-road.png', out: 'bg-03.webp' },
  { file: '09-meadow.png', out: 'bg-04.webp' },
  { file: '07-anime-snowtree.jpg', out: 'bg-05.webp' },
  { file: '06-anime-winter.png', out: 'bg-06.webp' }
];

const srcDir = process.argv[2];
if (!srcDir || !existsSync(srcDir)) {
  console.error('用法：node scripts/make-backgrounds.mjs <源图目录>');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const item of SOURCES) {
  const src = path.join(srcDir, item.file);
  if (!existsSync(src)) {
    console.error(`[skip] 缺少源图 ${item.file}`);
    continue;
  }
  const out = path.join(OUT_DIR, item.out);
  await sharp(src)
    .rotate()
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toFile(out);
  const { size } = await import('node:fs').then((fs) => fs.promises.stat(out));
  console.log(`[ok] ${item.out} (${(size / 1024).toFixed(0)} KB)`);
}

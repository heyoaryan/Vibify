/**
 * Vibify PWA Icon Generator
 * Generates all required PNG icons from the SVG source files.
 *
 * Output:
 *   public/icons/icon-180.png          (iOS apple-touch-icon)
 *   public/icons/icon-192.png          (Android / manifest any)
 *   public/icons/icon-512.png          (Android / manifest any)
 *   public/icons/icon-192-maskable.png (Android adaptive icon)
 *   public/icons/icon-512-maskable.png (Android adaptive icon large)
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');

const jobs = [
  { src: 'icon-192.svg',          dest: 'icon-180.png',          size: 180 },
  { src: 'icon-192.svg',          dest: 'icon-192.png',          size: 192 },
  { src: 'icon-512.svg',          dest: 'icon-512.png',          size: 512 },
  { src: 'icon-192-maskable.svg', dest: 'icon-192-maskable.png', size: 192 },
  { src: 'icon-512-maskable.svg', dest: 'icon-512-maskable.png', size: 512 },
];

for (const { src, dest, size } of jobs) {
  const srcPath  = join(iconsDir, src);
  const destPath = join(iconsDir, dest);
  const svg      = readFileSync(srcPath);

  await sharp(svg, { density: 300 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(destPath);

  console.log(`✓  ${dest}  (${size}×${size})`);
}

console.log('\nAll icons generated successfully.');

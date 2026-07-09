// Gera os ícones do PWA (cores da marca Papernow) a partir de um SVG.
// Uso: node server/generate-icons.js
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from './config.js';

const iconsDir = path.join(config.paths.public, 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

function svg({ size, bg, maskable }) {
  const pad = maskable ? size * 0.16 : size * 0.1;
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = maskable ? size * 0.42 : size * 0.5;
  const nameSize = size * 0.1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.22}" fill="${bg}"/>
  <text x="${cx}" y="${cy - size * 0.02}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}"
        fill="#A96A45" text-anchor="middle" dominant-baseline="central">&#8734;</text>
  <text x="${cx}" y="${cy + size * 0.30}" font-family="Georgia, serif" font-size="${nameSize}" letter-spacing="${size*0.02}"
        fill="#8A5433" text-anchor="middle" dominant-baseline="central">PAPERNOW</text>
</svg>`;
}

async function make(name, size, opts) {
  const buf = Buffer.from(svg({ size, ...opts }));
  await sharp(buf).png().toFile(path.join(iconsDir, name));
  console.log('  ✓', name);
}

console.log('Gerando ícones da marca…');
await make('icon-192.png', 192, { bg: '#F5F0E6' });
await make('icon-512.png', 512, { bg: '#F5F0E6' });
await make('icon-maskable-512.png', 512, { bg: '#F5F0E6', maskable: true });
console.log('Ícones gerados em public/icons.');

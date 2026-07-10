// Gera os ícones do PWA a partir do logo Papernow (public/img/papernow-logo.png).
// Isola o símbolo ∞, recolore para terracota e centraliza num tile creme.
// Uso: node server/generate-icons.js
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from './config.js';

const imgDir = path.join(config.paths.public, 'img');
const iconDir = path.join(config.paths.public, 'icons');
const LOGO = path.join(imgDir, 'papernow-logo.png');
fs.mkdirSync(iconDir, { recursive: true });

const cream = { r: 243, g: 236, b: 224 };   // #F3ECE0
const terra = { r: 176, g: 113, b: 74 };    // #B0714A

async function build() {
  const meta = await sharp(LOGO).metadata();
  // O símbolo ∞ ocupa a porção esquerda do logo (≈ altura x 1.9 de largura).
  const cropW = Math.round(meta.height * 1.9);
  const mark = await sharp(LOGO).extract({ left: 0, top: 0, width: Math.min(cropW, meta.width), height: meta.height }).trim().toBuffer();
  const { data: alpha, info } = await sharp(mark).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const terraMark = await sharp({ create: { width: info.width, height: info.height, channels: 3, background: terra } })
    .joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png().toBuffer();

  async function icon(size, ratio, out) {
    const resized = await sharp(terraMark).resize({ width: Math.round(size * ratio) }).toBuffer();
    const rm = await sharp(resized).metadata();
    await sharp({ create: { width: size, height: size, channels: 4, background: { ...cream, alpha: 1 } } })
      .composite([{ input: resized, top: Math.round((size - rm.height) / 2), left: Math.round((size - rm.width) / 2) }])
      .png().toFile(path.join(iconDir, out));
    console.log('  ✓', out);
  }

  console.log('Gerando ícones a partir do logo…');
  await icon(192, 0.62, 'icon-192.png');
  await icon(512, 0.62, 'icon-512.png');
  await icon(512, 0.50, 'icon-maskable-512.png');
  console.log('Ícones gerados em public/icons.');
}

build().catch((e) => { console.error(e.message); process.exit(1); });

// Importa itens iniciais da página Entre Nós a partir de uma pasta com manifest.json.
// Uso: node server/seed-entrenos.js <pasta>
// manifest.json: [{ section, title, subtitle?, image?, file?, url?, coupon? }, ...]
// Idempotente: itens que já existem (mesma seção + título) são ignorados.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from './db.js';
import { SECTIONS, cleanUrl, youtubeId } from './entrenos-data.js';
import { FILE_DIR, storeImage } from './routes/entrenos.js';

const dir = path.resolve(process.argv[2] || '');
const manifestPath = path.join(dir, 'manifest.json');
if (!process.argv[2] || !fs.existsSync(manifestPath)) {
  console.error('Informe a pasta com o manifest.json: node server/seed-entrenos.js <pasta>');
  process.exit(1);
}

const TYPES = { '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.zip': 'application/zip' };
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let added = 0;

for (const it of manifest) {
  if (!SECTIONS.includes(it.section) || !it.title) { console.log('  ! ignorado (seção/título inválido):', it.title); continue; }
  if (db.prepare('SELECT id FROM entrenos_items WHERE section = ? AND title = ?').get(it.section, it.title)) { console.log('  = já existe:', it.title); continue; }

  let image = null;
  if (it.image) image = await storeImage(path.join(dir, it.image));
  else if (youtubeId(it.url)) {
    const res = await fetch(`https://i.ytimg.com/vi/${youtubeId(it.url)}/hqdefault.jpg`);
    if (res.ok) image = await storeImage(Buffer.from(await res.arrayBuffer()));
  }

  let file = null, file_name = null, file_type = null;
  if (it.file) {
    const ext = path.extname(it.file).toLowerCase();
    file = `${crypto.randomBytes(8).toString('hex')}${ext}`;
    fs.copyFileSync(path.join(dir, it.file), path.join(FILE_DIR, file));
    file_name = it.file; file_type = TYPES[ext] || 'application/octet-stream';
  }

  const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM entrenos_items WHERE section = ?').get(it.section).p;
  db.prepare(`INSERT INTO entrenos_items (section, title, subtitle, image, file, file_name, file_type, url, coupon, position)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(it.section, it.title, it.subtitle || null, image, file, file_name, file_type, cleanUrl(it.url), it.coupon || null, pos);
  added++;
  console.log('  +', it.section, '·', it.title);
}
console.log(`Entre Nós: ${added} item(ns) adicionados.`);

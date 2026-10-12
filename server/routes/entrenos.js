import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { db } from '../db.js';
import { requireAdmin } from '../auth-middleware.js';
import { config } from '../config.js';
import {
  SECTIONS, DEFAULTS, cleanUrl, getSettings, saveSettings, listItems, publicItem, youtubeId,
} from '../entrenos-data.js';

const router = Router();

const IMG_DIR = path.join(config.paths.entrenos, 'img');
const FILE_DIR = path.join(config.paths.entrenos, 'files');
const TMP_DIR = path.join(config.paths.entrenos, 'tmp');
for (const d of [IMG_DIR, FILE_DIR, TMP_DIR]) fs.mkdirSync(d, { recursive: true });

const IMAGE_TYPES = /^image\/(jpe?g|png|webp|heic|heif)$/i;
// Materiais aceitos: PDF, vídeo, imagem para imprimir ou ZIP.
const FILE_EXT = {
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};
const MAX_FILE_MB = 300;

const upload = multer({
  storage: multer.diskStorage({
    destination: TMP_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(10).toString('hex')),
  }),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isImageField = file.fieldname !== 'file';
    if (isImageField && !IMAGE_TYPES.test(file.mimetype)) return cb(new Error('A imagem precisa ser JPG, PNG ou WEBP.'));
    if (!isImageField && !FILE_EXT[file.mimetype]) return cb(new Error('Material não aceito. Envie PDF, vídeo (MP4/MOV), imagem ou ZIP.'));
    cb(null, true);
  },
});
const itemUpload = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]);
const settingsUpload = upload.fields([{ name: 'partnerImage', maxCount: 1 }, { name: 'logo', maxCount: 1 }]);

const rm = (file) => { if (file) fs.rm(file, { force: true }, () => {}); };
const cleanupTmp = (req) => { for (const list of Object.values(req.files || {})) for (const f of list) rm(f.path); };
const text = (v, max) => String(v ?? '').trim().slice(0, max);

// Capa: redimensiona e converte para WEBP (leve no celular, mantém transparência de logos).
async function storeImage(tmpPathOrBuffer, { maxWidth = 1600 } = {}) {
  const name = `${crypto.randomBytes(8).toString('hex')}.webp`;
  await sharp(tmpPathOrBuffer)
    .rotate()
    .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(IMG_DIR, name));
  return name;
}

function storeFile(f) {
  const name = `${crypto.randomBytes(8).toString('hex')}${FILE_EXT[f.mimetype]}`;
  fs.renameSync(f.path, path.join(FILE_DIR, name));
  return { file: name, file_name: text(f.originalname, 200), file_type: f.mimetype };
}

// Vídeo do YouTube sem capa enviada: usamos a miniatura oficial do próprio vídeo.
async function youtubeThumb(url) {
  const id = youtubeId(url);
  if (!id) return null;
  for (const size of ['maxresdefault', 'hqdefault']) {
    try {
      const res = await fetch(`https://i.ytimg.com/vi/${id}/${size}.jpg`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return await storeImage(Buffer.from(await res.arrayBuffer()));
    } catch { /* tenta o próximo tamanho */ }
  }
  return null;
}

// O que cada seção exige para o bloco nunca ficar "só informativo".
function validate(section, it) {
  if (!it.title) return 'Informe o nome/título.';
  if (!it.image) return section === 'videos'
    ? 'Envie a capa do vídeo (para links do YouTube ela é buscada automaticamente).'
    : 'A imagem de capa é obrigatória.';
  if (section === 'downloads' && !it.file) return 'Envie o arquivo do material.';
  if (section === 'conteudo' && !it.file && !it.url) return 'Envie o arquivo (PDF ou vídeo) ou informe um link para o conteúdo.';
  if (section === 'videos' && !it.file && !it.url) return 'Informe o link do vídeo (YouTube/Vimeo) ou envie o arquivo.';
  if (section === 'loja' && !it.url) return 'Informe o link do produto na loja.';
  if (section === 'beneficios' && !it.subtitle) return 'Descreva o benefício (ex.: 10% de desconto no site).';
  if (section === 'beneficios' && !it.coupon && !it.url) return 'Informe o cupom ou o link do parceiro.';
  return null;
}

// ---- Público ----

// GET /api/entrenos — tudo o que a página mostra
router.get('/', (req, res) => {
  res.json({ settings: getSettings(), items: listItems({ onlyActive: true }) });
});

// GET /api/entrenos/file/:id — abre/baixa o material (conta os acessos)
router.get('/file/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM entrenos_items WHERE id = ? AND active = 1').get(req.params.id);
  if (!row || !row.file) return res.status(404).send('Material não encontrado.');
  const file = path.join(FILE_DIR, row.file);
  if (!fs.existsSync(file)) return res.status(404).send('Arquivo indisponível.');

  // Conta só o início do download (vídeos fazem várias requisições parciais).
  if (!req.headers.range || /^bytes=0-/.test(req.headers.range)) {
    db.prepare('UPDATE entrenos_items SET hits = hits + 1 WHERE id = ?').run(row.id);
  }
  const ext = path.extname(row.file);
  const name = `${row.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'material'}${ext}`;
  const asDownload = row.section === 'downloads' || req.query.dl === '1';
  res.setHeader('Content-Type', row.file_type || 'application/octet-stream');
  res.setHeader('Content-Disposition',
    `${asDownload ? 'attachment' : 'inline'}; filename="material${ext}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.sendFile(file, { headers: { 'Cache-Control': 'private, max-age=3600' } });
});

// ---- Painel (admin) ----

router.get('/admin', requireAdmin, (req, res) => {
  res.json({ settings: getSettings(), defaults: DEFAULTS, items: listItems(), maxFileMb: MAX_FILE_MB });
});

// POST /api/entrenos/items
router.post('/items', requireAdmin, itemUpload, async (req, res, next) => {
  try {
    const section = SECTIONS.includes(req.body.section) ? req.body.section : null;
    if (!section) { cleanupTmp(req); return res.status(400).json({ error: 'Seção inválida.' }); }
    const imageFile = req.files?.image?.[0];
    const materialFile = req.files?.file?.[0];
    const rawUrl = text(req.body.url, 2000);
    const it = {
      title: text(req.body.title, 160),
      subtitle: text(req.body.subtitle, 400) || null,
      url: cleanUrl(rawUrl),
      coupon: text(req.body.coupon, 40) || null,
      image: imageFile ? 'pending' : null,
      file: materialFile ? 'pending' : null,
    };
    if (rawUrl && !it.url) { cleanupTmp(req); return res.status(400).json({ error: 'O link precisa começar com https://' }); }
    if (!it.image && section === 'videos' && youtubeId(it.url)) it.image = 'youtube';
    const problem = validate(section, it);
    if (problem) { cleanupTmp(req); return res.status(400).json({ error: problem }); }

    if (imageFile) { it.image = await storeImage(imageFile.path); rm(imageFile.path); }
    else if (it.image === 'youtube') {
      it.image = await youtubeThumb(it.url);
      if (!it.image) { cleanupTmp(req); return res.status(400).json({ error: 'Não consegui buscar a capa no YouTube. Envie uma imagem de capa.' }); }
    }
    const stored = materialFile ? storeFile(materialFile) : { file: null, file_name: null, file_type: null };

    // Conteúdo e vídeos novos entram no topo ("sempre que tem novidade, ela aparece aqui").
    const edge = ['conteudo', 'videos'].includes(section)
      ? db.prepare('SELECT COALESCE(MIN(position), 1) - 1 AS p FROM entrenos_items WHERE section = ?').get(section).p
      : db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM entrenos_items WHERE section = ?').get(section).p;

    const info = db
      .prepare(`INSERT INTO entrenos_items (section, title, subtitle, image, file, file_name, file_type, url, coupon, active, position)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(section, it.title, it.subtitle, it.image, stored.file, stored.file_name, stored.file_type, it.url, it.coupon,
        req.body.active === '0' ? 0 : 1, edge);
    res.status(201).json({ item: publicItem(db.prepare('SELECT * FROM entrenos_items WHERE id = ?').get(info.lastInsertRowid)) });
  } catch (err) { cleanupTmp(req); next(err); }
});

// PUT /api/entrenos/items/:id — edita (imagem/arquivo novos substituem os antigos)
router.put('/items/:id', requireAdmin, itemUpload, async (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM entrenos_items WHERE id = ?').get(req.params.id);
    if (!row) { cleanupTmp(req); return res.status(404).json({ error: 'Item não encontrado.' }); }
    const imageFile = req.files?.image?.[0];
    const materialFile = req.files?.file?.[0];
    const b = req.body;
    const rawUrl = b.url !== undefined ? text(b.url, 2000) : null;
    if (rawUrl && !cleanUrl(rawUrl)) { cleanupTmp(req); return res.status(400).json({ error: 'O link precisa começar com https://' }); }

    const it = {
      title: b.title !== undefined ? text(b.title, 160) : row.title,
      subtitle: b.subtitle !== undefined ? (text(b.subtitle, 400) || null) : row.subtitle,
      url: rawUrl !== null ? cleanUrl(rawUrl) : row.url,
      coupon: b.coupon !== undefined ? (text(b.coupon, 40) || null) : row.coupon,
      image: imageFile ? 'pending' : row.image,
      file: materialFile ? 'pending' : (b.removeFile === '1' ? null : row.file),
    };
    const problem = validate(row.section, it);
    if (problem) { cleanupTmp(req); return res.status(400).json({ error: problem }); }

    let { image, file, file_name, file_type } = row;
    if (imageFile) { image = await storeImage(imageFile.path); rm(imageFile.path); rm(row.image && path.join(IMG_DIR, row.image)); }
    if (materialFile) {
      ({ file, file_name, file_type } = storeFile(materialFile));
      rm(row.file && path.join(FILE_DIR, row.file));
    } else if (b.removeFile === '1' && row.file) {
      rm(path.join(FILE_DIR, row.file));
      file = null; file_name = null; file_type = null;
    }
    const active = b.active !== undefined ? (b.active === '0' || b.active === 'false' ? 0 : 1) : row.active;

    db.prepare(`UPDATE entrenos_items SET title = ?, subtitle = ?, image = ?, file = ?, file_name = ?, file_type = ?,
                url = ?, coupon = ?, active = ? WHERE id = ?`)
      .run(it.title, it.subtitle, image, file, file_name, file_type, it.url, it.coupon, active, row.id);
    res.json({ item: publicItem(db.prepare('SELECT * FROM entrenos_items WHERE id = ?').get(row.id)) });
  } catch (err) { cleanupTmp(req); next(err); }
});

// POST /api/entrenos/items/:id/move  { dir: 'up' | 'down' }
router.post('/items/:id/move', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM entrenos_items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Item não encontrado.' });
  const list = db.prepare('SELECT id FROM entrenos_items WHERE section = ? ORDER BY position ASC, id ASC').all(row.section).map((r) => r.id);
  const i = list.indexOf(row.id);
  const j = req.body.dir === 'up' ? i - 1 : i + 1;
  if (j >= 0 && j < list.length) {
    [list[i], list[j]] = [list[j], list[i]];
    const upd = db.prepare('UPDATE entrenos_items SET position = ? WHERE id = ?');
    list.forEach((id, pos) => upd.run(pos + 1, id));
  }
  res.json({ ok: true });
});

// DELETE /api/entrenos/items/:id
router.delete('/items/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM entrenos_items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Item não encontrado.' });
  db.prepare('DELETE FROM entrenos_items WHERE id = ?').run(row.id);
  rm(row.image && path.join(IMG_DIR, row.image));
  rm(row.file && path.join(FILE_DIR, row.file));
  res.json({ ok: true });
});

// PUT /api/entrenos/settings — textos das seções, parceira em destaque, links e logo
router.put('/settings', requireAdmin, settingsUpload, async (req, res, next) => {
  try {
    let input = {};
    try { input = JSON.parse(req.body.data || '{}'); } catch { /* ignora */ }
    const current = getSettings();
    const URL_KEYS = new Set(['primaryUrl', 'storeUrl', 'fullUrl', 'whatsappUrl']);
    const FILE_KEYS = new Set(['image', 'logo']);

    // Só aceita chaves conhecidas (as do DEFAULTS); links passam intactos pelo cleanUrl.
    const merge = (def, cur, inp) => {
      const out = {};
      for (const k of Object.keys(def)) {
        const v = inp?.[k];
        if (FILE_KEYS.has(k) || v === undefined) out[k] = cur[k];
        else if (typeof def[k] === 'boolean') out[k] = !!v;
        else if (URL_KEYS.has(k)) {
          const raw = String(v ?? '').trim();
          if (raw && !cleanUrl(raw)) throw Object.assign(new Error('Os links precisam começar com https://'), { status: 400 });
          out[k] = cleanUrl(raw) || '';
        } else out[k] = text(v, 600);
      }
      return out;
    };

    const next_ = { sections: {} };
    for (const k of Object.keys(DEFAULTS.sections)) {
      next_.sections[k] = merge(DEFAULTS.sections[k], current.sections[k], input.sections?.[k]);
      if (!next_.sections[k].title) next_.sections[k].title = DEFAULTS.sections[k].title;
    }
    next_.partner = merge(DEFAULTS.partner, current.partner, input.partner);
    next_.general = merge(DEFAULTS.general, current.general, input.general);

    const partnerImage = req.files?.partnerImage?.[0];
    if (partnerImage) {
      next_.partner.image = await storeImage(partnerImage.path, { maxWidth: 2000 });
      rm(partnerImage.path); rm(current.partner.image && path.join(IMG_DIR, current.partner.image));
    }
    const logo = req.files?.logo?.[0];
    if (logo) {
      next_.general.logo = await storeImage(logo.path, { maxWidth: 1400 });
      rm(logo.path); rm(current.general.logo && path.join(IMG_DIR, current.general.logo));
    } else if (req.body.removeLogo === '1' && current.general.logo) {
      rm(path.join(IMG_DIR, current.general.logo));
      next_.general.logo = null;
    }

    saveSettings(next_);
    res.json({ ok: true, settings: getSettings() });
  } catch (err) {
    cleanupTmp(req);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// Erros de upload com mensagens claras para o painel.
router.use((err, req, res, next) => {
  cleanupTmp(req);
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Arquivo muito grande (máx. ${MAX_FILE_MB}MB). Para vídeos longos, use um link do YouTube.` });
  next(err);
});

export default router;
export { IMG_DIR, FILE_DIR, storeImage };

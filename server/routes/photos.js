import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { db } from '../db.js';
import { requireAuth } from '../auth-middleware.js';
import { config } from '../config.js';
import { isValidWeek } from '../weeks.js';
import { encrypt, decrypt } from '../crypto.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB antes da compressão
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|heic|heif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Envie uma imagem (JPG, PNG, WEBP ou HEIC).'));
  },
});

function userDir(uid) {
  const dir = path.join(config.paths.uploads, String(uid));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// GET /api/photos?week=8  (ou sem week = todas)
router.get('/', (req, res) => {
  const week = Number(req.query.week);
  let rows;
  if (req.query.week != null && isValidWeek(week)) {
    rows = db.prepare('SELECT id, week, filename, caption, created_at FROM photos WHERE user_id = ? AND week = ? ORDER BY created_at').all(req.user.uid, week);
  } else {
    rows = db.prepare('SELECT id, week, filename, caption, created_at FROM photos WHERE user_id = ? ORDER BY week, created_at').all(req.user.uid);
  }
  res.json({ photos: rows.map((r) => ({ ...r, caption: decrypt(r.caption), url: `/uploads/${req.user.uid}/${r.filename}` })) });
});

// POST /api/photos  (multipart: photo, week, caption)
router.post('/', upload.single('photo'), async (req, res) => {
  const week = Number(req.body.week);
  if (!isValidWeek(week)) return res.status(400).json({ error: 'Semana inválida (1 a 52).' });
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada.' });

  const count = db.prepare('SELECT COUNT(*) AS n FROM photos WHERE user_id = ? AND week = ?').get(req.user.uid, week).n;
  if (count >= config.maxPhotosPerWeek) {
    return res.status(409).json({ error: `Limite de ${config.maxPhotosPerWeek} fotos nesta semana já atingido.` });
  }

  const filename = `w${String(week).padStart(2, '0')}-${crypto.randomBytes(6).toString('hex')}.jpg`;
  const dest = path.join(userDir(req.user.uid), filename);

  try {
    // Compressão automática: redimensiona e converte para JPEG otimizado.
    await sharp(req.file.buffer)
      .rotate() // respeita a orientação EXIF do celular
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(dest);
  } catch (err) {
    return res.status(422).json({ error: 'Não foi possível processar a imagem.' });
  }

  const caption = String(req.body.caption || '').slice(0, 280);
  const info = db
    .prepare('INSERT INTO photos (user_id, week, filename, original, caption) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.uid, week, filename, req.file.originalname?.slice(0, 200) || null, caption ? encrypt(caption) : null);

  res.status(201).json({
    photo: { id: info.lastInsertRowid, week, filename, caption, url: `/uploads/${req.user.uid}/${filename}` },
  });
});

// PATCH /api/photos/:id  { caption }
router.patch('/:id', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND user_id = ?').get(req.params.id, req.user.uid);
  if (!photo) return res.status(404).json({ error: 'Foto não encontrada.' });
  const caption = String(req.body.caption || '').slice(0, 280);
  db.prepare('UPDATE photos SET caption = ? WHERE id = ?').run(caption ? encrypt(caption) : null, photo.id);
  res.json({ ok: true });
});

// DELETE /api/photos/:id
router.delete('/:id', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND user_id = ?').get(req.params.id, req.user.uid);
  if (!photo) return res.status(404).json({ error: 'Foto não encontrada.' });
  db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
  fs.rm(path.join(userDir(req.user.uid), photo.filename), { force: true }, () => {});
  res.json({ ok: true });
});

export default router;

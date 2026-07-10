import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../auth-middleware.js';
import { config } from '../config.js';

const router = Router();
fs.mkdirSync(config.paths.content, { recursive: true });

const SECTIONS = new Set(['papernow', 'marilia']);
const KINDS = new Set(['pdf', 'video', 'link']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Envie um arquivo PDF.'));
  },
});

function publicItem(row) {
  return {
    id: row.id, section: row.section, kind: row.kind, title: row.title,
    description: row.description, badge: row.badge,
    url: row.kind === 'pdf' ? `/api/content/${row.id}/file` : row.url,
  };
}

// ---- Cliente: listar conteúdos de uma seção ----
router.get('/', requireAuth, (req, res) => {
  const section = SECTIONS.has(req.query.section) ? req.query.section : 'papernow';
  const rows = db.prepare('SELECT * FROM content WHERE section = ? ORDER BY position ASC, created_at DESC').all(section);
  res.json({ section, items: rows.map(publicItem) });
});

// ---- Cliente: baixar/abrir um PDF exclusivo (autenticado) ----
router.get('/:id/file', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
  if (!row || row.kind !== 'pdf' || !row.filename) return res.status(404).json({ error: 'Conteúdo não encontrado.' });
  const file = path.join(config.paths.content, row.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Arquivo indisponível.' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${(row.title || 'material').replace(/[^\w.-]/g, '_')}.pdf"`);
  fs.createReadStream(file).pipe(res);
});

// ---- Admin: adicionar conteúdo (PDF via upload, ou vídeo/link via url) ----
router.post('/', requireAdmin, upload.single('file'), (req, res) => {
  const section = SECTIONS.has(req.body.section) ? req.body.section : 'papernow';
  const kind = KINDS.has(req.body.kind) ? req.body.kind : (req.file ? 'pdf' : 'link');
  const title = String(req.body.title || '').trim().slice(0, 160);
  if (!title) return res.status(400).json({ error: 'Informe um título.' });
  const description = String(req.body.description || '').slice(0, 600) || null;
  const badge = String(req.body.badge || '').slice(0, 30) || null;
  const position = Number(req.body.position) || 0;

  let filename = null;
  let url = String(req.body.url || '').trim().slice(0, 500) || null;
  if (kind === 'pdf') {
    if (!req.file) return res.status(400).json({ error: 'Envie o arquivo PDF.' });
    filename = `${section}-${crypto.randomBytes(6).toString('hex')}.pdf`;
    fs.writeFileSync(path.join(config.paths.content, filename), req.file.buffer);
    url = null;
  } else if (!url) {
    return res.status(400).json({ error: 'Informe a URL do vídeo/material.' });
  }

  const info = db
    .prepare('INSERT INTO content (section, kind, title, description, url, filename, badge, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(section, kind, title, description, url, filename, badge, position);
  res.status(201).json({ item: publicItem(db.prepare('SELECT * FROM content WHERE id = ?').get(info.lastInsertRowid)) });
});

// ---- Admin: remover conteúdo ----
router.delete('/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Conteúdo não encontrado.' });
  if (row.filename) fs.rm(path.join(config.paths.content, row.filename), { force: true }, () => {});
  db.prepare('DELETE FROM content WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

export default router;

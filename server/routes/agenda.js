import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth-middleware.js';
import { encrypt, decrypt } from '../crypto.js';

const router = Router();
router.use(requireAuth);

const cleanColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? String(c) : null);
const open = (e) => ({ ...e, title: decrypt(e.title) });

// GET /api/agenda?from=&to=  ou ?date=
router.get('/', (req, res) => {
  const clauses = ['user_id = ?'];
  const params = [req.user.uid];
  if (req.query.date) { clauses.push('event_date = ?'); params.push(String(req.query.date)); }
  if (req.query.from) { clauses.push('event_date >= ?'); params.push(String(req.query.from)); }
  if (req.query.to) { clauses.push('event_date <= ?'); params.push(String(req.query.to)); }
  const rows = db.prepare(`SELECT id, event_date, title, color, done, position FROM agenda WHERE ${clauses.join(' AND ')} ORDER BY event_date, position, id`).all(...params).map(open);
  res.json({ events: rows });
});

// POST /api/agenda  { event_date, title, color }
router.post('/', (req, res) => {
  const date = String(req.body.event_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Data inválida.' });
  const title = String(req.body.title || '').trim().slice(0, 200);
  if (!title) return res.status(400).json({ error: 'Escreva o compromisso.' });
  const color = cleanColor(req.body.color);
  const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM agenda WHERE user_id = ? AND event_date = ?').get(req.user.uid, date).p;
  const info = db.prepare('INSERT INTO agenda (user_id, event_date, title, color, position) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.uid, date, encrypt(title), color, pos);
  res.status(201).json({ event: open(db.prepare('SELECT id, event_date, title, color, done, position FROM agenda WHERE id = ?').get(info.lastInsertRowid)) });
});

// PUT /api/agenda/:id  { title, color, done }
router.put('/:id', (req, res) => {
  const ev = db.prepare('SELECT * FROM agenda WHERE id = ? AND user_id = ?').get(req.params.id, req.user.uid);
  if (!ev) return res.status(404).json({ error: 'Compromisso não encontrado.' });
  const title = req.body.title != null ? encrypt(String(req.body.title).slice(0, 200)) : ev.title;
  const color = req.body.color !== undefined ? cleanColor(req.body.color) : ev.color;
  const done = req.body.done !== undefined ? (req.body.done ? 1 : 0) : ev.done;
  db.prepare('UPDATE agenda SET title = ?, color = ?, done = ? WHERE id = ?').run(title, color, done, ev.id);
  res.json({ event: open(db.prepare('SELECT id, event_date, title, color, done, position FROM agenda WHERE id = ?').get(ev.id)) });
});

// DELETE /api/agenda/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM agenda WHERE id = ? AND user_id = ?').run(req.params.id, req.user.uid);
  if (!info.changes) return res.status(404).json({ error: 'Compromisso não encontrado.' });
  res.json({ ok: true });
});

export default router;

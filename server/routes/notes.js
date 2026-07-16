import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth-middleware.js';
import { isValidWeek } from '../weeks.js';
import { encrypt, decrypt } from '../crypto.js';

const router = Router();
router.use(requireAuth);

const KINDS = new Set(['diaria', 'semanal', 'livre']);

// Descriptografa os campos de texto de uma anotação para o dono.
function open(note) {
  if (!note) return note;
  return { ...note, title: decrypt(note.title), body: decrypt(note.body) };
}

// GET /api/notes?q=&kind=&week=&date=
router.get('/', (req, res) => {
  const clauses = ['user_id = ?'];
  const params = [req.user.uid];

  if (req.query.kind && KINDS.has(req.query.kind)) { clauses.push('kind = ?'); params.push(req.query.kind); }
  if (req.query.week && isValidWeek(Number(req.query.week))) { clauses.push('week = ?'); params.push(Number(req.query.week)); }
  if (req.query.date) { clauses.push('note_date = ?'); params.push(String(req.query.date)); }
  if (req.query.from) { clauses.push('note_date >= ?'); params.push(String(req.query.from)); }
  if (req.query.to) { clauses.push('note_date <= ?'); params.push(String(req.query.to)); }

  const rows = db
    .prepare(`SELECT id, kind, title, body, note_date, week, color, done, created_at, updated_at
              FROM notes WHERE ${clauses.join(' AND ')} ORDER BY done ASC, updated_at DESC LIMIT 1000`)
    .all(...params)
    .map(open);

  // Busca por palavras: feita após descriptografar (os campos ficam cifrados no banco).
  let notes = rows;
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase().slice(0, 100);
    notes = rows.filter((n) => `${n.title || ''} ${n.body || ''}`.toLowerCase().includes(q));
  }
  res.json({ notes: notes.slice(0, 500) });
});

// GET /api/notes/:id
router.get('/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.uid);
  if (!note) return res.status(404).json({ error: 'Anotação não encontrada.' });
  res.json({ note: open(note) });
});

// Cor da categoria: aceita um hex curto da paleta (ou null).
function cleanColor(c) {
  const s = String(c || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : null;
}

// POST /api/notes
router.post('/', (req, res) => {
  const kind = KINDS.has(req.body.kind) ? req.body.kind : 'livre';
  const title = String(req.body.title || '').slice(0, 200);
  const body = String(req.body.body || '').slice(0, 20000);
  const note_date = kind === 'diaria' ? (req.body.note_date || null) : (req.body.note_date || null);
  const week = kind === 'semanal' && isValidWeek(Number(req.body.week)) ? Number(req.body.week) : null;
  const color = cleanColor(req.body.color);

  const info = db
    .prepare('INSERT INTO notes (user_id, kind, title, body, note_date, week, color) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.user.uid, kind, title ? encrypt(title) : null, encrypt(body), note_date, week, color);
  res.status(201).json({ note: open(db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid)) });
});

// PUT /api/notes/:id
router.put('/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.uid);
  if (!note) return res.status(404).json({ error: 'Anotação não encontrada.' });

  const kind = KINDS.has(req.body.kind) ? req.body.kind : note.kind;
  // Campos de texto: se vier novo valor, cifra; senão mantém o já cifrado no banco.
  const title = req.body.title != null ? (String(req.body.title).slice(0, 200) ? encrypt(String(req.body.title).slice(0, 200)) : null) : note.title;
  const body = req.body.body != null ? encrypt(String(req.body.body).slice(0, 20000)) : note.body;
  const note_date = req.body.note_date !== undefined ? req.body.note_date : note.note_date;
  const week = kind === 'semanal' && isValidWeek(Number(req.body.week)) ? Number(req.body.week) : note.week;
  const color = req.body.color !== undefined ? cleanColor(req.body.color) : note.color;
  const done = req.body.done !== undefined ? (req.body.done ? 1 : 0) : note.done;

  db.prepare("UPDATE notes SET kind=?, title=?, body=?, note_date=?, week=?, color=?, done=?, updated_at=datetime('now') WHERE id=?")
    .run(kind, title, body, note_date || null, week, color, done, note.id);
  res.json({ note: open(db.prepare('SELECT * FROM notes WHERE id = ?').get(note.id)) });
});

// PATCH /api/notes/:id/done  { done }
router.patch('/:id/done', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.uid);
  if (!note) return res.status(404).json({ error: 'Anotação não encontrada.' });
  db.prepare("UPDATE notes SET done=?, updated_at=datetime('now') WHERE id=?").run(req.body.done ? 1 : 0, note.id);
  res.json({ ok: true });
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.uid);
  if (!info.changes) return res.status(404).json({ error: 'Anotação não encontrada.' });
  res.json({ ok: true });
});

export default router;

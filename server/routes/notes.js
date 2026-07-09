import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth-middleware.js';
import { isValidWeek } from '../weeks.js';

const router = Router();
router.use(requireAuth);

const KINDS = new Set(['diaria', 'semanal', 'livre']);

// GET /api/notes?q=&kind=&week=&date=
router.get('/', (req, res) => {
  const clauses = ['user_id = ?'];
  const params = [req.user.uid];

  if (req.query.kind && KINDS.has(req.query.kind)) {
    clauses.push('kind = ?');
    params.push(req.query.kind);
  }
  if (req.query.week && isValidWeek(Number(req.query.week))) {
    clauses.push('week = ?');
    params.push(Number(req.query.week));
  }
  if (req.query.date) {
    clauses.push('note_date = ?');
    params.push(String(req.query.date));
  }
  if (req.query.q) {
    // Busca por palavras (título + corpo)
    clauses.push('(title LIKE ? OR body LIKE ?)');
    const like = `%${String(req.query.q).slice(0, 100)}%`;
    params.push(like, like);
  }

  const rows = db
    .prepare(`SELECT id, kind, title, body, note_date, week, created_at, updated_at
              FROM notes WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC LIMIT 500`)
    .all(...params);
  res.json({ notes: rows });
});

// GET /api/notes/:id
router.get('/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.uid);
  if (!note) return res.status(404).json({ error: 'Anotação não encontrada.' });
  res.json({ note });
});

// POST /api/notes
router.post('/', (req, res) => {
  const kind = KINDS.has(req.body.kind) ? req.body.kind : 'livre';
  const title = String(req.body.title || '').slice(0, 200);
  const body = String(req.body.body || '').slice(0, 20000);
  const note_date = kind === 'diaria' ? (req.body.note_date || null) : (req.body.note_date || null);
  const week = kind === 'semanal' && isValidWeek(Number(req.body.week)) ? Number(req.body.week) : null;

  const info = db
    .prepare('INSERT INTO notes (user_id, kind, title, body, note_date, week) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.uid, kind, title || null, body, note_date, week);
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ note });
});

// PUT /api/notes/:id
router.put('/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.uid);
  if (!note) return res.status(404).json({ error: 'Anotação não encontrada.' });

  const kind = KINDS.has(req.body.kind) ? req.body.kind : note.kind;
  const title = req.body.title != null ? String(req.body.title).slice(0, 200) : note.title;
  const body = req.body.body != null ? String(req.body.body).slice(0, 20000) : note.body;
  const note_date = req.body.note_date !== undefined ? req.body.note_date : note.note_date;
  const week = kind === 'semanal' && isValidWeek(Number(req.body.week)) ? Number(req.body.week) : note.week;

  db.prepare("UPDATE notes SET kind=?, title=?, body=?, note_date=?, week=?, updated_at=datetime('now') WHERE id=?")
    .run(kind, title || null, body, note_date || null, week, note.id);
  res.json({ note: db.prepare('SELECT * FROM notes WHERE id = ?').get(note.id) });
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.uid);
  if (!info.changes) return res.status(404).json({ error: 'Anotação não encontrada.' });
  res.json({ ok: true });
});

export default router;

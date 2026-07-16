import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth-middleware.js';

const router = Router();
router.use(requireAuth);

// Paleta fixa de cores; a cliente dá o nome/significado de cada uma.
const PALETTE = ['#c98a8a', '#7d94b0', '#8aa17d', '#a58ab0', '#c9a15f'];
const DEFAULT_LEGEND = { '#c98a8a': 'Pessoal', '#7d94b0': 'Profissional', '#8aa17d': 'Família', '#a58ab0': 'Particular', '#c9a15f': 'Ideias' };

// ---- Legenda de cores ----
router.get('/legend', (req, res) => {
  const row = db.prepare('SELECT color_legend FROM users WHERE id = ?').get(req.user.uid);
  let legend = DEFAULT_LEGEND;
  try { if (row && row.color_legend) legend = { ...DEFAULT_LEGEND, ...JSON.parse(row.color_legend) }; } catch { /* usa padrão */ }
  res.json({ palette: PALETTE, legend });
});

router.put('/legend', (req, res) => {
  const input = req.body.legend || {};
  const legend = {};
  for (const c of PALETTE) legend[c] = String(input[c] ?? DEFAULT_LEGEND[c] ?? '').slice(0, 24);
  db.prepare('UPDATE users SET color_legend = ? WHERE id = ?').run(JSON.stringify(legend), req.user.uid);
  res.json({ ok: true, legend });
});

// ---- Pagamentos do mês (lista + check, sem cálculos) ----
router.get('/payments', (req, res) => {
  const ym = /^\d{4}-\d{2}$/.test(req.query.ym) ? req.query.ym : new Date().toISOString().slice(0, 7);
  const items = db.prepare('SELECT id, title, position FROM payments WHERE user_id = ? ORDER BY position ASC, id ASC').all(req.user.uid);
  const paid = new Set(db.prepare('SELECT payment_id FROM payment_checks WHERE user_id = ? AND ym = ?').all(req.user.uid, ym).map((r) => r.payment_id));
  res.json({ ym, items: items.map((i) => ({ ...i, paid: paid.has(i.id) })) });
});

router.post('/payments', (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 80);
  if (!title) return res.status(400).json({ error: 'Informe o nome do pagamento.' });
  const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM payments WHERE user_id = ?').get(req.user.uid).p;
  const info = db.prepare('INSERT INTO payments (user_id, title, position) VALUES (?, ?, ?)').run(req.user.uid, title, pos);
  res.status(201).json({ item: { id: info.lastInsertRowid, title, position: pos, paid: false } });
});

router.delete('/payments/:id', (req, res) => {
  const info = db.prepare('DELETE FROM payments WHERE id = ? AND user_id = ?').run(req.params.id, req.user.uid);
  if (!info.changes) return res.status(404).json({ error: 'Pagamento não encontrado.' });
  res.json({ ok: true });
});

// Marca/desmarca um pagamento como pago num mês.
router.put('/payments/:id/check', (req, res) => {
  const ym = /^\d{4}-\d{2}$/.test(req.body.ym) ? req.body.ym : new Date().toISOString().slice(0, 7);
  const item = db.prepare('SELECT id FROM payments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.uid);
  if (!item) return res.status(404).json({ error: 'Pagamento não encontrado.' });
  if (req.body.paid) {
    db.prepare('INSERT OR IGNORE INTO payment_checks (user_id, payment_id, ym) VALUES (?, ?, ?)').run(req.user.uid, item.id, ym);
  } else {
    db.prepare('DELETE FROM payment_checks WHERE payment_id = ? AND ym = ?').run(item.id, ym);
  }
  res.json({ ok: true, paid: !!req.body.paid });
});

export default router;

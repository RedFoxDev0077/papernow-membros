import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth-middleware.js';
import { buildWeeks } from '../weeks.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth);

// GET /api/retrospectiva — reúne fotos e anotações do ano num resumo visual.
router.get('/', (req, res) => {
  const uid = req.user.uid;
  const weeks = buildWeeks();
  const monthOf = Object.fromEntries(weeks.map((w) => [w.week, { month: w.month, monthName: w.monthName }]));

  const photos = db.prepare('SELECT week, filename, caption, created_at FROM photos WHERE user_id = ? ORDER BY week, created_at').all(uid);
  const notes = db.prepare('SELECT kind, title, body, note_date, week, color FROM notes WHERE user_id = ? ORDER BY created_at').all(uid);

  const weeksWithPhotos = new Set(photos.map((p) => p.week));

  // Fotos agrupadas por mês (mosaico)
  const byMonth = {};
  for (const p of photos) {
    const m = monthOf[p.week]?.month || 1;
    (byMonth[m] ||= { month: m, monthName: monthOf[p.week]?.monthName || '', photos: [] })
      .photos.push({ week: p.week, url: `/uploads/${uid}/${p.filename}`, caption: p.caption });
  }
  const months = Object.values(byMonth).sort((a, b) => a.month - b.month);

  // Alguns destaques de anotações (com título ou texto)
  const highlights = notes
    .filter((n) => (n.title && n.title.trim()) || (n.body && n.body.trim()))
    .slice(-6)
    .reverse()
    .map((n) => ({ title: n.title, body: (n.body || '').slice(0, 160), week: n.week, note_date: n.note_date, color: n.color }));

  res.json({
    year: config.plannerYear,
    user: { name: req.user.name || null },
    totals: {
      photos: photos.length,
      notes: notes.length,
      weeksRegistered: weeksWithPhotos.size,
      totalWeeks: weeks.length,
    },
    months,
    highlights,
    cover: photos.length ? `/uploads/${uid}/${photos[0].filename}` : null,
  });
});

export default router;

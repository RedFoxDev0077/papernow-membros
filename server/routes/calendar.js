import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth-middleware.js';
import { buildWeeks, weeksByMonth } from '../weeks.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth);

// GET /api/calendar — 52 semanas + quantas fotos/notas a cliente já tem em cada uma
router.get('/', (req, res) => {
  const weeks = buildWeeks();
  const photoCounts = db
    .prepare('SELECT week, COUNT(*) AS n FROM photos WHERE user_id = ? GROUP BY week')
    .all(req.user.uid);
  const noteCounts = db
    .prepare("SELECT week, COUNT(*) AS n FROM notes WHERE user_id = ? AND kind = 'semanal' AND week IS NOT NULL GROUP BY week")
    .all(req.user.uid);

  const pMap = Object.fromEntries(photoCounts.map((r) => [r.week, r.n]));
  const nMap = Object.fromEntries(noteCounts.map((r) => [r.week, r.n]));

  res.json({
    year: config.plannerYear,
    maxPhotosPerWeek: config.maxPhotosPerWeek,
    months: weeksByMonth(),
    weeks: weeks.map((w) => ({ ...w, photos: pMap[w.week] || 0, notes: nMap[w.week] || 0 })),
  });
});

export default router;

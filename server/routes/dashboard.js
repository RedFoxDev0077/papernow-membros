import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth-middleware.js';
import { currentWeek } from '../weeks.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth);

// Frases inspiradoras (rotacionam por dia) — a "voz" da Papernow.
const QUOTES = [
  'Um dia planejado cabe mais vida dentro.',
  'Cada pequena ação de hoje é o que constrói o seu melhor ano.',
  'Planeje menos para sobreviver. Planeje mais para viver.',
  'O seu Master Planner vai muito além do papel.',
  'Uma semana de cada vez, uma memória de cada vez.',
];

// GET /api/dashboard — resumo para a tela Início
router.get('/', (req, res) => {
  const uid = req.user.uid;
  const week = currentWeek();

  const photosThisWeek = db
    .prepare('SELECT COUNT(*) AS n FROM photos WHERE user_id = ? AND week = ?')
    .get(uid, week.week).n;

  const notesTotal = db.prepare('SELECT COUNT(*) AS n FROM notes WHERE user_id = ?').get(uid).n;
  const photosTotal = db.prepare('SELECT COUNT(*) AS n FROM photos WHERE user_id = ?').get(uid).n;

  const recentNotes = db
    .prepare('SELECT id, kind, title, body, note_date, week, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 3')
    .all(uid);

  const recentPhotos = db
    .prepare('SELECT week, filename FROM photos WHERE user_id = ? ORDER BY created_at DESC LIMIT 4')
    .all(uid)
    .map((p) => ({ week: p.week, url: `/uploads/${uid}/${p.filename}` }));

  // "Progresso da semana": registrou foto? tem anotação da semana?
  const weekNotes = db
    .prepare("SELECT COUNT(*) AS n FROM notes WHERE user_id = ? AND ((kind='semanal' AND week=?) OR (kind='diaria' AND note_date BETWEEN ? AND ?))")
    .get(uid, week.week, week.startDate, week.endDate).n;

  const steps = [
    photosThisWeek > 0,
    weekNotes > 0,
    photosThisWeek >= config.maxPhotosPerWeek,
  ];
  const progress = Math.round((steps.filter(Boolean).length / steps.length) * 100);

  const quote = QUOTES[new Date().getUTCDate() % QUOTES.length];

  res.json({
    user: { name: req.user.name || null, email: req.user.email },
    week: { ...week, photos: photosThisWeek, maxPhotos: config.maxPhotosPerWeek },
    progress,
    totals: { notes: notesTotal, photos: photosTotal },
    recentNotes,
    recentPhotos,
    quote,
  });
});

export default router;

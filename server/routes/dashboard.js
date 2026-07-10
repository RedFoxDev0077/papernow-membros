import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth-middleware.js';
import { currentWeek } from '../weeks.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth);

// Frases inspiradoras — uma para cada mês do ano (a "voz" da Papernow).
const QUOTES = [
  'Um novo ano é uma página em branco. Escreva com intenção.',        // Jan
  'Constância é mais bonita que pressa.',                             // Fev
  'Floresça no seu tempo — cada semana tem o seu propósito.',         // Mar
  'Cada pequena ação de hoje constrói o seu melhor ano.',             // Abr
  'Cuidar de você também é planejamento.',                            // Mai
  'No meio do ano, respire: você já veio longe.',                     // Jun
  'Um dia planejado cabe mais vida dentro.',                          // Jul
  'Planeje menos para sobreviver. Planeje mais para viver.',          // Ago
  'Recomeços não têm data certa — todo dia é um bom começo.',         // Set
  'Colha o que plantou e semeie o que ainda sonha.',                  // Out
  'Gratidão transforma o que temos em suficiente.',                   // Nov
  'Feche o ano com carinho pela sua própria jornada.',                // Dez
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

  const dbUser = db.prepare('SELECT motto FROM users WHERE id = ?').get(uid);
  const customMotto = dbUser && dbUser.motto ? dbUser.motto : null;
  const quote = customMotto || QUOTES[new Date().getUTCMonth() % QUOTES.length];

  res.json({
    user: { name: req.user.name || null, email: req.user.email },
    week: { ...week, photos: photosThisWeek, maxPhotos: config.maxPhotosPerWeek },
    progress,
    totals: { notes: notesTotal, photos: photosTotal },
    recentNotes,
    recentPhotos,
    quote,
    customMotto,
  });
});

// PUT /api/dashboard/motto  { motto }  — frase de inspiração da própria cliente
router.put('/motto', (req, res) => {
  const motto = String(req.body.motto || '').trim().slice(0, 160) || null;
  db.prepare('UPDATE users SET motto = ? WHERE id = ?').run(motto, req.user.uid);
  res.json({ ok: true, motto });
});

export default router;

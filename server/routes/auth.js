import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db, normalizeEmail, normalizeCpf } from '../db.js';
import { issueSession, clearSession, requireAuth } from '../auth-middleware.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Verifica se a pessoa consta como compradora (por e-mail OU CPF).
function findBuyer(email, cpf) {
  if (email) {
    const byEmail = db.prepare('SELECT * FROM buyers WHERE email = ?').get(email);
    if (byEmail) return byEmail;
  }
  if (cpf) {
    const byCpf = db.prepare('SELECT * FROM buyers WHERE cpf = ?').get(cpf);
    if (byCpf) return byCpf;
  }
  return null;
}

// POST /api/auth/check-access — valida se comprou antes de deixar cadastrar
router.post('/check-access', authLimiter, (req, res) => {
  const email = normalizeEmail(req.body.email);
  const cpf = normalizeCpf(req.body.cpf);
  if (!email && !cpf) return res.status(400).json({ error: 'Informe e-mail ou CPF.' });
  const buyer = findBuyer(email, cpf);
  if (!buyer) {
    return res.status(403).json({
      allowed: false,
      error: 'Não encontramos a sua compra do Master Planner 2027 com estes dados.',
    });
  }
  res.json({ allowed: true });
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const cpf = normalizeCpf(req.body.cpf);
  const name = String(req.body.name || '').trim().slice(0, 120);
  const password = String(req.body.password || '');

  if (!isValidEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (password.length < 8) return res.status(400).json({ error: 'A senha precisa de pelo menos 8 caracteres.' });

  // Exclusividade: só cadastra quem comprou o Master Planner 2027.
  const buyer = findBuyer(email, cpf);
  if (!buyer) {
    return res.status(403).json({
      error: 'Não encontramos a sua compra do Master Planner 2027. Use o e-mail ou CPF da compra.',
    });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Já existe uma conta com este e-mail. Faça login.' });

  const password_hash = await bcrypt.hash(password, 12);
  const info = db
    .prepare('INSERT INTO users (email, cpf, name, password_hash) VALUES (?, ?, ?, ?)')
    .run(email, cpf || buyer.cpf || null, name || null, password_hash);
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(info.lastInsertRowid);

  issueSession(res, user);
  res.status(201).json({ user });
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  issueSession(res, user);
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.uid);
  if (!user) return res.status(401).json({ error: 'Sessão inválida.' });
  res.json({ user });
});

// POST /api/auth/forgot — gera token de recuperação (envio de e-mail: ver README/TODO SMTP)
router.post('/forgot', authLimiter, (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Resposta genérica para não revelar quais e-mails existem.
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)')
      .run(user.id, token, expires);
    // TODO(SMTP): enviar por e-mail. Enquanto não há SMTP, logamos o link no servidor.
    console.log(`[recuperação de senha] ${email} -> /reset?token=${token}`);
  }
  res.json({ ok: true, message: 'Se o e-mail existir, enviaremos as instruções de recuperação.' });
});

// POST /api/auth/reset
router.post('/reset', authLimiter, async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (password.length < 8) return res.status(400).json({ error: 'A senha precisa de pelo menos 8 caracteres.' });
  const row = db.prepare('SELECT * FROM password_resets WHERE token = ?').get(token);
  if (!row || row.used || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Link de recuperação inválido ou expirado.' });
  }
  const hash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

export default router;

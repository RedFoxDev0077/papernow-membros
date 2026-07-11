import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { db, normalizeEmail, normalizeCpf } from '../db.js';
import { issueSession, clearSession, requireAuth } from '../auth-middleware.js';
import { encrypt, decrypt } from '../crypto.js';
import { config } from '../config.js';

authenticator.options = { window: 1 }; // tolera 1 janela de tempo (relógio um pouco fora)

const router = Router();

// Gera e guarda (com hash) novos códigos de recuperação; devolve os códigos em texto UMA vez.
async function generateRecoveryCodes(uid, n = 8) {
  db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(uid);
  const ins = db.prepare('INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)');
  const codes = [];
  for (let i = 0; i < n; i++) {
    const raw = crypto.randomBytes(5).toString('hex'); // 10 hex
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    ins.run(uid, await bcrypt.hash(raw, 10));
  }
  return codes;
}
const normalizeCode = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Verifica um código de recuperação; consome-o se válido.
async function consumeRecoveryCode(uid, input) {
  const norm = normalizeCode(input);
  if (norm.length < 8) return false;
  const rows = db.prepare('SELECT id, code_hash FROM recovery_codes WHERE user_id = ? AND used = 0').all(uid);
  for (const r of rows) {
    if (await bcrypt.compare(norm, r.code_hash)) {
      db.prepare('UPDATE recovery_codes SET used = 1 WHERE id = ?').run(r.id);
      return true;
    }
  }
  return false;
}

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

  issueSession(req, res, user);
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
  // Se a cliente ativou a verificação em 2 fatores, pede o código antes da sessão.
  if (user.totp_enabled) {
    const ticket = jwt.sign({ uid: user.id, pending2fa: true }, config.jwtSecret, { expiresIn: '5m' });
    return res.json({ twofa: true, ticket });
  }
  issueSession(req, res, user);
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// POST /api/auth/login/2fa  { ticket, code }  — aceita código do app OU de recuperação
router.post('/login/2fa', authLimiter, async (req, res) => {
  let payload;
  try { payload = jwt.verify(String(req.body.ticket || ''), config.jwtSecret); }
  catch { return res.status(401).json({ error: 'Sessão de verificação expirada. Entre novamente.' }); }
  if (!payload.pending2fa) return res.status(400).json({ error: 'Verificação inválida.' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
  if (!user || !user.totp_enabled) return res.status(400).json({ error: 'Verificação indisponível.' });

  const code = String(req.body.code || '').replace(/\s/g, '');
  const okTotp = authenticator.check(code, decrypt(user.totp_secret));
  const okRecovery = okTotp ? false : await consumeRecoveryCode(user.id, req.body.code);
  if (!okTotp && !okRecovery) {
    return res.status(401).json({ error: 'Código incorreto. Tente novamente.' });
  }
  issueSession(req, res, user);
  res.json({ user: { id: user.id, email: user.email, name: user.name }, usedRecovery: okRecovery });
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

// ---- Verificação em 2 fatores (TOTP) ----

// GET /api/auth/2fa/status
router.get('/2fa/status', requireAuth, (req, res) => {
  const u = db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(req.user.uid);
  const remaining = db.prepare('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used = 0').get(req.user.uid).n;
  res.json({ enabled: !!(u && u.totp_enabled), recoveryRemaining: remaining });
});

// POST /api/auth/2fa/setup — gera o segredo e o QR code para o app autenticador
router.post('/2fa/setup', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  const secret = authenticator.generateSecret();
  db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(encrypt(secret), user.id);
  const otpauth = authenticator.keyuri(user.email, 'Papernow', secret);
  const qr = await QRCode.toDataURL(otpauth, { margin: 1, color: { dark: '#4a3f35', light: '#fbf7ef' } });
  res.json({ secret, otpauth, qr });
});

// POST /api/auth/2fa/enable  { code } — confirma o código, ativa o 2FA e gera os códigos de recuperação
router.post('/2fa/enable', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  if (!user.totp_secret) return res.status(400).json({ error: 'Comece a configuração primeiro.' });
  const code = String(req.body.code || '').replace(/\s/g, '');
  if (!authenticator.check(code, decrypt(user.totp_secret))) {
    return res.status(400).json({ error: 'Código incorreto. Confira o app autenticador.' });
  }
  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
  const recovery = await generateRecoveryCodes(user.id);
  res.json({ ok: true, enabled: true, recovery });
});

// POST /api/auth/2fa/recovery — gera novos códigos de recuperação (exige um código atual)
router.post('/2fa/recovery', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  if (!user.totp_enabled) return res.status(400).json({ error: 'Ative a verificação em 2 fatores primeiro.' });
  const code = String(req.body.code || '').replace(/\s/g, '');
  if (!authenticator.check(code, decrypt(user.totp_secret))) {
    return res.status(400).json({ error: 'Código incorreto. Confira o app autenticador.' });
  }
  const recovery = await generateRecoveryCodes(user.id);
  res.json({ ok: true, recovery });
});

// POST /api/auth/2fa/disable  { code } — desativa o 2FA
router.post('/2fa/disable', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  if (!user.totp_enabled) return res.json({ ok: true, enabled: false });
  const code = String(req.body.code || '').replace(/\s/g, '');
  if (!authenticator.check(code, decrypt(user.totp_secret))) {
    return res.status(400).json({ error: 'Código incorreto.' });
  }
  db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(user.id);
  db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(user.id);
  res.json({ ok: true, enabled: false });
});

export default router;

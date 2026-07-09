import jwt from 'jsonwebtoken';
import { config, isProd } from './config.js';

const COOKIE = 'pn_session';

export function issueSession(res, user) {
  const token = jwt.sign(
    { uid: user.id, email: user.email, name: user.name || null },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE);
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

export function requireAdmin(req, res, next) {
  const provided = req.get('x-admin-token');
  if (!provided || provided !== config.adminToken) {
    return res.status(403).json({ error: 'Acesso administrativo negado.' });
  }
  next();
}

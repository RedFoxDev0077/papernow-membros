import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { config, isProd } from './config.js';
import './db.js';

import authRoutes from './routes/auth.js';
import accessRoutes from './routes/access.js';
import calendarRoutes from './routes/calendar.js';
import photoRoutes from './routes/photos.js';
import noteRoutes from './routes/notes.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();
app.disable('x-powered-by');
if (isProd) app.set('trust proxy', 1); // atrás do Nginx na VPS

// Guarda o corpo cru para validar HMAC do webhook Nuvemshop
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Cabeçalhos de segurança básicos
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'papernow-membros' }));

app.use('/api/auth', authRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Fotos das clientes (privadas por pasta de usuário; servidas com cache curto)
app.use('/uploads', express.static(config.paths.uploads, { maxAge: '1h', index: false }));

// Frontend PWA
app.use(express.static(config.paths.public, { index: 'index.html' }));

// SPA fallback (qualquer rota não-API devolve o app)
app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
  res.sendFile(path.join(config.paths.public, 'index.html'));
});

// Tratamento de erros (inclui limites do multer)
app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Imagem muito grande (máx. 25MB).' });
  if (err?.message) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Erro interno.' });
});

app.listen(config.port, () => {
  console.log(`\n  Papernow · Área de Membros`);
  console.log(`  Ambiente: ${config.env}`);
  console.log(`  Rodando em: http://localhost:${config.port}\n`);
});

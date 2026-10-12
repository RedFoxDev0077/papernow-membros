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
import contentRoutes from './routes/content.js';
import retrospectivaRoutes from './routes/retrospectiva.js';
import extrasRoutes from './routes/extras.js';
import agendaRoutes from './routes/agenda.js';
import entrenosRoutes, { IMG_DIR as ENTRENOS_IMG_DIR } from './routes/entrenos.js';
import { renderEntreNos } from './entrenos-page.js';

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
app.use('/api/content', contentRoutes);
app.use('/api/retrospectiva', retrospectivaRoutes);
// Entre Nós tem rotas públicas: precisa vir antes do roteador genérico '/api' (que exige login).
app.use('/api/entrenos', entrenosRoutes);
app.use('/api', extrasRoutes);
app.use('/api/agenda', agendaRoutes);

// Fotos das clientes (privadas por pasta de usuário; servidas com cache curto)
app.use('/uploads', express.static(config.paths.uploads, { maxAge: '1h', index: false }));

// ---- Entre Nós: página pública (entrenos.papernow.com.br, ou /entrenos em qualquer domínio) ----
app.use('/entrenos-media', express.static(ENTRENOS_IMG_DIR, { maxAge: '30d', immutable: true, index: false }));

const isEntreNosHost = (req) => config.entrenosHosts.includes(String(req.hostname || '').toLowerCase());
function sendEntreNos(req, res) {
  // Mantém a origem no Referer ao sair para os links de parceiras (rastreio de afiliada).
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(renderEntreNos());
}
app.get('/entrenos', sendEntreNos);
app.get('/', (req, res, next) => (isEntreNosHost(req) ? sendEntreNos(req, res) : next()));

// Painel de gestão de conteúdo (Papernow)
app.get('/admin', (req, res) => res.sendFile(path.join(config.paths.public, 'admin.html')));

// Frontend PWA
app.use(express.static(config.paths.public, { index: 'index.html' }));

// SPA fallback (qualquer rota não-API devolve o app)
app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
  if (isEntreNosHost(req)) return res.redirect('/');
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

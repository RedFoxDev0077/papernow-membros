import 'dotenv/config';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  plannerYear: Number(process.env.PLANNER_YEAR || 2027),
  // Vazio = calcula automaticamente (semana que contém 1º/jan; 52 ou 53 semanas,
  // sem dias órfãos). Defina uma segunda-feira só se o planner físico usar outra âncora.
  plannerStart: process.env.PLANNER_START || '',
  maxPhotosPerWeek: Number(process.env.MAX_PHOTOS_PER_WEEK || 7),
  nuvemshopWebhookSecret: process.env.NUVEMSHOP_WEBHOOK_SECRET || '',
  adminToken: process.env.ADMIN_TOKEN || 'dev-admin-token',
  // Chave de 32 bytes para criptografia dos dados sensíveis no banco (AES-256-GCM).
  // Use ENCRYPTION_KEY (64 hex) em produção; senão deriva do JWT_SECRET de forma estável.
  encryptionKey: process.env.ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)
    ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
    : crypto.scryptSync(process.env.JWT_SECRET || 'dev-secret-change-me', 'papernow-data-enc', 32),
  paths: {
    root,
    data: path.join(root, 'data'),
    uploads: path.join(root, 'data', 'uploads'),
    content: path.join(root, 'data', 'content'),
    db: path.join(root, 'data', 'papernow.db'),
    public: path.join(root, 'public'),
  },
};

export const isProd = config.env === 'production';

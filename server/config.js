import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  plannerYear: Number(process.env.PLANNER_YEAR || 2027),
  plannerStart: process.env.PLANNER_START || '2027-01-04',
  maxPhotosPerWeek: Number(process.env.MAX_PHOTOS_PER_WEEK || 3),
  nuvemshopWebhookSecret: process.env.NUVEMSHOP_WEBHOOK_SECRET || '',
  adminToken: process.env.ADMIN_TOKEN || 'dev-admin-token',
  paths: {
    root,
    data: path.join(root, 'data'),
    uploads: path.join(root, 'data', 'uploads'),
    db: path.join(root, 'data', 'papernow.db'),
    public: path.join(root, 'public'),
  },
};

export const isProd = config.env === 'production';

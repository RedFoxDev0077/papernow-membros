import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { encrypt, isEncrypted } from './crypto.js';

fs.mkdirSync(config.paths.uploads, { recursive: true });

export const db = new DatabaseSync(config.paths.db);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS buyers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT UNIQUE,
    cpf          TEXT UNIQUE,
    order_ref    TEXT,
    source       TEXT DEFAULT 'manual',       -- 'manual' | 'nuvemshop'
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    cpf           TEXT,
    name          TEXT,
    password_hash TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    expires_at  TEXT NOT NULL,
    used        INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week        INTEGER NOT NULL,
    filename    TEXT NOT NULL,
    original    TEXT,
    caption     TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_photos_user_week ON photos(user_id, week);

  CREATE TABLE IF NOT EXISTS content (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    section     TEXT NOT NULL DEFAULT 'papernow',  -- 'papernow' | 'marilia'
    kind        TEXT NOT NULL DEFAULT 'pdf',        -- 'pdf' | 'video' | 'link'
    title       TEXT NOT NULL,
    description TEXT,
    url         TEXT,                               -- para video/link
    filename    TEXT,                               -- para pdf (arquivo na VPS)
    badge       TEXT,                               -- ex.: "Mensal", "Novo"
    position    INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_content_section ON content(section, position, created_at);

  CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL DEFAULT 'livre',   -- 'diaria' | 'semanal' | 'livre'
    title       TEXT,
    body        TEXT NOT NULL DEFAULT '',
    note_date   TEXT,                            -- YYYY-MM-DD (para 'diaria')
    week        INTEGER,                         -- para 'semanal'
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, updated_at);
`);

// Migrações leves e idempotentes (adiciona colunas novas se ainda não existirem).
function addColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
addColumn('notes', 'color', 'color TEXT');          // categoria por cor
addColumn('notes', 'done', 'done INTEGER DEFAULT 0'); // marcar como resolvida
addColumn('users', 'motto', 'motto TEXT');          // frase de inspiração personalizada
addColumn('users', 'totp_secret', 'totp_secret TEXT');       // 2FA
addColumn('users', 'totp_enabled', 'totp_enabled INTEGER DEFAULT 0');

// Migração única: criptografa dados sensíveis já existentes (idempotente).
function encryptExisting(table, columns) {
  const rows = db.prepare(`SELECT id, ${columns.join(', ')} FROM ${table}`).all();
  const set = columns.map((c) => `${c} = ?`).join(', ');
  const upd = db.prepare(`UPDATE ${table} SET ${set} WHERE id = ?`);
  for (const row of rows) {
    let changed = false;
    const values = columns.map((c) => {
      const v = row[c];
      if (v != null && v !== '' && !isEncrypted(v)) { changed = true; return encrypt(v); }
      return v;
    });
    if (changed) upd.run(...values, row.id);
  }
}
encryptExisting('notes', ['title', 'body']);
encryptExisting('photos', ['caption']);
encryptExisting('users', ['motto']);

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeCpf(cpf) {
  const digits = String(cpf || '').replace(/\D/g, '');
  return digits.length === 11 ? digits : null;
}

import crypto from 'node:crypto';
import { config } from './config.js';

// Criptografia dos dados sensíveis no banco (AES-256-GCM).
// Formato: "enc:v1:" + base64(iv[12] | tag[16] | ciphertext).
// A descriptografia só acontece no servidor, ao servir os dados para a própria dona.
const KEY = config.encryptionKey;
const PREFIX = 'enc:v1:';

export function isEncrypted(v) {
  return typeof v === 'string' && v.startsWith(PREFIX);
}

export function encrypt(plain) {
  if (plain == null || plain === '') return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decrypt(value) {
  if (value == null || !isEncrypted(value)) return value; // texto legado fica como está
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  } catch {
    return value;
  }
}

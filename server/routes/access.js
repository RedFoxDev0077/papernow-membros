import { Router } from 'express';
import crypto from 'node:crypto';
import { db, normalizeEmail, normalizeCpf } from '../db.js';
import { requireAdmin } from '../auth-middleware.js';
import { config } from '../config.js';

const router = Router();

// Registra/atualiza uma compradora na allowlist.
function upsertBuyer({ email, cpf, order_ref, source }) {
  const e = normalizeEmail(email) || null;
  const c = normalizeCpf(cpf);
  if (!e && !c) return null;
  const existing =
    (e && db.prepare('SELECT * FROM buyers WHERE email = ?').get(e)) ||
    (c && db.prepare('SELECT * FROM buyers WHERE cpf = ?').get(c));
  if (existing) {
    db.prepare('UPDATE buyers SET email = COALESCE(?, email), cpf = COALESCE(?, cpf), order_ref = COALESCE(?, order_ref) WHERE id = ?')
      .run(e, c, order_ref || null, existing.id);
    return db.prepare('SELECT * FROM buyers WHERE id = ?').get(existing.id);
  }
  const info = db
    .prepare('INSERT INTO buyers (email, cpf, order_ref, source) VALUES (?, ?, ?, ?)')
    .run(e, c, order_ref || null, source || 'manual');
  return db.prepare('SELECT * FROM buyers WHERE id = ?').get(info.lastInsertRowid);
}

// ---- Admin: gestão manual da allowlist (fallback e importação) ----

// GET /api/access/buyers (admin)
router.get('/buyers', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, email, cpf, order_ref, source, created_at FROM buyers ORDER BY id DESC').all();
  res.json({ buyers: rows, total: rows.length });
});

// POST /api/access/buyers (admin) — { email, cpf, order_ref } ou { buyers: [...] }
router.post('/buyers', requireAdmin, (req, res) => {
  const list = Array.isArray(req.body.buyers) ? req.body.buyers : [req.body];
  const saved = [];
  for (const b of list) {
    const row = upsertBuyer({ ...b, source: 'manual' });
    if (row) saved.push(row);
  }
  res.status(201).json({ saved: saved.length, buyers: saved });
});

// ---- Nuvemshop: webhook de compra (validação automática do acesso) ----
// STUB de integração da Semana 1. A Nuvemshop envia eventos order/paid;
// aqui liberamos o acesso automaticamente. Assinatura verificada por HMAC.
router.post('/nuvemshop/webhook', (req, res) => {
  const secret = config.nuvemshopWebhookSecret;
  if (secret) {
    const signature = req.get('x-linkedstore-hmac-sha256') || '';
    const expected = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest('hex');
    const ok =
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!ok) return res.status(401).json({ error: 'Assinatura inválida.' });
  }

  // O payload real da Nuvemshop traz { id, event, store_id }. Buscar o pedido
  // via API para extrair e-mail/CPF do comprador é o próximo passo da integração.
  // Aqui aceitamos também um payload já resolvido (para testes e para o app da loja).
  const { email, cpf, order_ref, event } = req.body || {};
  if (email || cpf) {
    upsertBuyer({ email, cpf, order_ref, source: 'nuvemshop' });
  }
  // TODO(Nuvemshop): quando vier só { id, event }, chamar a API de pedidos
  // com o token OAuth da loja para resolver o comprador.
  res.json({ received: true, event: event || null });
});

export default router;
export { upsertBuyer };

// Popula a allowlist de compradoras para testes internos.
// Uso: npm run seed
import { db, normalizeEmail, normalizeCpf } from './db.js';

const demoBuyers = [
  { email: 'gabriela@papernow.com.br', cpf: '11144477735', order_ref: 'DEMO-0001' },
  { email: 'cliente.teste@papernow.com.br', cpf: null, order_ref: 'DEMO-0002' },
  { email: 'maria.teste@gmail.com', cpf: '52998224725', order_ref: 'DEMO-0003' },
];

const insert = db.prepare(
  'INSERT OR IGNORE INTO buyers (email, cpf, order_ref, source) VALUES (?, ?, ?, ?)'
);

let n = 0;
for (const b of demoBuyers) {
  const info = insert.run(normalizeEmail(b.email) || null, normalizeCpf(b.cpf), b.order_ref, 'manual');
  n += info.changes;
}

const total = db.prepare('SELECT COUNT(*) AS c FROM buyers').get().c;
console.log(`Seed concluído. ${n} compradora(s) nova(s). Total na allowlist: ${total}.`);
console.log('Você pode cadastrar-se no app usando um destes e-mails/CPFs de teste.');

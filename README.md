# Papernow · Área de Membros — Master Planner 2027 (Fase 1, PWA)

Plataforma exclusiva para clientes que adquiriram o **Master Planner 2027**. Fase 1
entrega o núcleo do produto como **PWA** (instalável no celular, com notificação):

- **Cadastro com validação de compra** — só entra quem comprou (por e-mail ou CPF)
- **Calendário Papernow** — as 52 semanas do ano, navegação por mês, espelhando o planner físico
- **Upload de fotos por semana** — a foto da "semana 8" entra automaticamente na semana 8 (até 3/semana, com compressão automática)
- **Anotações** — diárias, semanais e livres, com busca por palavras
- **PWA** — ícone na tela inicial, tela cheia, base para notificações push
- **Integração Nuvemshop** — webhook que libera o acesso automaticamente na compra (stub pronto para plugar as credenciais da loja)

> Funcionalidade-assinatura: a conexão entre o planner físico e o digital (foto da semana → semana certa do calendário).

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Backend | Node.js + Express | leve, estável, fácil de manter na VPS |
| Banco | SQLite (`node:sqlite`, nativo do Node 22+) | zero servidor de banco para subir; backup = copiar 1 arquivo |
| Auth | bcrypt + JWT em cookie httpOnly | senhas com hash, sessão segura |
| Fotos | multer + sharp | compressão/redimensionamento automático no upload |
| Frontend | PWA em HTML/CSS/JS (sem build) | rápido de subir e de ver ao vivo; identidade Papernow |

Sem etapa de build no frontend — o que está em `public/` é o que roda. Isso deixa o
deploy simples e o progresso visível ao vivo desde o dia 1.

## Rodar localmente

```bash
npm install
cp .env.example .env        # ajuste JWT_SECRET e ADMIN_TOKEN
node server/generate-icons.js   # gera os ícones do PWA
npm run seed                # popula compradoras de teste (opcional)
npm start                   # http://localhost:3000
```

Contas de teste (após `npm run seed`) — cadastre-se com um destes e-mails:
`gabriela@papernow.com.br`, `maria.teste@gmail.com` (CPF `52998224725`).

## Estrutura

```
server/
  index.js            servidor Express + estáticos + fallback SPA
  config.js           configuração via .env
  db.js               schema SQLite (buyers, users, photos, notes, resets)
  weeks.js            gera as 52 semanas do planner
  auth-middleware.js  sessão JWT + guard admin
  routes/
    auth.js           cadastro/login/recuperação + validação de compra
    access.js         allowlist de compradoras + webhook Nuvemshop
    calendar.js       52 semanas + contadores de fotos/notas
    photos.js         upload (sharp) / listar / apagar
    notes.js          CRUD de anotações + busca
  seed.js             compradoras de teste
  generate-icons.js   ícones da marca (PWA)
public/               PWA (index.html, css, js, sw.js, manifest, icons)
data/                 banco SQLite + uploads (NÃO versionar; backup diário)
```

## Segurança (Fase 1)

- Senhas com bcrypt; sessão em cookie httpOnly (`secure` em produção).
- Rate limiting nas rotas de auth.
- Acesso exclusivo: cadastro só para quem consta na allowlist de compradoras.
- Uploads: validação de tipo e tamanho, reprocessamento com sharp (remove metadados).
- Webhook Nuvemshop validado por HMAC (quando o secret está configurado).

**Itens de segurança do PDF que são escopo além da Fase 1 acordada** (ver `../ANALISE-PROJETO.md`),
já com pontos de extensão preparados no código:
- 2FA e login social Google (`routes/auth.js`)
- Criptografia campo-a-campo no banco / LGPD avançada
- Integração completa da API Nuvemshop (resolver comprador a partir do `order id`)

## API (resumo)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/check-access` | valida se comprou (e-mail/CPF) |
| POST | `/api/auth/register` | cadastro (exige compra) |
| POST | `/api/auth/login` `/logout` | sessão |
| GET | `/api/auth/me` | usuário atual |
| POST | `/api/auth/forgot` `/reset` | recuperação de senha |
| GET | `/api/calendar` | 52 semanas + contadores |
| GET/POST/PATCH/DELETE | `/api/photos` | fotos por semana |
| GET/POST/PUT/DELETE | `/api/notes` | anotações + busca (`?q=`) |
| POST | `/api/access/nuvemshop/webhook` | libera acesso na compra |
| GET/POST | `/api/access/buyers` | allowlist (admin, header `x-admin-token`) |

Deploy na VPS Papernow: veja **DEPLOY.md**.

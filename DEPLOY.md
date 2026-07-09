# Deploy na VPS Papernow (Hostinger KVM 1 · Ubuntu 24.04)

Guia para subir a área de membros em `areamembros.papernow.com.br`.
Requisitos já contratados: VPS Hostinger + domínio `papernow.com.br` (Registro.br).

> Segurança: **troque a senha de root** que foi compartilhada no chat e passe a acessar
> por chave SSH. Nunca guarde senhas em texto no repositório.

## 1. DNS (registro A do subdomínio)

No painel do domínio (Registro.br), crie:

```
Tipo: A   Nome: areamembros   Valor: <IP_DA_VPS>   TTL: 3600
```

(IP atual da VPS: `179.197.66.244`.)

## 2. Preparar o servidor

```bash
ssh root@179.197.66.244            # troque para acesso por chave depois

# Node 24 LTS + ferramentas (o app usa node:sqlite, que exige Node >= 23.4)
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs git nginx ufw curl

# Firewall
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable

# Usuário de aplicação (não rodar como root)
adduser --disabled-password --gecos "" papernow
```

## 3. Publicar a aplicação

```bash
su - papernow
git clone <repo-github-privado> app && cd app
npm ci --omit=dev
node server/generate-icons.js
cp .env.example .env && nano .env      # ver seção 4
```

## 4. Variáveis de ambiente (.env)

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=<gere: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
ADMIN_TOKEN=<token forte>
PLANNER_YEAR=2027
PLANNER_START=2027-01-04          # 1ª segunda-feira do ciclo do planner (ajustar ao físico)
MAX_PHOTOS_PER_WEEK=3
NUVEMSHOP_WEBHOOK_SECRET=<secret do webhook da loja>
```

## 5. Serviço (systemd) para manter no ar

`/etc/systemd/system/papernow.service`:

```ini
[Unit]
Description=Papernow Area de Membros
After=network.target

[Service]
Type=simple
User=papernow
WorkingDirectory=/home/papernow/app
ExecStart=/usr/bin/node server/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now papernow
sudo systemctl status papernow
```

## 6. Nginx (proxy reverso) + SSL

`/etc/nginx/sites-available/areamembros`:

```nginx
server {
  server_name areamembros.papernow.com.br;
  client_max_body_size 30M;               # uploads de fotos

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/areamembros /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL grátis (obrigatório para PWA e câmera funcionarem)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d areamembros.papernow.com.br
```

> HTTPS é **obrigatório**: sem ele o PWA não instala e a câmera/notificação não funcionam.

## 7. Backup

A VPS tem backup diário Hostinger contratado. Para backup do app basta salvar a pasta
`data/` (contém `papernow.db` e as fotos):

```bash
tar czf backup-$(date +%F).tgz -C /home/papernow/app data
```

## 8. Atualizações (novas versões)

Com o CI/CD configurado (seção 11), **cada push na branch `main` publica sozinho**.
Para publicar manualmente no servidor, use o mesmo script do pipeline:

```bash
sudo -u papernow bash /home/papernow/app/scripts/deploy.sh
```

## 9. Integração Nuvemshop (Semana 1)

1. Criar app/credenciais na loja Nuvemshop da Papernow (OAuth).
2. Registrar o webhook `order/paid` apontando para
   `https://areamembros.papernow.com.br/api/access/nuvemshop/webhook`.
3. Definir `NUVEMSHOP_WEBHOOK_SECRET` no `.env`.
4. Completar em `routes/access.js` a resolução do comprador via API de pedidos
   (marcado com `TODO(Nuvemshop)`).

Enquanto a integração não está ligada, dá para liberar acesso manualmente pela allowlist:

```bash
curl -X POST https://areamembros.papernow.com.br/api/access/buyers \
  -H "x-admin-token: <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"buyers":[{"email":"cliente@email.com","cpf":"00000000000","order_ref":"NS-123"}]}'
```

## 10. Provisionamento automatizado

Os arquivos de infraestrutura ficam versionados em `deploy/` (systemd, nginx, sudoers)
e o setup base é feito por um script. Depois de apontar o DNS (seção 1):

```bash
# no servidor, como root, após o primeiro clone do repositório:
git clone git@github.com:RedFoxDev0077/papernow-membros.git /home/papernow/app
sudo bash /home/papernow/app/scripts/provision-vps.sh
```

O script instala Node 24, nginx, firewall, cria o usuário `papernow`, instala o serviço
systemd, a regra de sudoers e a config do nginx. Ao final, ele lista os passos manuais
que restam (`.env`, `npm ci`, `certbot`).

## 11. CI/CD — deploy automático a cada push

O pipeline está em `.github/workflows/deploy.yml`:

- **Job `test`** — a cada push/PR: instala dependências, checa a sintaxe de todos os
  arquivos JS e faz um *smoke test* (sobe o servidor e valida `/api/health`).
- **Job `deploy`** — só na branch `main` e só se o `test` passar: conecta na VPS por SSH
  e roda `scripts/deploy.sh` (git reset --hard → `npm ci --omit=dev` → restart → health check).
  Enquanto os *secrets* não estiverem configurados, o deploy é **ignorado** (não quebra o build).

### Secrets do repositório (GitHub → Settings → Secrets and variables → Actions)

| Secret | Valor |
|---|---|
| `VPS_HOST` | IP da VPS (ex.: `179.197.66.244`) |
| `VPS_USER` | `papernow` |
| `VPS_PORT` | `22` |
| `VPS_SSH_KEY` | chave **privada** SSH cujo par público está no `authorized_keys` do usuário `papernow` |

### Chave de deploy (uma vez)

1. **Chave do CI → VPS** (para o Actions logar no servidor):
   ```bash
   ssh-keygen -t ed25519 -C "github-actions" -f ci_deploy -N ""
   # cole o conteúdo de ci_deploy.pub em /home/papernow/.ssh/authorized_keys (no servidor)
   # cole o conteúdo de ci_deploy (privado) no secret VPS_SSH_KEY
   ```
2. **Deploy key da VPS → GitHub** (para o servidor conseguir dar `git fetch` do repo privado):
   ```bash
   sudo -u papernow ssh-keygen -t ed25519 -f /home/papernow/.ssh/id_ed25519 -N ""
   sudo -u papernow cat /home/papernow/.ssh/id_ed25519.pub
   # adicione essa chave em: repo GitHub → Settings → Deploy keys → Add deploy key (read-only)
   ```

Depois disso, todo `git push` na `main` publica na VPS automaticamente. Acompanhe em
**GitHub → Actions**.

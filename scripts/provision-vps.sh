#!/usr/bin/env bash
# Provisionamento único da VPS (Ubuntu 24.04) para a área de membros Papernow.
# Rode como root DEPOIS de clonar o repositório em /home/papernow/app.
#   sudo bash scripts/provision-vps.sh
set -euo pipefail

APP_USER=papernow
APP_DIR="/home/$APP_USER/app"

echo "==> Instalando Node.js 24 LTS + ferramentas"
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs git nginx ufw curl

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Usuário de aplicação"
id -u "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"

echo "==> Serviço systemd"
install -m 644 "$APP_DIR/deploy/papernow.service" /etc/systemd/system/papernow.service
systemctl daemon-reload
systemctl enable papernow

echo "==> Sudoers (deploy pode reiniciar o serviço sem senha)"
install -m 440 "$APP_DIR/deploy/papernow-sudoers" /etc/sudoers.d/papernow
visudo -cf /etc/sudoers.d/papernow

echo "==> Nginx"
install -m 644 "$APP_DIR/deploy/nginx-areamembros.conf" /etc/nginx/sites-available/areamembros
ln -sf /etc/nginx/sites-available/areamembros /etc/nginx/sites-enabled/areamembros
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

cat <<'NEXT'

Provisionamento base concluído. Passos manuais restantes:
  1. Criar o arquivo .env em /home/papernow/app (copie .env.example e defina
     JWT_SECRET e ADMIN_TOKEN fortes; ajuste PLANNER_START e NUVEMSHOP_WEBHOOK_SECRET).
  2. sudo -u papernow bash -c 'cd /home/papernow/app && npm ci --omit=dev'
  3. systemctl start papernow  &&  systemctl status papernow
  4. certbot --nginx -d areamembros.papernow.com.br   (SSL — obrigatório para PWA/câmera)
NEXT

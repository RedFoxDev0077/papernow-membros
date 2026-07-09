#!/usr/bin/env bash
# Deploy da área de membros na VPS. Idempotente e seguro para re-executar.
# Chamado pelo GitHub Actions (via SSH) ou manualmente no servidor.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/papernow/app}"
BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"

cd "$APP_DIR"

echo "==> Buscando a versão mais recente (origin/$BRANCH)"
git fetch --prune origin
git reset --hard "origin/$BRANCH"

echo "==> Instalando dependências de produção"
npm ci --omit=dev

echo "==> Reiniciando o serviço"
sudo systemctl restart papernow

echo "==> Verificando saúde do serviço"
for i in $(seq 1 15); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "OK: serviço no ar (deploy concluído)."
    exit 0
  fi
  sleep 1
done

echo "ERRO: o serviço não respondeu após o restart." >&2
sudo systemctl status papernow --no-pager || true
exit 1

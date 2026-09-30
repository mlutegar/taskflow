#!/usr/bin/env bash
# deploy-vps.sh — Atualiza o taskflow (generalmast) no VPS via SSH, idempotente e
# seguro para um host multi-projeto. Rodar no Git Bash (Windows) ou em qualquer shell.
#
# Faz: empacota o projeto (sem node_modules/.git/.env/etc) -> backup do .env remoto ->
# scp -> extrai SOBRE /root/taskflow SEM tocar no .env -> rebuild só deste projeto
# (APP_COMMIT automático) -> espera ficar healthy -> reporta portas/URL. Portas já
# alocadas (3026 frontend, 3033 api) e os secrets do .env são preservados.
#
# Uso:
#   ./deploy-vps.sh            # build + deploy (pede confirmação)
#   ./deploy-vps.sh -y         # sem confirmação
set -euo pipefail

VPS_IP="${VPS_IP:-179.198.98.180}"
REMOTE_DIR="${REMOTE_DIR:-/root/taskflow}"
KEY="${KEY:-$HOME/.ssh/id_ed25519}"
REMOTE="root@${VPS_IP}"
TAR="taskflow_update_deploy.tar.gz"
SSH_OPTS=(-o StrictHostKeyChecking=no -i "$KEY")

cd "$(dirname "$0")"

cyan() { printf '\033[36m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[31mERRO: %s\033[0m\n' "$1" >&2; exit 1; }

# 1. Commit hash (versão visível no app) + aviso se árvore suja.
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
if [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then
  printf '\033[33mAVISO: working tree com mudanças não commitadas — a versão publicada (%s) pode não refletir o código.\033[0m\n' "$COMMIT"
fi
cyan "APP_COMMIT = $COMMIT"

if [ "${1:-}" != "-y" ]; then
  read -r -p "Deploy do taskflow em ${REMOTE}:${REMOTE_DIR} (commit ${COMMIT})? [s/N] " ans
  case "$ans" in s|S) ;; *) echo "Cancelado."; exit 0;; esac
fi

# 2. Empacota (exclui pesados/segredos).
cyan "Empacotando projeto..."
tar czf "/tmp/$TAR" \
  --exclude='node_modules' --exclude='.git' --exclude='.venv' \
  --exclude='__pycache__' --exclude='*.pyc' --exclude='downloads' \
  --exclude='.env' --exclude='*.tar.gz' --exclude='dist' \
  --exclude='.claude' --exclude='obsidian-generalmast' \
  --exclude='db.sqlite3' .
printf '   tamanho: %s\n' "$(du -h "/tmp/$TAR" | cut -f1)"

# 3. Backup do .env remoto.
cyan "Backup do .env remoto (.env.bak)..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "cd '$REMOTE_DIR' && cp -f .env .env.bak && echo ok" \
  || fail "não foi possível acessar $REMOTE_DIR/.env no VPS"

# 4. Upload.
cyan "Enviando pacote (scp)..."
scp "${SSH_OPTS[@]}" "/tmp/$TAR" "${REMOTE}:${REMOTE_DIR}/$TAR" || fail "scp falhou"

# 5. Extrai (sem tocar no .env), rebuilda e espera healthy.
cyan "Extraindo, rebuildando e aguardando health..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "APP_COMMIT='$COMMIT' REMOTE_DIR='$REMOTE_DIR' TAR='$TAR' bash -s" <<'REMOTE_SCRIPT'
set -e
cd "$REMOTE_DIR"
tar xzf "$TAR"
rm -f "$TAR"
echo "--- ports ---"
grep -nE '127.0.0.1:[0-9]+:[0-9]+' docker-compose.yml
APP_COMMIT="$APP_COMMIT" docker compose up -d --build
echo "--- aguardando health ---"
for i in $(seq 1 30); do
  s="$(docker compose ps --format '{{.Name}} {{.Status}}' | grep -E '^taskflow(-api)? ' || true)"
  if echo "$s" | grep -q starting; then sleep 2; continue; fi
  if echo "$s" | grep -q healthy; then echo HEALTHY; break; fi
  sleep 2
done
docker compose ps
echo "--- api /health ---"; curl -s http://127.0.0.1:3033/health || true; echo
echo "--- cloudflared ---"; systemctl is-active cloudflared || true
REMOTE_SCRIPT

# 6. Limpeza.
rm -f "/tmp/$TAR"

printf '\033[32mDeploy concluido.\033[0m\n'
echo "  URL:      https://mlutegar.com  (Cloudflare Tunnel 'emme')"
echo "  Portas:   3026 (frontend) / 3033 (api) — inalteradas"
echo "  Logs:     ssh -i $KEY $REMOTE 'cd $REMOTE_DIR && docker compose logs -f'"
echo "  Rollback: ssh -i $KEY $REMOTE 'cd $REMOTE_DIR && cp .env.bak .env && docker compose up -d'"

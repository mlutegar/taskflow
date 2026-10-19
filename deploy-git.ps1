# deploy-git.ps1 — Deploy do taskflow no VPS KVM 8 via Git.
#
# Fluxo: push para o GitHub -> pull no VPS -> rebuild -> health check.
# Nada de tar/scp: o VPS pega o código do GitHub, então o que está em produção
# é sempre um commit rastreável.
#
# Uso:
#   .\deploy-git.ps1                     # usa o commit já feito
#   .\deploy-git.ps1 -Message "fix: x"   # commita tudo e depois faz o deploy

param(
    [string]$Message = "",
    [string]$Remote  = "kvm8",
    [string]$Dir     = "/root/taskflow"
)

$ErrorActionPreference = "Stop"
function Step($t) { Write-Host "==> $t" -ForegroundColor Cyan }
function Warn($t) { Write-Host "AVISO: $t" -ForegroundColor Yellow }

Set-Location $PSScriptRoot

# 1. Commit opcional.
if ($Message) {
    Step "Commitando: $Message"
    git add -A
    git commit -m $Message
}

# 2. A árvore precisa estar limpa — senão o que sobe difere do que você testou.
$dirty = git status --porcelain
if ($dirty) {
    Warn "Há mudanças não commitadas. O deploy publica apenas o que está no GitHub:"
    $dirty | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" }
    $ans = Read-Host "Continuar mesmo assim? [s/N]"
    if ($ans -ne "s") { Write-Host "Cancelado."; exit 0 }
}

$commit = (git rev-parse --short HEAD).Trim()
Step "Commit a publicar: $commit"

# 3. Push.
Step "Enviando para o GitHub..."
git push origin main

# 4. Pull + rebuild no VPS. APP_COMMIT alimenta a versão visível no app.
Step "Atualizando o VPS ($Remote)..."
$remoteCmd = @"
set -e
cd $Dir
git pull --ff-only
sed -i "s/^APP_COMMIT=.*/APP_COMMIT=$commit/" .env || echo "APP_COMMIT=$commit" >> .env
docker compose build --no-cache
docker compose up -d
for i in \$(seq 1 40); do
  [ "\$(docker inspect -f '{{.State.Health.Status}}' taskflow-api 2>/dev/null)" = "healthy" ] && break
  sleep 3
done
docker compose ps --format 'table {{.Name}}\t{{.Status}}'
echo "--- api ---";      curl -s http://127.0.0.1:3033/health; echo
echo "--- frontend ---"; curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3026/taskflow/
"@
ssh -o StrictHostKeyChecking=no $Remote $remoteCmd

Write-Host ""
Write-Host "Deploy concluido ($commit)." -ForegroundColor Green
Write-Host "  URL:   https://taskflow.mrender.com.br"
Write-Host "  Logs:  ssh $Remote 'cd $Dir && docker compose logs -f'"

# Deploy do generalmast (frontend + backend).
# O build do frontend acontece DENTRO da imagem Docker (Dockerfile multi-stage),
# então não é preciso rodar `npm run build` à mão — impossível subir dist antigo.
#
# Uso:
#   ./deploy.ps1            # rebuilda e sobe tudo
#   ./deploy.ps1 taskflow   # rebuilda e sobe só o frontend
#
# Requer Docker Desktop em execução.

param(
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Injeta o commit curto no build (aparece no console/Perfil do app via APP_VERSION).
try {
    $env:APP_COMMIT = (git rev-parse --short HEAD).Trim()
} catch {
    $env:APP_COMMIT = ""
}
Write-Host "APP_COMMIT = $($env:APP_COMMIT)" -ForegroundColor Cyan

# Garante que o Docker está no ar.
docker info *> $null
if (-not $?) {
    Write-Host "Docker nao esta rodando. Inicie o Docker Desktop e tente de novo." -ForegroundColor Red
    exit 1
}

if ($Service) {
    docker compose up -d --build $Service
} else {
    docker compose up -d --build
}

Write-Host "Deploy concluido." -ForegroundColor Green

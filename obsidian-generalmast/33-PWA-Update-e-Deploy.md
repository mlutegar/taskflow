# 28 - Update do PWA & Script de Deploy

Voltar ao [[0-Painel]] · Relacionados: [[13-Deploy-e-Build]], [[9-Cache-Sync-e-Versionamento]], [[26-Modo-Minimizavel-Card-Flutuante]]

## Problema
Todo deploy exigia **fechar/reabrir o PWA** (ou Ctrl+Shift+R) para ver a versão nova — o service
worker servia assets em cache e o app (SPA por hash) não fazia navegações que fizessem o browser
checar atualização. E o processo de publicar no VPS era **manual e repetitivo** (tar → scp → extrair →
rebuild), propício a erro.

## Update do PWA controlado
- **`vite.config.js`:** `registerType: "prompt"` (antes `autoUpdate`).
- **`src/sw.ts`:** removido o `self.skipWaiting()` imediato; agora só faz `skipWaiting()` ao receber a
  mensagem `SKIP_WAITING`. `clientsClaim()` mantido. Assim o SW novo espera o usuário, sem recarregar
  no meio de uma sessão.
- **`src/components/shared/UpdatePrompt.tsx`:** usa `registerSW` de `virtual:pwa-register`
  (`onNeedRefresh` → banner "Nova versão disponível — Atualizar"; botão chama `updateSW(true)` →
  `SKIP_WAITING` + reload). Revalida a cada **60s** e ao **focar/voltar** o app (`registration.update()`),
  já que o roteamento por hash não dispara checagem. Montado em `main.tsx` (fora do gate de login).
- **Tipos:** `/// <reference types="vite-plugin-pwa/client" />` em `src/globals.d.ts`.

## Script de deploy — `deploy-vps.sh` (raiz)
Automatiza e torna idempotente o fluxo antes feito à mão:
1. `APP_COMMIT` = `git rev-parse --short HEAD` (avisa se a árvore está suja).
2. `tar` do projeto excluindo `node_modules/.git/.env/dist/*.tar.gz/...`.
3. **Backup** do `.env` remoto (`.env.bak`).
4. `scp` para o VPS e extrai **sobre** `/root/taskflow` **sem** tocar no `.env`.
5. `APP_COMMIT=<hash> docker compose up -d --build` (só este projeto).
6. **Espera ficar healthy** (loop ~60s) e imprime `docker compose ps`, `/health` e status do
   `cloudflared`.
7. Limpa os tars e imprime comandos de logs/rollback.

Config por env vars: `VPS_IP`, `REMOTE_DIR`, `KEY`. Flag `-y` pula a confirmação.
Uso típico: `./deploy-vps.sh` (Git Bash) ou `./deploy-vps.sh -y` em automação.

## Invariantes preservadas
- Porta interna **inalterada** (3026 frontend / 3033 api) → o Public Hostname do Cloudflare Tunnel
  "emme" (`mlutegar.com`) continua válido, sem reconfigurar o túnel.
- Secrets do `.env` **nunca** sobrescritos (excluídos do tar + backup).
- Nenhum outro container do VPS multi-projeto é tocado (`docker compose` no diretório do projeto).

## Verificação
1. `npx vite build` gera `sw.js` novo; abrir o app, publicar uma mudança, e ver o banner
   "Nova versão disponível" aparecer (sem refresh manual) → "Atualizar" recarrega na versão nova.
2. `./deploy-vps.sh` conclui com `HEALTHY` e `/health` → `{"ok":true}`.

# 61 - Deploy no VPS KVM 8 (via Git)

Segundo ambiente do taskflow, agora com deploy **por Git** (não mais tar/scp).

Relacionado: [[13-Deploy-e-Build]] · [[33-PWA-Update-e-Deploy]] · [[12-Troubleshooting-DB-Drift]] · [[0-Painel]]

---

## Os dois ambientes

| | VPS antigo | **KVM 8 (novo)** |
|---|---|---|
| Host | `srv1858777.hstgr.cloud` | `srv1753241` (`ssh kvm8`) |
| Diretório | `/root/taskflow` | `/root/taskflow` |
| Portas | 3026 / 3033 | **3026 / 3033** (livres, sem remap) |
| Túnel | "emme" → mlutegar.com | **"iazan" → mrender.com.br** |
| Deploy | `deploy-vps.sh` (tar + scp) | **`deploy-git.ps1` (git pull)** |

Portas já ocupadas no KVM 8 quando cheguei: `3000` (psc-dashboard), `3001` (mrender),
`3002` (dunas-dashboard), `3003` (psc-ts), `5435` (iazan-pg18), `5678` (n8n), `6379`
(redis), além de 22/53/80/443/8080/20241/20242. **3026 e 3033 estavam livres** — nenhum
remapeamento foi necessário.

## Bloqueio inicial: o repositório estava quebrado

O deploy exige Git, e `git status` falhava com:

```
fatal: not a git repository: C:/.../generalmast/.git/worktrees/agent-a3115bfa683e63ecf
```

Três resquícios da renomeação `generalmast` → `taskflow`, em camadas:

1. **17 registros de worktree órfãos** (`git worktree list` mostrava todos `prunable`) →
   `git worktree prune`.
2. **`core.hooksPath`** apontando para `.../generalmast/.git/hooks`, que não existe mais →
   `git config --unset core.hooksPath`.
3. **A causa real:** os 17 diretórios em `.claude/worktrees/` estavam **commitados como
   gitlinks** (o git os tratava como submódulos) e cada um tinha um `.git` apontando para o
   caminho morto. Como o `git` resolve o gitlink antes de qualquer coisa, até
   `git rm --cached` falhava. Ordem do conserto: renomear os `.git` para `.git.broken` →
   `git rm --cached -r .claude/worktrees` → adicionar `.claude/worktrees/` ao `.gitignore`.

> Isso não era só chateação local: gitlinks quebrados **também quebram o `git clone` no
> servidor**. Sem resolver, o deploy por Git era impossível.

## Falha de backup encontrada na verificação

Os containers subiram saudáveis, mas o litestream repetia:

```
level=ERROR msg="sync error" error="attempt to write a readonly database (8)"
```

Duas causas somadas — e **nenhuma derrubava nada**, que é o pior tipo de falha de backup:
o app fica verde e você só descobre que não tem cópia na hora de restaurar.

1. A imagem do litestream roda como **`nonroot`**, mas o banco é criado pelo
   `taskflow-api` como **root** (0644) no volume compartilhado. Lia, mas não conseguia
   criar o diretório de shadow WAL ao lado do arquivo.
   → `user: "0:0"` no serviço litestream.
2. O banco estava em **`journal_mode=delete`** e o Litestream **só replica WAL**.
   → a API passou a aplicar `PRAGMA journal_mode=WAL` no boot (`backend/src/prisma.js`,
   `enableWalMode()`), para que qualquer deploy limpo nasça replicável. O modo fica no
   cabeçalho do arquivo, então persiste; `synchronous=NORMAL` é o par recomendado.

Confirmado depois: `journal_mode=wal` no log de boot e arquivos `.ltx` surgindo em
`/data/backups/ltx/`.

## Configuração

`.env` no VPS (600, gerado lá — segredo nunca trafegou):

```
NODE_ENV=production
JWT_SECRET=<openssl rand -hex 32>
CORS_ORIGIN=https://taskflow.mrender.com.br
VITE_API_URL=/api
APP_COMMIT=<commit>
```

- `SUPABASE_URL`/`SUPABASE_ANON_KEY` aparecem como warning do compose mas **não são usadas
  pelo backend** (resquício). Inofensivas.
- `JWT_SECRET` é **obrigatório**: `backend/src/auth.js` aborta em produção sem ele.
- O nginx faz proxy de `/api/` → `taskflow-api:3001`, então **só a 3026 precisa de
  exposição pública**. A 3033 fica só para diagnóstico local.

## Cloudflare Tunnel

Túnel **"iazan"** já ativo. Falta apenas adicionar o Public Hostname no dashboard:

- Subdomain `taskflow` · Domain `mrender.com.br`
- Service: **HTTP** → `localhost:3026`

## Deploy daqui em diante

```powershell
.\deploy-git.ps1 -Message "fix: alguma coisa"
```

Faz push → `git pull --ff-only` no VPS → atualiza `APP_COMMIT` no `.env` →
`build --no-cache` → `up -d` → espera health → imprime status.

Verificação de "build velho?" (ver [[13-Deploy-e-Build]]): a versão no bundle precisa
bater com o HEAD.

```bash
ssh kvm8 'cd /root/taskflow && idx=$(curl -s http://127.0.0.1:3026/taskflow/index.html | grep -oE "assets/index-[^\"]+\.js" | head -1); curl -s "http://127.0.0.1:3026/taskflow/$idx" | grep -oE "0\.1\.0\+[a-z0-9]+" | head -1'
```

> Armadilha: rebuildar só o `taskflow-api` deixa a etiqueta do frontend defasada. Se mudou
> só o backend, tudo bem; mas a etiqueta é justamente o detector de build velho, então
> vale rebuildar os dois para ela continuar confiável.

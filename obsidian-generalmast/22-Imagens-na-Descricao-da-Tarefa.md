# 22 - Imagens na Descrição da Tarefa

Voltar: [[0-Painel]] · Relacionados: [[15-Redesign-Card-Nova-Tarefa]] · [[8-Atualizacao-Imediata-de-Tarefas]] · [[13-Deploy-e-Build]]

## O que mudou
Agora é possível **subir imagens dentro da descrição das tarefas**. A imagem é
enviada ao backend, salva em disco (volume persistente) e inserida na descrição
como **markdown** `![alt](url)`. A descrição passa a ser **renderizada como
markdown** (com imagens), em vez de texto puro.

Formas de inserir: botão **🖼️ Imagem**, **colar** (Ctrl/Cmd+V) e **arrastar**
(drop) uma imagem sobre o campo.

## Backend
- **`backend/src/routes/uploads.js`** (novo, prefixo `/uploads`):
  - `POST /uploads/images` — autenticado (`preHandler: authenticate` de
    `backend/src/auth.js`), multipart. Valida mime (PNG/JPEG/WebP/GIF) e tamanho
    (máx **5MB**). Grava em `UPLOADS_DIR/{userId}/{uuid}.{ext}` e retorna
    `{ url, filename, size }` com `url = /api/uploads/file/{userId}/{arquivo}`.
  - `@fastify/static` serve os arquivos em `/uploads/file/*`. Acesso público
    (URLs têm UUID não-adivinhável; tags `<img>` não enviam `Authorization`).
- **`backend/src/index.js`** — registra `uploadsRoutes` com prefixo `/uploads`.
- **`backend/src/routes/tasks.js`** — limite de `description` subiu de 2000 → **10000**
  (create e update) para acomodar as URLs em markdown.
- Dependências: `@fastify/multipart` (^8), `@fastify/static` (^7).

### Storage / `UPLOADS_DIR`
`process.env.UPLOADS_DIR` ou, por padrão: `/data/uploads` em produção, `./uploads`
em dev. `/data` já é o volume `taskflow_data` (ver `docker-compose.yml`).

⚠️ **Backup**: o Litestream replica apenas o SQLite — as imagens **não** entram no
backup atual. Se necessário, adicionar backup separado da pasta `uploads`.

## Frontend
- **`frontend/src/api/uploads.ts`** (novo): `uploadImage(file)` via `fetch` +
  `FormData`, reutilizando `apiConnection()` de `apiClient.ts` para base URL e JWT
  (o `apiClient` só trata JSON).
- **`frontend/src/components/DescriptionEditor.tsx`** (novo): envolve o `<textarea>`
  e adiciona botão/paste/drop; ao concluir o upload insere `![alt](url)` na posição
  do cursor. Reusado em `AddTaskForm` e `TaskCard` (modo edição).
- **Renderização** em `TaskCard.tsx`: `<p>` puro → `<ReactMarkdown>` restrito a um
  conjunto seguro de elementos; `img` estilizado (max-width 100%, lazy) e `a` com
  `target=_blank`. Dependência: `react-markdown` (^10).
- Limites de `description` no front subiram para **10000** (`AddTaskForm.DESC_MAX`
  e `lib/schemas.ts` `taskSchema`).

## Infra
- **`frontend/nginx.conf`** — `client_max_body_size 6m;` no bloco `location /api/`
  (default do Nginx é 1MB, bloquearia o upload).

## Como testar
1. Dev: `cd backend && npm run dev` e `cd frontend && npm run dev`.
2. Criar/editar tarefa → colar/arrastar/selecionar imagem → markdown `![](…)`
   aparece; arquivo em `backend/uploads/{userId}/…`.
3. Salvar e conferir que a imagem **renderiza** no card e no `TaskDetailModal`.
4. Limites: >5MB → 413; mime não-imagem → 400; sem token → 401.
5. Produção: `docker-compose build && up`; validar `/api/uploads/file/…` via Nginx.

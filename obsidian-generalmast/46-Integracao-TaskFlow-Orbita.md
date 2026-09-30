# 46 - Integração TaskFlow ↔ Órbita (Claude Web)

Voltar ao [[0-Painel]].

## Objetivo
Dentro do detalhe de uma tarefa, associar **projetos do Órbita** (o app Claude Web em
`gerenciar_claude_no_iphone`, servidor Python `:8765`) e, com um botão, **abrir uma aba no
Claude naquele projeto com o prompt já enviado automaticamente**.

## Como funciona
```
Navegador (TaskFlow)
  │ clica "▶ <projeto>" no card da tarefa
  ├─ POST /orbita/launch {path, prompt}  → backend Fastify (proxy)
  │     Órbita  POST /api/open {path, provider:"claude"} → key
  │     Órbita  POST /api/send {key, text: prompt}        (envio automático)
  │     responde { openUrl: "<ORBITA_WEB_PUBLIC_URL>/?t=TOKEN&key=<key>" }
  └─ window.open(openUrl)  → UI do Órbita foca aquela aba (Claude já respondendo)
```

O backend do TaskFlow atua como **proxy**: guarda o token e o endereço do Órbita (evita CORS
e não expõe o token no navegador). O Órbita roda **local**; o TaskFlow pode estar **remoto**
(Tailscale) — por isso o endereço é configurável.

## Decisões
- Projetos associáveis = pastas do Órbita (`GET /api/projects`); **múltiplos** por tarefa.
- Prompt = **template automático** (título + descrição + checklist) **editável**.
- Ao clicar = **envio automático** (Claude já começa a responder).

## Arquivos
**Backend (`generalmast/backend`)**
- `src/routes/orbita.js` — proxy: `GET /orbita/projects`, `POST /orbita/launch` (modelo: `ai.js`).
- `src/index.js` — registra `orbitaRoutes` em `/orbita`.
- `prisma/schema.prisma` — Task ganha `orbita_projects` (JSON de paths) e `orbita_prompt`.
  Migração `20260929060000_add_orbita_fields`.
- `src/routes/tasks.js` — zod + `shapeTask`/`snapshotToTaskData` + create/patch persistem os campos.
- `.env` — `ORBITA_WEB_URL`, `ORBITA_WEB_PUBLIC_URL` (opcional), `ORBITA_WEB_TOKEN`.

**Frontend (`generalmast/frontend`)**
- `src/api/orbita.ts` — `listProjects()`, `launch(path, prompt)`.
- `src/lib/orbitaPrompt.ts` — `buildPromptFromTask()` (título + descrição + checklist aninhado).
- `src/components/OrbitaLauncher.tsx` — painel no `TaskDetailModal`: chips de projetos,
  textarea do prompt e botões "▶ <projeto>".
- `src/types/tasks.ts` — `orbita_projects`, `orbita_prompt`.

**Órbita (`gerenciar_claude_no_iphone/frontend`)**
- `src/App.jsx` — lê `?key=` no load e faz `SWITCH_TAB` para focar a aba recém-criada,
  limpando o parâmetro da URL depois.

## Evolução (v2 — melhorias)
Migração `20260929070000_orbita_enhancements`. Novos campos: Task
`orbita_last_key`/`orbita_last_provider`/`orbita_history`; UserPreferences
`orbita_prompt_template`.

- **Seletor de agente** (Claude/Codex/Gemini) no launcher (`/api/open` já aceita `provider`).
- **Reuso de aba**: guarda a `key` do último launch; opção "Continuar aba anterior"
  manda só `/api/send` (continua a conversa) em vez de abrir nova aba.
- **Template global** com placeholders `{{titulo}} {{descricao}} {{checklist}} {{projeto}}`
  salvo em `UserPreferences` (`applyTemplate` em `orbitaPrompt.ts`); prompt por-tarefa
  continua sobrepondo o template.
- **Preview do prompt final** (colapsável) antes de enviar.
- **Janela de desfazer**: contagem de 4s antes do envio automático (Cancelar / Enviar agora).
- **Erros granulares** no proxy (offline / timeout / projeto inválido / forbidden).
- **Projetos "mortos"**: associações cujo path sumiu do Órbita são sinalizadas e removíveis.
- **Deep-link** `?task=<id>&launch=<path>` abre a tarefa e dispara o launch daquele projeto.
- **Histórico de envios** por tarefa (`orbita_history`, últimos 20; exibe os 3 mais recentes).

### Deferidos (exigem mudança no servidor do Órbita / infra de auth de máquina)
- **Status ao vivo da aba** (busy/concluído via SSE): hoje há histórico + reuso; o "busy"
  em tempo real exigiria um endpoint REST/SSE por `key` no `claude_web.py`.
- **Token fora da URL** (ticket de uso único): precisa de endpoint de troca ticket→cookie no Órbita.
- **Bidirecional Claude → TaskFlow** (Claude concluir checklist/tarefa): precisa de token de
  máquina no TaskFlow e o Órbita chamando `PATCH /tasks/:id`.

## Verificação
1. Subir o Órbita local e confirmar `GET :8765/api/projects?t=mlute-7q2x9k`.
2. Subir TaskFlow; migrações aplicadas (`prisma migrate deploy`).
3. Numa tarefa → associar projeto, escolher agente, editar prompt/template, clicar "▶".
   Confirmar a janela de 4s (ou "Enviar agora"); a aba do Órbita abre e o Claude responde.
4. Clicar de novo com "Continuar aba anterior" marcado → mesma conversa recebe o novo prompt.
5. Conferir o "Histórico de envios" na tarefa e o deep-link `#/tasks?task=<id>&launch=<path>`.

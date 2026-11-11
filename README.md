# TaskFlow — Tarefas, hábitos e foco com modos de execução

TaskFlow é um PWA (pensado para uso no celular) para organizar tarefas e hábitos e
executar o trabalho dentro de **modos de atividade** com mecânicas próprias para cada
estado de foco.

## ✨ Funcionalidades

- **Tarefas**: prioridade, vencimento (data/hora), recorrência (diária, semanal, anual…),
  checklists, projetos hierárquicos, tempo estimado, imagens na descrição, filtros e
  ordenação, captura rápida global (atalho `N` / `Ctrl+K`, com linguagem natural).
- **Hábitos (Rotinas)**: tarefas recorrentes do dia, metas quantificáveis, heatmap de
  consistência estilo GitHub, sequência atual/melhor.
- **Daily Focus**: escolha das 5 prioridades do dia, cronômetro persistente (sobrevive à
  navegação e sincroniza entre dispositivos), checkpoint emocional, atividade contínua,
  histórico e conquistas.
- **Modos**: ~94 modos agrupados por categoria (Música, Ciclos, Foco, Memória, Ritual,
  Mobile, Personalizados), cada um com descrição, pré-requisito e botão **Iniciar**;
  sessões minimizáveis em card flutuante, métricas de uso e modos personalizados.
- **Análises/Perfil**: dashboard, histórico de sessões, revisão semanal.
- **PWA**: instalável, service worker com banner "Nova versão disponível".

## 🧱 Stack

| Camada | Tecnologias |
|---|---|
| Frontend (`frontend/`) | React 18, Vite 5, TypeScript, CSS Modules, TanStack Query, vite-plugin-pwa, Vitest |
| Backend (`backend/`) | Node 20, Fastify 4, Prisma 5, **SQLite**, JWT, zod |
| Infra | Docker Compose (API + nginx com os estáticos), **Litestream** (replicação contínua do SQLite), VPS com Cloudflare Tunnel |
| CI | GitHub Actions: lint, typecheck, testes e build do frontend; checagem de drift das migrations do Prisma |

O frontend usa roteamento por hash (`#/tasks`, `#/routines`, `#/modes`, `#/daily-focus`,
`#/dashboard`, `#/profile`) e fala com a API em `/api` (proxy no Vite em dev e no nginx em
produção). Estado local fica em `localStorage` (prefixo `taskflow.`), com fila de
reenvio quando offline.

## 🚀 Rodando localmente

Pré-requisitos: Node.js 20+.

```bash
npm install                      # raiz (concurrently)
npm --prefix backend install
npm --prefix frontend install
# crie o .env na raiz (JWT_SECRET, DATABASE_URL etc.; não é versionado)
npm run setup                    # aplica o schema do banco (Prisma)
npm run dev                      # API em :3001 + Web em :5175
```

Abra `http://localhost:5175/taskflow/` (o `base` do Vite é `/taskflow/`).

### Scripts úteis

| Onde | Comando | O que faz |
|---|---|---|
| raiz | `npm run dev` | sobe API e frontend juntos (libera as portas antes) |
| `frontend/` | `npm run lint` · `typecheck` · `test` · `build` | qualidade e build |
| `backend/` | `npm test` | testes (`node --test`) |
| `backend/` | `npm run db:migrate` · `db:deploy` · `db:drift-check` | migrations Prisma |

Toda mudança em `backend/prisma/schema.prisma` precisa de uma migration versionada
(o CI falha se houver drift).

## 🐳 Produção

`docker-compose.yml` define três serviços:

- `taskflow-api` — Fastify + Prisma, banco SQLite no volume `taskflow_data`
  (porta `127.0.0.1:3033`);
- `taskflow` — nginx servindo o build do frontend (compilado **dentro** do Docker) e
  fazendo proxy de `/api/` para a API (porta `127.0.0.1:3026`);
- `litestream` — replica o SQLite continuamente (`litestream.yml`).

Deploy: `./deploy-git.ps1` (push → pull no VPS → rebuild → health check) ou, no modo
legado, `./deploy-vps.sh`. O acesso público é feito por Cloudflare Tunnel apontando
para a porta do nginx.

## 📚 Documentação

- `CLAUDE.md` — visão técnica (arquitetura, catálogo de modos, convenções, pendências).
- `obsidian-generalmast/` — vault com uma nota por feature/fix (comece por `0-Painel.md`).
- `PROMPTS.md` — sequência de prompts de trabalho e status.

# TaskFlow — Gerenciador de tarefas com modos de execução gamificados

TaskFlow é um app web para gerenciar tarefas e rotinas com **modos de execução
gamificados** que tornam a produtividade mais divertida. Você organiza suas tarefas,
acompanha rotinas diárias e executa o trabalho dentro de "modos" com mecânicas
específicas para diferentes estados de foco.

## ✨ Funcionalidades

### Tarefas
- Criar, editar, concluir, reabrir e excluir (com desfazer)
- Prioridade (Crítica → Baixa), data de vencimento e recorrência
- Checklists / subtarefas aninhadas
- Busca, filtros (todas / ativas / concluídas) e ordenação
- Painel "Hoje" com o que foi concluído no dia

### Rotinas 📅
Tarefas diárias que se resetam automaticamente todo dia.
- Metas quantificáveis com valor alvo (ex: **4.5L de água**) e progresso
- Conclusão por data e histórico
- Visualização em **lista** ou **heatmap** de consistência

### 🎮 Modos de execução
Cada modo guia sua sessão de trabalho com mecânicas próprias:

| Modo | Ideia |
|---|---|
| 🎵 **Music Mode** | Encontre a música certa no Spotify e faça a tarefa enquanto ouve |
| 📱 **TikTok Mode** | Ciclos progressivos: n × 5 vídeos → n tarefas |
| 🔪 **Splite Mode** | Ciclos progressivos com uma atividade de recompensa personalizável |
| ⚡ **Momentum Mode** | Quebre a inércia com sessões de 5 minutos |
| ☕ **Espresso Sprint** | Sprints de 25 min com rastreamento de café |
| 🎮 **RPG Class Mode** | Produtividade gamificada com classes de personagem e XP |
| 🦅 **Lazy Falcon Mode** | Ciclos com opção de salvar tarefas para continuar depois |
| 🫖 **Café Ritual** | Shot de café + a música certa para atingir estado de pico |
| 📲 **Tab Hop** | Rotação entre apps abertos — feito para transporte |
| ✨ **Modos personalizados** | Crie seus próprios modos com passos e dicas |

As atividades de recompensa dos modos **Splite** e **Lazy Falcon** são editáveis
(adicionar/remover) e ficam salvas no navegador.

## 🧱 Stack

- **Frontend:** React + Vite (CSS Modules)
- **Persistência:** Supabase (Postgres) para tarefas, rotinas e estatísticas de modos
- **Deploy:** GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`)

Estado local (sessões em andamento, modos personalizados, atividades) fica em
`localStorage`.

## 🚀 Como rodar localmente

Pré-requisitos: Node.js 20+.

```bash
cd frontend
npm install
npm run dev
```

Crie um arquivo `frontend/.env.local` com as credenciais do seu projeto Supabase:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

O schema do banco está em `supabase/`.

### Build de produção

```bash
cd frontend
npm run build
```

O deploy para GitHub Pages é automático a cada push na branch `main`.

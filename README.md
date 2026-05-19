# TaskFlow - CLI Task Manager with Gamified Execution Modes

TaskFlow é um gerenciador de tarefas CLI com modos de execução gamificados para tornar a produtividade mais divertida.

## ✨ Novidade: Sistema de Rotina! 📅

Tarefas diárias que se resetam automaticamente! Crie rotinas como "Beber 4.5L de água" e elas reaparecerão todos os dias.

**Como funciona:**
- Complete a rotina hoje ✅
- Amanhã ela aparece como pendente novamente ⏰
- Acompanhe progresso com valores alvo (ex: 2.5L / 4.5L)
- Sistema automático de tracking diário

## 🎮 Modos de Execução

### 1. Music Doing Mode 🎵
- Passe por ~100 músicas no Spotify
- Quando encontrar a música perfeita, selecione uma tarefa
- Execute a tarefa enquanto ouve a música

### 2. TikTok Mode 📱
Ciclos progressivos de produtividade:
- **Ciclo 1**: Assista 5 vídeos → Faça 1 tarefa
- **Ciclo 2**: Assista 10 vídeos → Faça 2 tarefas
- **Ciclo 3**: Assista 15 vídeos → Faça 3 tarefas
- E assim por diante... (n × 5 vídeos → n tarefas)

### 3. Splite Mode 🔪
Escolha uma atividade e faça ciclos progressivos:
1. Escolha uma atividade (ex: Ler diário, Jogar Spelunky, Meditar...)
2. **Ciclo 1**: Faça a atividade 1x → Faça 1 tarefa
3. **Ciclo 2**: Faça a atividade 2x → Faça 2 tarefas
4. **Ciclo 3**: Faça a atividade 3x → Faça 3 tarefas
5. E assim por diante... (n × atividade → n tarefas)

Atividades disponíveis:
- Ler diário / Escrever no diário
- Beber água
- Jogar Spelunky
- Ver Twitter / Ver um vídeo
- Colocar música
- Ler um capítulo de livro
- Esticar 5 minutos / Meditar
- Fazer exercícios rápidos
- Organizar algo / Responder mensagens
- E mais... (customizável!)

## 📦 Instalação

```bash
# Clonar ou navegar até o diretório do projeto
cd generalmast

# Instalar dependências
pip install -r requirements.txt

# Instalar como pacote (opcional, para comando global)
pip install -e .
```

## 🚀 Como Usar

### Executar o programa:
```bash
python -m taskflow.cli
```

Ou se instalou como pacote:
```bash
taskflow
```

### Menu Principal:
```
╔═══════════════════════════════════════╗
║         TaskFlow - Productivity       ║
╠═══════════════════════════════════════╣
║  1. Gerenciar Tarefas                 ║
║  2. Gerenciar Rotina                  ║ ← NOVO!
║  3. Music Doing Mode                  ║
║  4. TikTok Mode                       ║
║  5. Splite Mode                       ║
║  6. Manage Activities                 ║
║  7. Sair                              ║
╚═══════════════════════════════════════╝
```

## 📝 Gerenciamento de Tarefas

### Adicionar Tarefa

### Adicionar Tarefa
- Título obrigatório
- Descrição opcional
- Pode adicionar checklist depois

### Adicionar Checklist
- Selecione uma tarefa existente
- Adicione múltiplos itens
- Marque itens como completos individualmente

### Listar Tarefas
- Ver todas as tarefas
- Filtrar por ativas ou completadas
- Mostra progresso do checklist

### Completar Tarefas
- Se tiver checklist: perguntará se completou tudo
- Se não: marca como completa diretamente
- Progresso é salvo automaticamente

## 📅 Gerenciamento de Rotina

O sistema de rotina permite criar tarefas diárias que se resetam automaticamente.

### Criar Rotina
- **Título**: Nome da rotina (ex: "Beber água")
- **Descrição**: Opcional
- **Valor Alvo**: Quantidade esperada (ex: 4.5 para água)
- **Unidade**: Unidade de medida (ex: "L", "vezes", "horas")

### Exemplos de Rotina:
1. **Beber água**: 4.5L por dia
2. **Ler livro**: 30 minutos por dia
3. **Exercícios**: 3 vezes por dia
4. **Meditar**: 2 vezes por dia
5. **Estudar**: 2 horas por dia

### Funcionalidades:
- **Listar Todas**: Veja todas as rotinas cadastradas
- **Listar Pendentes (Hoje)**: Rotinas que ainda não completou hoje
- **Listar Completadas (Hoje)**: Rotinas já finalizadas hoje
- **Atualizar Progresso**: Adicione ao progresso atual (ex: bebeu 0.5L, adiciona 0.5)
- **Marcar como Completada**: Marque a rotina como feita para hoje
- **Adicionar Checklist**: Adicione subitens à rotina
- **Deletar**: Remova uma rotina

### Auto-Reset Diário:
- Rotinas completadas hoje ✅ reaparecem como pendentes amanhã ⏰
- Progresso é resetado automaticamente ao mudar o dia
- Sistema inteligente de tracking de data

## 💾 Persistência

As tarefas são salvas automaticamente em:
- `data/tasks.json` - Tarefas normais
- `data/routines.json` - Tarefas de rotina (diárias)
- `data/activities.json` - Lista de atividades do Splite Mode (customizável)

## 🧪 Testes

Para testar a funcionalidade core:
```bash
python test_basic.py
```

## 🛠️ Tecnologias

- **Python 3.10+**
- **Typer** - Framework CLI moderno
- **Questionary** - Prompts interativos bonitos
- **Rich** - Formatação de texto colorida
- **JSON** - Persistência simples

## 📂 Estrutura do Projeto

```
generalmast/
├── taskflow/
│   ├── __init__.py
│   ├── cli.py           # CLI principal e menus
│   ├── models.py        # Modelos de dados (Task, RoutineTask, ChecklistItem)
│   ├── storage.py       # Persistência JSON (TaskStorage, RoutineStorage)
│   ├── utils.py         # Utilitários e formatação
│   └── modes/           # Modos de execução
│       ├── __init__.py
│       ├── base.py      # Classe base
│       ├── music.py     # Music Doing Mode
│       ├── tiktok.py    # TikTok Mode
│       └── splite.py    # Splite Mode
├── data/                # Armazenamento local
│   ├── tasks.json
│   ├── routines.json    # ← NOVO: Tarefas de rotina
│   └── activities.json
├── requirements.txt
├── pyproject.toml
├── test_basic.py        # Testes de funcionalidade
├── test_splite.py       # Testes do Splite Mode
└── test_routine.py      # ← NOVO: Testes do sistema de rotina
```

## 🎯 Dicas de Uso

1. **Comece adicionando algumas tarefas** no gerenciador de tarefas
2. **Crie rotinas diárias** para hábitos recorrentes (beber água, exercícios, etc.)
3. **Use valores alvo** para rotinas quantificáveis (ex: 4.5L de água)
4. **Use checklists** para tarefas com múltiplos passos
5. **Experimente cada modo** para ver qual funciona melhor para você
6. **Splite Mode é ótimo para hábitos**: Escolha uma atividade como "Ler diário" e combine com tarefas
7. **Customize as atividades** no menu "Manage Activities"
8. **Aproveite o gamification** para tornar a produtividade divertida!

## 🔥 Exemplos de Rotina

### Beber Água (Quantificável)
- Título: "Beber água"
- Valor Alvo: 4.5
- Unidade: "L"
- Durante o dia: Atualize progresso (0.5L, 1.0L, etc.)
- Quando chegar em 4.5L: Marca como completo automaticamente ✅

### Meditar (Sem Valor Alvo)
- Título: "Meditar"
- Descrição: "Meditar por 10 minutos"
- Sem valor alvo
- Apenas marque como completada quando terminar ✅

### Exercícios (Com Checklist)
- Título: "Exercícios"
- Itens do checklist:
  - 50 abdominais
  - 50 flexões
  - 5 minutos de alongamento
- Marque cada item quando completar

## 🐛 Troubleshooting

### Terminal não suporta interação
No Windows, use cmd.exe ou PowerShell em vez de Git Bash para melhores resultados com questionary.

### Erro de codificação
O programa usa UTF-8. Certifique-se de que seu terminal está configurado corretamente.

---

Feito com ❤️ para produtividade gamificada!

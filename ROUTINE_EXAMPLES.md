# Sistema de Rotina - Exemplos Práticos

## 📅 Como funciona o Sistema de Rotina

O sistema de rotina permite criar tarefas diárias que se resetam automaticamente a cada dia.

### 🔑 Conceitos Principais:

1. **Rotina com Valor Alvo**: Tarefas quantificáveis (ex: beber 4.5L de água)
2. **Rotina Simples**: Tarefas sem quantidade (ex: meditar)
3. **Auto-Reset**: Rotinas completadas hoje reaparecem amanhã

## 💡 Exemplos de Uso

### 1. Beber Água (Quantificável)

**Criar a rotina:**
- Título: "Beber água"
- Descrição: "Beber 4.5L de água por dia"
- Tem valor alvo? **Sim**
- Valor: 4.5
- Unidade: "L"

**Durante o dia:**
```
Manhã: Adiciona 0.5L → Progresso: 0.5/4.5L (11.1%)
Almoço: Adiciona 1.0L → Progresso: 1.5/4.5L (33.3%)
Tarde: Adiciona 1.0L → Progresso: 2.5/4.5L (55.6%)
Jantar: Adiciona 1.5L → Progresso: 4.0/4.5L (88.9%)
Noite: Adiciona 0.5L → Progresso: 4.5/4.5L (100.0%) ✅ COMPLETO!
```

**No dia seguinte:**
- Progresso resetado para 0.0/4.5L
- Rotina aparece como pendente novamente
- Recomece o ciclo!

### 2. Ler Livro (Tempo)

**Criar a rotina:**
- Título: "Ler livro"
- Descrição: "Ler por 30 minutos"
- Tem valor alvo? **Sim**
- Valor: 30
- Unidade: "min"

**Durante o dia:**
```
Manhã: 15 minutos → Progresso: 15/30min (50.0%)
Noite: 15 minutos → Progresso: 30/30min (100.0%) ✅
```

### 3. Meditar (Simples)

**Criar a rotina:**
- Título: "Meditar"
- Descrição: "Meditar por 10 minutos"
- Tem valor alvo? **Não**

**Uso:**
- Medite por 10 minutos
- Marque como completada manualmente ✅
- Amanhã aparece novamente

### 4. Exercícios (Com Checklist)

**Criar a rotina:**
- Título: "Exercícios matinais"
- Descrição: "Fazer exercícios todos os dias"
- Tem valor alvo? **Não**

**Adicionar checklist:**
1. 50 abdominais
2. 50 flexões
3. 5 minutos de alongamento

**Uso:**
- Complete cada item do checklist
- Marque a rotina como completada quando acabar
- Amanhã: checklist resetado, tudo pronto de novo!

## 🎯 Fluxo Diário Típico

### Pela manhã:
```bash
taskflow
# Opção 2: Manage Routine
# Opção 3: List pending routines
```

Veja o que precisa ser feito hoje:
```
╔═══════════════════════════════════════╗
║      Pending Routines (Today)         ║
╠═══════════════════════════════════════╣
║ #  Title        Target  Progress       ║
║ 1  Beber água   4.5 L   0.0/4.5 (0%)   ║
║ 2  Meditar      -       ○ Pending      ║
║ 3  Exercícios   -       0/3 items      ║
╚═══════════════════════════════════════╝
```

### Durante o dia:

**Bebeu 0.5L de água?**
```bash
# Opção 5: Update routine progress
# Selecione "Beber água"
# Digite: 0.5
# Progresso: 0.5/4.5L (11.1%)
```

**Completou meditação?**
```bash
# Opção 6: Mark routine as completed
# Selecione "Meditar"
# ✅ Marcada como completada!
```

**Fez exercícios?**
```bash
# Marque cada item do checklist
# Opção 6: Mark routine as completed
# ✅ Completa!
```

### Final do dia:

```bash
# Opção 4: List completed routines
```

Veja seu progresso:
```
╔═══════════════════════════════════════╗
║    Completed Routines (Today)         ║
╠═══════════════════════════════════════╣
║ #  Title        Status                ║
║ 1  Meditar      ✓ Completed           ║
║ 2  Exercícios   ✓ Completed (3/3)     ║
╚═══════════════════════════════════════╝
```

### No dia seguinte:

As rotinas completadas ontem aparecem como pendentes novamente! 🔄

## 📊 Acompanhamento de Progresso

### Porcentagem Automática:
- 0.0/4.5L = 0.0%
- 2.25/4.5L = 50.0%
- 4.5/4.5L = 100.0% ✅

### Status Visual:
- ○ = Pendente
- ✓ = Completado

### Auto-Complete:
Quando o progresso atinge 100%, a rotina é marcada automaticamente como completada!

## 🎮 Dicas Avançadas

### 1. Rotinas em Modos de Execução
Use rotinas junto com os modos (TikTok, Splite, etc.)!

### 2. Múltiplas Rotinas
Crie quantas rotinas quiser:
- Beber água (4.5L)
- Ler (30min)
- Exercícios (diários)
- Meditar (10min)
- Estudar (2horas)

### 3. Checklist em Rotinas
Adicione checklist para rotinas complexas:
- "Exercícios": abdominais, flexões, alongamento
- "Estudar": ler, fazer exercícios, revisar

## 🚀 Comece Agora!

```bash
python -m taskflow.cli
# Opção 2: Manage Routine
# Opção 1: Add new routine
```

Crie sua primeira rotina e comece a trackear hábitos diários! 🎯

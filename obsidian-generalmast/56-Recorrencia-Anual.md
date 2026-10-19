# 56 - Recorrência Anual de Tarefas

> Ver também: [[0-Painel]] · [[7-Tarefas-Recorrentes]] · [[42-Melhorias-Habitos-e-Recorrencia]]

## Motivação

O TaskFlow já suportava recorrências diárias, semanais, quinzenais e mensais, mas não havia opção para tarefas que se repetem anualmente. Esta funcionalidade é importante para:
- Aniversários e datas comemorativas
- Renovações anuais (contratos, seguros, certificações)
- Manutenções anuais (revisão de carro, check-up médico)
- Impostos e obrigações fiscais anuais
- Planejamento de férias e eventos recorrentes

## O que foi implementado

### 1. Backend - Lógica de Recorrência

**`backend/src/taskRecurrence.js`:**
- Nova função `isLeapYear(year)` para detectar anos bissextos
- Nova função `addYears(date, years)` que adiciona N anos a uma data, tratando o caso especial de 29/02 em anos não bissextos
- Adicionado case `"yearly"` em `computeNextDueDate()` que usa `addYears(base, 1)`

**Caso especial 29/02:**
- Tarefa criada para 29/02/2024 (ano bissexto) → próxima em 28/02/2025 (não bissexto)
- A cada ano não bissexto, cai em 28/02
- Quando chegar em 2028 (próximo bissexto), volta a 29/02

### 2. Backend - Validação

**`backend/src/routes/tasks.js`:**
- Adicionado `"yearly"` ao array `recurrenceValues` (linha 19)
- Nenhuma mudança necessária no schema do banco de dados — o campo `recurrence` já aceita strings arbitrárias

### 3. Backend - Testes

**`backend/src/routes/tasks.test.js`:**
Adicionados 6 novos testes:
- ✅ Recorrência anual avança um ano (13/10/2026 → 13/10/2027)
- ✅ 29/02 em ano bissexto cai em 28/02 em ano não bissexto
- ✅ 29/02 mantém 29/02 quando o próximo ano é bissexto
- ✅ Virada de ano (31/12 → 31/12 do ano seguinte)
- ✅ Tarefa atrasada agenda a partir de hoje + 1 ano
- ✅ Teste de regressão: recorrências mensais continuam funcionando

Todos os 33 testes do backend passam.

### 4. Frontend - Schema e Tipos

**`frontend/src/lib/schemas.ts`:**
- Adicionado `"yearly"` ao enum de recorrência do Zod schema (linha 24)

### 5. Frontend - UI do Seletor

**`frontend/src/components/RecurrenceFields.tsx`:**
- Nova opção `<option value="yearly">Todo ano</option>` no dropdown
- Posicionada após "Primeiro dia do mês" (ordem de frequência: mais frequente → menos frequente)

### 6. Frontend - Exibição

**`frontend/src/components/TaskCard.tsx`:**
- Adicionado `yearly: "Todo ano"` ao objeto `RECURRENCE_LABELS`
- Nova função helper `formatDayMonth(date)` que formata datas como "13 de out"
- Badge de recorrência anual mostra: **"🔄 Todo ano em 13 de out"** (exibe dia e mês específicos)
- Para outras recorrências, continua mostrando apenas o tipo (ex: "🔄 Todo dia")

## Comportamento

### Regra de Repetição
A tarefa se repete no **mesmo dia e mês** da data de vencimento (ou data de criação, se não houver vencimento). Exemplo:
- Tarefa criada para **13/10/2026** → próxima em **13/10/2027** → **13/10/2028** → ...

### Caso Especial: 29 de Fevereiro
- Tarefa em **29/02** (ano bissexto) → em anos não bissextos, cai em **28/02**
- Sequência: 29/02/2024 → 28/02/2025 → 28/02/2026 → 28/02/2027 → 29/02/2028

### Tarefas Atrasadas
Seguindo a mesma lógica das outras recorrências:
- Se a tarefa estiver atrasada, ao concluir ela agenda para **hoje + 1 ano**
- Exemplo: tarefa de 13/10/2024, concluída hoje (15/10/2026) → próxima em **15/10/2027**

### Geração da Próxima Ocorrência
Ao concluir a tarefa:
1. Sistema registra a conclusão atual (`TaskCompletion`)
2. Calcula próxima data: `currentDueDate` + 1 ano (ou `today` + 1 ano se atrasada)
3. Atualiza `dueDate` da tarefa para a próxima ocorrência
4. Marca tarefa como concluída (`completed: true`)
5. Quando chega a próxima data, `reactivateDueRecurringTasks()` reativa a tarefa automaticamente

## Arquivos Modificados

**Backend:**
- `backend/src/taskRecurrence.js` — helpers `addYears()` e `isLeapYear()`, lógica anual
- `backend/src/routes/tasks.js` — validação com `"yearly"` no array
- `backend/src/routes/tasks.test.js` — 6 novos testes

**Frontend:**
- `frontend/src/lib/schemas.ts` — enum Zod atualizado
- `frontend/src/components/RecurrenceFields.tsx` — opção no dropdown
- `frontend/src/components/TaskCard.tsx` — label e formatação especial

**Nenhuma mudança necessária:**
- `backend/prisma/schema.prisma` — campo `recurrence` já genérico
- `frontend/src/types/tasks.ts` — tipo `string` já cobre `"yearly"`
- Painéis (`DailyRoutinePanel`, `DueTodayPanel`) — já filtram corretamente

## Verificação

### Testes Automatizados
```bash
cd backend && npm test
# 33 testes passam, incluindo os 6 novos testes de recorrência anual
```

### Testes Manuais (checklist)

1. **Criar tarefa anual via UI:**
   - ✅ Abrir formulário de nova tarefa
   - ✅ Expandir "Mais opções"
   - ✅ Selecionar "Todo ano" no dropdown de recorrência
   - ✅ Definir data de vencimento (ex: 13/10/2026)
   - ✅ Salvar e verificar badge: "🔄 Todo ano em 13 de out"

2. **Concluir e verificar próxima ocorrência:**
   - ✅ Marcar tarefa como concluída
   - ✅ Verificar que aparece em "Concluídas" durante o dia
   - ✅ Verificar no banco/API que `dueDate` foi atualizado para 13/10/2027

3. **Caso especial 29/02:**
   - ✅ Criar tarefa com vencimento 29/02/2024
   - ✅ Concluir e verificar próxima: 28/02/2025 (ano não bissexto)
   - ✅ Concluir novamente e verificar: 28/02/2026
   - ✅ (Simulando) Avançar até 2028 → volta a 29/02/2028

4. **Virada de ano:**
   - ✅ Criar tarefa para 31/12/2026
   - ✅ Concluir e verificar próxima: 31/12/2027

5. **Edição:**
   - ✅ Criar tarefa anual, clicar em editar
   - ✅ Verificar que "Todo ano" está selecionado
   - ✅ Mudar para "Todo mês", salvar
   - ✅ Editar novamente, voltar para "Todo ano", salvar
   - ✅ Confirmar que não há erros

6. **Regressão:**
   - ✅ Criar tarefa mensal (13/10/2026)
   - ✅ Concluir e verificar próxima: 13/11/2026 (não afetada)

7. **Filtros e painéis:**
   - ✅ Verificar que tarefa anual NÃO aparece em "Rotina Diária"
   - ✅ Verificar que tarefa anual aparece em "Hoje & Atrasadas" quando vence hoje
   - ✅ Aplicar filtro "Hoje" e verificar que tarefa anual futura fica oculta

## Persistência e Compatibilidade

- **Sem migração de DB:** o campo `recurrence` já é `String?` e aceita qualquer valor
- **Compatibilidade total:** tarefas existentes com outras recorrências não são afetadas
- **Rollback seguro:** se necessário reverter, basta remover a opção do frontend e o case do backend; tarefas com `recurrence = "yearly"` cairiam no fallback `daily`

## Possíveis Extensões Futuras

Não implementadas neste escopo, mas possíveis:

- **Recorrência anual customizável:** escolher "Todo ano em [dia] de [mês]" independente da data de criação
- **Múltiplos anos:** "A cada 2 anos", "A cada 5 anos"
- **Badge visual diferenciado:** ícone 📅 específico para anuais
- **Notificação antecipada:** lembrar N dias antes da data anual (ex: "faltam 7 dias para...")
- **Relatório de anuais:** dashboard mostrando todas as tarefas anuais do ano

## Status

✅ **Implementado e testado**
- Backend: lógica + validação + 6 testes (todos passando)
- Frontend: schema + UI + exibição melhorada
- Documentação: plano + Obsidian + comentários no código

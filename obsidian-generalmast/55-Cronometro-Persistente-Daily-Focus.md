# 55 - Cronômetro Persistente e Independente da Interface no Daily Focus

## Contexto

O cronômetro do Daily Focus usa `setInterval` para decrementar um contador local, causando imprecisão quando o usuário:
- Troca de aba
- Minimiza o navegador
- Bloqueia a tela do celular
- Fecha e reabre o navegador

## Problema Identificado

O componente `DailyTimer.tsx` **ignora** a infraestrutura de timestamps já existente (`dailyFocusLive.ts`), causando:
- Desincronização com o FloatingModeCard (que usa a lógica correta)
- Perda de tempo quando aba fica inativa (navegadores reduzem frequência de setInterval)
- Necessidade de página aberta para cronômetro funcionar

## Solução Implementada

### Mudança de Paradigma

- ❌ **Antes**: `setInterval` decrementa contador a cada segundo
- ✅ **Depois**: `setInterval` apenas atualiza UI; tempo calculado via `liveRemaining(snapshot)`

### Arquivos Modificados

1. **`frontend/src/components/daily-focus/components/DailyTimer.tsx`**
   - Recebe snapshot completo ao invés de `initialRemaining`
   - Usa `liveRemaining(snapshot)` para calcular tempo real
   - Mantém `setInterval` apenas para atualização visual (1Hz)

2. **`frontend/src/components/daily-focus/DailyFocusPage.tsx`**
   - Passa snapshot `DailyFocusLive` para o timer
   - Adiciona verificação automática de conclusão ao retornar à página
   - Listener `visibilitychange` detecta retorno à aba

### Infraestrutura Reutilizada

Toda a lógica de timestamps já existia:
- ✅ `liveRemaining(snapshot)` em `dailyFocusLive.ts`
- ✅ Snapshot `DailyFocusLive` com `anchorTs` e `remainingSecs`
- ✅ Persistência localStorage via `useSessionPersist`
- ✅ Sincronização cross-device com backend

## Benefícios

1. **Precisão absoluta**: tempo calculado via timestamps, não afetado por throttling do navegador
2. **Funciona offline**: snapshot em localStorage permite recuperação mesmo sem conexão
3. **Cross-device**: múltiplas abas/dispositivos mostram tempo sincronizado
4. **Finalização automática**: ao retornar, verifica se tempo acabou e finaliza tarefa
5. **Compatibilidade móvel**: funciona corretamente com tela bloqueada

## Cenários de Teste

- [x] Navegação entre abas
- [x] Bloqueio de tela (celular)
- [x] Fechar e reabrir navegador
- [x] Pausa durante 15+ minutos
- [x] Finalização com navegador fechado
- [x] Múltiplas abas abertas
- [x] Pausar e retomar repetidamente
- [x] Reconexão após perda de internet
- [x] Reinicialização do backend
- [x] Deploy durante sessão ativa

## Links Relacionados

- [[34-Card-Persistente-Daily-Focus]] — FloatingModeCard que já usava lógica correta
- [[45-Sessao-Ativa-Sincronizada-Daily-Focus]] — Sincronização cross-device
- [[30-Minha-Sessao-no-Daily-Focus]] — Estrutura do Daily Focus

## Implementação

Data: 12/10/2026
Arquivos: 2 modificados (~80 linhas total)
Backend: Nenhuma alteração necessária
Banco de dados: Nenhuma migração necessária

## Melhorias Sugeridas (Fase 2)

Documento completo: [[MELHORIAS_CRONOMETRO_PERSISTENTE]] (anexo em [[64-Anexos-Daily-Focus]])

### Alta Prioridade
1. **Detecção de relógio alterado** — protege contra mudanças no relógio do sistema
2. **Limite máximo de tempo transcorrido** — previne estados absurdos (ex: -100000s)
3. **Validação de snapshot** (Zod) — previne crashes por dados corrompidos
4. **Feedback visual ao retornar** — toast mostrando tempo transcorrido enquanto fora

### Média Prioridade
5. **Botão "Adicionar 5 minutos"** — estender timer sem pausar
6. **Estimativa de conclusão** — "Termina às 15:30"
7. **Vibração ao completar (mobile)** — feedback tátil
8. **Histórico de pausas** — analytics de quando pausou durante sessão

### Baixa Prioridade (Backlog)
9. **Notificações push** — alertar quando timer acabar com app fechado
10. **Modo Pomodoro estrito** — timer que não pode ser pausado
11. **RequestAnimationFrame** — animação mais suave
12. **Estatísticas de precisão** — página de debug/transparência

ROI: Alta prioridade = alto impacto + baixo esforço ✅

---

## Complementos (migrados de `IMPLEMENTACAO_CRONOMETRO_PERSISTENTE.md` e `TESTE_CRONOMETRO_PERSISTENTE.md`)

Conteúdo que só existia nos documentos da raiz (removidos na limpeza — ver [[64-Anexos-Daily-Focus]]).

### Arquivos
| Arquivo | Mudança |
|---|---|
| `components/daily-focus/components/DailyTimer.tsx` | refatoração completa (~40 linhas) |
| `components/daily-focus/DailyFocusPage.tsx` | verificação ao retornar (~50 linhas) |
| `components/daily-focus/components/DailyTimer.test.tsx` | **novo** — 6 cenários unitários (Vitest) |
| Guia de testes manuais | [[TESTE_CRONOMETRO_PERSISTENTE]] (10 cenários detalhados) |

### Fluxos
Timer ativo (tick a partir do timestamp âncora) · Pausa (congela e re-ancora) · Retorno de aba inativa (`visibilitychange` recalcula) · Finalização automática (tempo acabou com app fora → conclui ao voltar).

### Compatibilidade
Chrome/Edge, Firefox, Safari (desktop e iOS), Opera, Brave. `Date.now()` universal; `visibilitychange` moderno (fallback: verificação na montagem); localStorage universal (fallback: sync backend); Service Worker não é requerido.

### Limitações conhecidas
1. **Sem notificação push** quando o tempo acaba com o app fechado (futuro: Web Push via Service Worker).
2. **Precisão depende do relógio do dispositivo**: troca manual de fuso/NTP pode causar saltos; o sync com o backend detecta discrepâncias e pausar/retomar recalibra (ver melhoria "detecção de relógio alterado").
3. Navegadores sem `visibilitychange`: conclusão só verificada ao recarregar (impacto < 1%).

### Debug (console)
- Ver snapshot: `JSON.parse(localStorage.getItem('taskflow.dailyFocus.live'))` (sessão persistida em `taskflow_sess_daily_focus`).
- Tempo restante: `liveRemaining(snap)` de `lib/dailyFocusLive`; forçar sync: `flushActiveSessionPush()`.
- Simular retorno após 5 min: ajustar `snap.anchorTs = Date.now() - 300000`, regravar e `location.reload()`.

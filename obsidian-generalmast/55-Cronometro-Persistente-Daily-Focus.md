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

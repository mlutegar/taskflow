# 39 - Tempo do Modo Sincronizado com o Daily Focus

Ligada a: [[0-Painel]] · [[26-Modo-Minimizavel-Card-Flutuante]] · [[2-Modos-e-Tipos]] ·
[[30-Minha-Sessao-no-Daily-Focus]] · [[34-Card-Persistente-Daily-Focus]]

## Contexto / Problema

Os **modos de auxílio** (música, cantar, diário, atividades etc.) tinham dois
comportamentos indesejados:

1. **Abriam em tela cheia** por padrão, obrigando o usuário a minimizar depois.
2. **O tempo do modo era wall-clock** (`Date.now() - startedAt`): contava também os
   períodos em que o Daily Focus estava **pausado**, distorcendo a métrica. Ex.: ativar
   um modo, focar 25 min, pausar 10 min e focar mais 20 min registrava **55 min** em vez
   dos **45 min** de foco reais.

## O que mudou

### 1) Modos abrem já minimizados
`activate` e `activateMultiCard` (`ActiveModeContext.tsx`) passaram a definir
`minimized: true`. O modo aparece direto como **card flutuante compacto**
(`FloatingModeCard`); clicar expande para tela cheia.

### 2) Tempo do modo = tempo de FOCO efetivo
Nova regra: o tempo do modo só acumula enquanto **(modo ativo) E (Daily Focus rodando)**.
- Daily Focus rodando → acumula
- Daily Focus pausado → **congela**
- Daily Focus retomado → volta a contar
- Modo encerrado → para definitivamente

Se vários modos estiverem ativos (multi-card), todos compartilham o mesmo período
efetivo de foco. Como só existe **uma** sessão (única ou multi) por vez, um único
acumulador basta.

## Arquitetura

- **`lib/modeFocusTimer.ts`** (novo): acumulador persistente
  `{ sessionKey, accumulatedMs, runningSince }` (localStorage `SK.MODE_FOCUS_TIMER`).
  - `isDailyFocusCounting()` lê o snapshot compartilhado `dailyFocusLive`
    (`running === true` e `phase ∈ {work, between}`) — mesma fonte de verdade do
    [[34-Card-Persistente-Daily-Focus]].
  - `startModeFocusTimer` / `syncModeFocusTimer` / `liveModeFocusMs` /
    `isModeFocusRunning` / `stopModeFocusTimer` / `getModeFocusMinutes`.
  - Espelha o padrão de "âncora temporal" já usado em `dailyFocusLive.ts`, sobrevivendo
    a reload/navegação.
- **`ActiveModeContext.tsx`**: inicia o acumulador em `activate`/`activateMultiCard`,
  encerra em `close`/`closeMulti`, e um `useEffect` global reconcilia
  (`syncModeFocusTimer`) no mount e a cada `DAILY_FOCUS_LIVE_EVENT`.
- **`FloatingModeCard.tsx`** e **`MultiCardSession.tsx`**: o cronômetro exibido usa
  `liveModeFocusMs()` e mostra estado **pausado** (⏸) quando o Daily Focus está parado.
- **`sessionUsageLog.logUsage`**: novo parâmetro opcional `focusMinutes`; quando presente,
  é a base de `sessionDurationMinutes` e `efficiencyPct` (substitui o wall-clock).
  Passado por `MultiCardSession` e pelo caminho single-mode
  (`ModeSession` → `PostSessionForm`).

## Impacto em analytics

`moodModeCorrelation.ts` e as agregações de `sessionUsageLog`
(`getFocusedMinutesByMode`, `getUsageStatsByMode`, `getDailyEfficiencyMap`) passam a
refletir o **tempo de foco efetivo**, tornando comparáveis métricas como tempo total de
foco por modo, eficiência, combos que funcionam melhor juntos, etc.

## Decisão de design

- **Modo iniciado sem Daily Focus rodando:** o tempo **não acumula** (fica em 0/pausado)
  até o Daily Focus entrar em foco — fiel ao objetivo "tempo de foco efetivo usando o
  modo". Se no futuro o modo for iniciado fora do Daily Focus, há fallback wall-clock em
  `logUsage` apenas quando `focusMinutes` não é informado.

## Verificação

1. Ativar um modo → aparece direto como card flutuante minimizado.
2. Iniciar o Daily Focus, focar → o cronômetro do card avança.
3. Pausar o Daily Focus → o número **congela** (⏸); retomar → continua de onde parou.
4. Exemplo 25 + 10 pausa + 20 → registro ≈ **45 min**, não 55.
5. Encerrar → `sessionUsageLog` (localStorage/backend) reflete o tempo de foco.

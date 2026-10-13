# Sugestões de Melhorias: Cronômetro Persistente no Daily Focus

## Análise da Implementação Atual

A implementação está **sólida e funcional**, reutilizando bem a infraestrutura existente. Identifiquei oportunidades de melhoria em 4 categorias:

1. **Performance e Otimização**
2. **Experiência do Usuário (UX)**
3. **Robustez e Edge Cases**
4. **Features Avançadas**

---

## 1. Performance e Otimização ⚡

### 1.1. Reduzir Re-renders do Timer

**Problema**: O `useEffect` com dependências `[snapshot.anchorTs, snapshot.remainingSecs, snapshot.running]` pode causar re-renders desnecessários.

**Solução**: Usar `useMemo` para estabilizar o snapshot:

```typescript
// DailyTimer.tsx
const stableSnapshot = useMemo(() => ({
  running: snapshot.running,
  remainingSecs: snapshot.remainingSecs,
  anchorTs: snapshot.anchorTs,
  // outros campos não afetam o cálculo
}), [snapshot.running, snapshot.remainingSecs, snapshot.anchorTs]);

useEffect(() => {
  // ... código do timer
}, [stableSnapshot.running, stableSnapshot.anchorTs, stableSnapshot.remainingSecs]);
```

**Benefício**: Menos re-renders, melhor performance em dispositivos lentos.

---

### 1.2. RequestAnimationFrame para Atualização Mais Suave

**Problema**: `setInterval(fn, 1000)` pode ter jitter visual (atrasos perceptíveis).

**Solução**: Usar `requestAnimationFrame` para animações mais suaves:

```typescript
useEffect(() => {
  if (!snapshot.running) return;
  
  let frameId: number;
  let lastUpdate = Date.now();
  
  const tick = () => {
    const now = Date.now();
    
    // Atualiza apenas a cada ~1s (evita update em todo frame)
    if (now - lastUpdate >= 1000) {
      const actualRemaining = liveRemaining(snapshot);
      
      if (actualRemaining !== null && actualRemaining > 0) {
        setDisplayTime(actualRemaining);
        onTick?.(actualRemaining);
        lastUpdate = now;
      } else {
        onComplete?.();
        return;
      }
    }
    
    frameId = requestAnimationFrame(tick);
  };
  
  frameId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frameId);
}, [snapshot.running, snapshot.anchorTs]);
```

**Benefício**: Animação mais fluida, melhor uso da bateria.

---

### 1.3. Debounce de onTick

**Problema**: `onTick` é chamado a cada segundo, pode causar overhead se o handler for pesado.

**Solução**: Adicionar debounce opcional:

```typescript
const debouncedTick = useMemo(() => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (remaining: number) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => onTick?.(remaining), 100);
  };
}, [onTick]);
```

**Benefício**: Reduz carga se `onTick` for complexo.

---

## 2. Experiência do Usuário (UX) 🎨

### 2.1. Feedback Visual ao Retornar (Timer Compensou Tempo)

**Problema**: Usuário não percebe que o timer continuou contando enquanto estava fora.

**Solução**: Animação/toast quando tempo significativo foi descontado:

```typescript
// DailyFocusPage.tsx - em checkTimerCompletion
const checkTimerCompletion = (): void => {
  const snap = loadDailyFocusLive();
  if (!snap || !snap.running) return;
  
  const remaining = liveRemaining(snap);
  const elapsed = (snap.remainingSecs ?? 0) - (remaining ?? 0);
  
  if (elapsed > 60) { // Mais de 1 minuto passou
    showToast(
      `⏱️ Você esteve fora por ${Math.floor(elapsed / 60)} minutos`,
      'info'
    );
  }
  
  if (remaining !== null && remaining <= 0) {
    handleTimerDone();
  }
};
```

**Benefício**: Feedback claro de que o sistema funcionou.

---

### 2.2. Indicador de "Tempo Sincronizado"

**Problema**: Usuário pode não confiar que o tempo está correto após retornar.

**Solução**: Ícone/badge temporário indicando sincronização:

```typescript
// DailyTimer.tsx
const [justSynced, setJustSynced] = useState(false);

useEffect(() => {
  const remaining = liveRemaining(snapshot);
  if (remaining !== null) {
    setDisplayTime(remaining);
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 2000); // 2s
  }
}, [snapshot.anchorTs]);

// No JSX
{justSynced && (
  <span className={styles.syncBadge}>
    <RefreshCw size={12} /> Sincronizado
  </span>
)}
```

**Benefício**: Aumenta confiança do usuário no sistema.

---

### 2.3. Notificações Push (Feature Avançada)

**Problema**: Usuário não sabe quando o timer acabou com app fechado.

**Solução**: Implementar Service Worker com notificações:

```typescript
// sw.ts - Service Worker
self.addEventListener('message', (event) => {
  if (event.data.type === 'SCHEDULE_TIMER_NOTIFICATION') {
    const { remainingSecs, taskTitle } = event.data;
    
    setTimeout(() => {
      self.registration.showNotification('⏰ Tempo esgotado!', {
        body: `Tarefa "${taskTitle}" completada`,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'daily-focus-timer',
        requireInteraction: true,
      });
    }, remainingSecs * 1000);
  }
});

// frontend/src/lib/dailyFocusLive.ts
export function scheduleTimerNotification(snap: DailyFocusLive): void {
  if (!('serviceWorker' in navigator)) return;
  if (Notification.permission !== 'granted') return;
  
  const remaining = liveRemaining(snap);
  if (remaining === null || remaining <= 0) return;
  
  navigator.serviceWorker.controller?.postMessage({
    type: 'SCHEDULE_TIMER_NOTIFICATION',
    remainingSecs: remaining,
    taskTitle: snap.taskTitle,
  });
}
```

**Benefício**: Usuário é notificado mesmo com app fechado.

**Complexidade**: Alta — requer permissões, testes em múltiplos navegadores.

---

### 2.4. Vibração ao Completar (Mobile)

**Problema**: Em celular bloqueado, usuário pode não perceber conclusão visual.

**Solução**: Vibrar ao completar tarefa:

```typescript
// DailyTimer.tsx - em onComplete
if (actualRemaining <= 0) {
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]); // Padrão: bip-bip
  }
  onComplete?.();
}
```

**Benefício**: Feedback tátil em dispositivos móveis.

---

### 2.5. Botão "Adicionar 5 Minutos"

**Problema**: Tarefa está quase acabando, usuário precisa de mais tempo.

**Solução**: Botão para estender timer rapidamente:

```typescript
// DailyFocusPage.tsx
const handleAddTime = (minutes: number): void => {
  const snap = liveSnapRef.current;
  if (!snap) return;
  
  const currentRemaining = liveRemaining(snap) ?? 0;
  const newRemaining = currentRemaining + (minutes * 60);
  
  setTimerRemaining(newRemaining);
  
  // Atualizar snapshot
  saveDailyFocusLive({
    ...snap,
    remainingSecs: newRemaining,
    anchorTs: Date.now(),
  });
  
  showToast(`⏱️ +${minutes} minutos adicionados`, 'success');
};

// No JSX (aparecer quando faltam < 2 min)
{timerRemaining !== null && timerRemaining < 120 && timerRemaining > 0 && (
  <button onClick={() => handleAddTime(5)} className={styles.addTimeBtn}>
    +5 min
  </button>
)}
```

**Benefício**: Flexibilidade sem interromper fluxo.

---

## 3. Robustez e Edge Cases 🛡️

### 3.1. Detecção de Relógio Alterado

**Problema**: Se usuário mudar relógio do sistema, cálculo fica incorreto.

**Solução**: Comparar com timestamp do servidor periodicamente:

```typescript
// frontend/src/lib/clockDrift.ts
let lastServerTime: number | null = null;
let lastLocalTime: number | null = null;

export async function checkClockDrift(): Promise<number> {
  const localBefore = Date.now();
  const response = await fetch('/api/server-time');
  const { serverTime } = await response.json();
  const localAfter = Date.now();
  
  const rtt = localAfter - localBefore; // Round-trip time
  const estimatedServerTime = serverTime + (rtt / 2);
  const drift = localAfter - estimatedServerTime;
  
  if (lastServerTime && Math.abs(drift) > 5000) { // > 5s de drift
    console.warn('[ClockDrift] Detected:', drift, 'ms');
    // Poderia forçar resync ou alertar usuário
  }
  
  lastServerTime = serverTime;
  lastLocalTime = localAfter;
  
  return drift;
}

// DailyFocusPage.tsx - verificar a cada 5 minutos
useEffect(() => {
  const interval = setInterval(() => {
    checkClockDrift();
  }, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, []);
```

**Benefício**: Detecta mudanças de relógio do sistema.

---

### 3.2. Limite Máximo de Tempo Transcorrido

**Problema**: Se usuário ficar offline por dias, timer pode mostrar valores absurdos.

**Solução**: Limitar tempo máximo transcorrido:

```typescript
// frontend/src/lib/dailyFocusLive.ts
const MAX_ELAPSED_HOURS = 24; // Máximo de 24h offline

export function liveRemaining(snap: DailyFocusLive, now: number = Date.now()): number | null {
  if (snap.remainingSecs == null) return null;
  if (!snap.running) return Math.max(0, snap.remainingSecs);
  
  const elapsed = (now - snap.anchorTs) / 1000;
  
  // Proteção: se passou mais de 24h, assumir que sessão expirou
  if (elapsed > MAX_ELAPSED_HOURS * 3600) {
    console.warn('[liveRemaining] Session expired (>24h elapsed)');
    return 0; // Forçar conclusão
  }
  
  return Math.max(0, Math.round(snap.remainingSecs - elapsed));
}
```

**Benefício**: Evita estados absurdos (ex: -100000 segundos).

---

### 3.3. Retry com Exponential Backoff na Sincronização

**Problema**: Se backend estiver offline, sincronização falha permanentemente.

**Solução**: Implementar retry inteligente:

```typescript
// frontend/src/lib/dailyFocusLive.ts
let retryCount = 0;
const MAX_RETRIES = 5;

async function pushActiveSessionWithRetry(snap: DailyFocusLive): Promise<void> {
  try {
    await upsertActiveSession(snap);
    retryCount = 0; // Reset ao sucesso
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30s
      retryCount++;
      
      console.log(`[ActiveSession] Retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
      
      setTimeout(() => {
        pushActiveSessionWithRetry(snap);
      }, delay);
    } else {
      console.error('[ActiveSession] Max retries reached');
      // Mostrar toast ao usuário?
    }
  }
}
```

**Benefício**: Resiliência a falhas temporárias de rede.

---

### 3.4. Validação de Snapshot

**Problema**: Snapshot corrompido no localStorage pode crashar o app.

**Solução**: Validar snapshot antes de usar:

```typescript
// frontend/src/lib/dailyFocusLive.ts
import { z } from 'zod';

const DailyFocusLiveSchema = z.object({
  taskTitle: z.string(),
  phase: z.string(),
  running: z.boolean(),
  remainingSecs: z.number().nullable(),
  anchorTs: z.number(),
  totalSecs: z.number(),
  rushMode: z.boolean(),
  tabMode: z.boolean(),
  cycleCount: z.number(),
  nextTaskTitle: z.string(),
  taskIndex: z.number(),
  taskCount: z.number(),
});

export function loadDailyFocusLive(): DailyFocusLive | null {
  try {
    const raw = storageGet<DailyFocusLive | null>(SK.DAILY_FOCUS_LIVE, null);
    if (!raw) return null;
    
    // Validar com Zod
    const validated = DailyFocusLiveSchema.parse(raw);
    return validated;
  } catch (error) {
    console.error('[loadDailyFocusLive] Invalid snapshot:', error);
    storageRemove(SK.DAILY_FOCUS_LIVE); // Limpar corrompido
    return null;
  }
}
```

**Benefício**: Previne crashes por dados corrompidos.

---

### 3.5. Heartbeat para Detectar Crash

**Problema**: Se app crashar durante sessão, snapshot fica "stuck" como running.

**Solução**: Heartbeat periódico que marca timestamp:

```typescript
// frontend/src/lib/dailyFocusLive.ts
const HEARTBEAT_INTERVAL = 10000; // 10s
const HEARTBEAT_TIMEOUT = 60000;  // 1 min sem heartbeat = crash

export function startHeartbeat(): void {
  const interval = setInterval(() => {
    const snap = loadDailyFocusLive();
    if (snap && snap.running) {
      storageSet(SK.DAILY_FOCUS_HEARTBEAT, Date.now());
    }
  }, HEARTBEAT_INTERVAL);
  
  // Cleanup
  window.addEventListener('beforeunload', () => clearInterval(interval));
}

export function checkForCrash(): boolean {
  const lastHeartbeat = storageGet<number>(SK.DAILY_FOCUS_HEARTBEAT, 0);
  const elapsed = Date.now() - lastHeartbeat;
  
  return elapsed > HEARTBEAT_TIMEOUT;
}

// DailyFocusPage.tsx - ao montar
useEffect(() => {
  if (checkForCrash()) {
    console.warn('[DailyFocus] Detected crash, cleaning up session');
    clearDailyFocusLive();
  }
  
  startHeartbeat();
}, []);
```

**Benefício**: Detecta e limpa sessões "zumbis".

---

## 4. Features Avançadas 🚀

### 4.1. Histórico de Pausas

**Problema**: Usuário pode querer revisar quando pausou durante a sessão.

**Solução**: Registrar log de pausas:

```typescript
// frontend/src/lib/dailyFocusLive.ts
interface PauseEntry {
  pausedAt: number;  // timestamp
  resumedAt?: number;
  duration?: number; // segundos pausados
}

export interface DailyFocusLive {
  // ... campos existentes
  pauseHistory?: PauseEntry[]; // ✅ NOVO
}

// DailyFocusPage.tsx - ao pausar
const handlePause = (): void => {
  const snap = liveSnapRef.current;
  if (!snap) return;
  
  const remaining = liveRemaining(snap);
  setTimerRemaining(remaining ?? 0);
  setTimerRunning(false);
  
  // Registrar pausa
  const pauseHistory = snap.pauseHistory ?? [];
  pauseHistory.push({
    pausedAt: Date.now(),
  });
  
  saveDailyFocusLive({
    ...snap,
    running: false,
    remainingSecs: remaining,
    pauseHistory,
  });
};

// Ao retomar - atualizar última pausa
const handleResume = (): void => {
  const snap = liveSnapRef.current;
  if (!snap) return;
  
  const pauseHistory = [...(snap.pauseHistory ?? [])];
  const lastPause = pauseHistory[pauseHistory.length - 1];
  
  if (lastPause && !lastPause.resumedAt) {
    lastPause.resumedAt = Date.now();
    lastPause.duration = (Date.now() - lastPause.pausedAt) / 1000;
  }
  
  setTimerRunning(true);
  
  saveDailyFocusLive({
    ...snap,
    running: true,
    anchorTs: Date.now(),
    pauseHistory,
  });
};
```

**Benefício**: Análise pós-sessão (quantas pausas, duração média).

---

### 4.2. Modo "Pomodoro Estrito"

**Problema**: Alguns usuários querem timer que NÃO pode ser pausado.

**Solução**: Opção "modo bloqueado":

```typescript
// DailyFocusPage.tsx
const [timerLocked, setTimerLocked] = useState(false);

// Ao iniciar sessão
<label>
  <input 
    type="checkbox" 
    checked={timerLocked}
    onChange={(e) => setTimerLocked(e.target.checked)}
  />
  🔒 Bloquear timer (não pode pausar)
</label>

// Botão Pausar fica desabilitado
<button 
  onClick={handlePause} 
  disabled={timerLocked}
  className={timerLocked ? styles.btnDisabled : ''}
>
  Pausar
</button>
```

**Benefício**: Disciplina para usuários que se distraem.

---

### 4.3. Estimativa de Conclusão

**Problema**: Usuário não sabe a que horas vai terminar.

**Solução**: Mostrar horário estimado de conclusão:

```typescript
// DailyTimer.tsx
const estimatedEndTime = useMemo(() => {
  const remaining = liveRemaining(snapshot);
  if (remaining === null || remaining <= 0) return null;
  
  const endMs = Date.now() + (remaining * 1000);
  return new Date(endMs).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}, [snapshot]);

// No JSX
{estimatedEndTime && (
  <span className={styles.estimatedEnd}>
    Termina às {estimatedEndTime}
  </span>
)}
```

**Benefício**: Planejamento do tempo restante do dia.

---

### 4.4. Estatísticas de Precisão do Timer

**Problema**: Usuário pode duvidar da precisão do sistema.

**Solução**: Página de debug/stats:

```typescript
// frontend/src/pages/TimerStatsPage.tsx
export function TimerStatsPage() {
  const [stats, setStats] = useState<{
    totalSessions: number;
    avgDriftMs: number;
    maxDriftMs: number;
    syncSuccessRate: number;
  } | null>(null);
  
  useEffect(() => {
    // Calcular estatísticas do histórico
    const sessions = getHistory();
    
    const drifts = sessions.map(s => {
      const expected = s.totalSecs;
      const actual = s.timings.reduce((sum, t) => sum + t.used * 60, 0);
      return Math.abs(expected - actual);
    });
    
    setStats({
      totalSessions: sessions.length,
      avgDriftMs: drifts.reduce((a, b) => a + b, 0) / drifts.length * 1000,
      maxDriftMs: Math.max(...drifts) * 1000,
      syncSuccessRate: 0.98, // Calcular de verdade
    });
  }, []);
  
  return (
    <div>
      <h1>📊 Estatísticas do Timer</h1>
      {stats && (
        <ul>
          <li>Sessões totais: {stats.totalSessions}</li>
          <li>Drift médio: {stats.avgDriftMs.toFixed(0)}ms</li>
          <li>Drift máximo: {stats.maxDriftMs.toFixed(0)}ms</li>
          <li>Taxa de sucesso: {(stats.syncSuccessRate * 100).toFixed(1)}%</li>
        </ul>
      )}
    </div>
  );
}
```

**Benefício**: Transparência e confiança no sistema.

---

## 5. Melhorias de Código 🧹

### 5.1. Extrair Hook Customizado

**Problema**: Lógica do timer está toda no componente.

**Solução**: Criar `usePersistedTimer`:

```typescript
// frontend/src/hooks/usePersistedTimer.ts
export function usePersistedTimer(
  snapshot: DailyFocusLive,
  onTick?: (remaining: number) => void,
  onComplete?: () => void
): {
  displayTime: number;
  progress: number;
  isLow: boolean;
  isWarning: boolean;
} {
  const firedRef = useRef(false);
  const initialRemaining = liveRemaining(snapshot) ?? 0;
  const [displayTime, setDisplayTime] = useState(initialRemaining);
  
  // ... lógica do timer
  
  const progress = Math.max(0, Math.min(1, 
    (snapshot.totalSecs - displayTime) / snapshot.totalSecs
  ));
  const isLow = displayTime <= 60 && displayTime > 0;
  const isWarning = progress >= 0.8 && !isLow;
  
  return { displayTime, progress, isLow, isWarning };
}

// DailyTimer.tsx (simplificado)
function DailyTimer({ snapshot, onTick, onComplete }) {
  const { displayTime, progress, isLow, isWarning } = usePersistedTimer(
    snapshot,
    onTick,
    onComplete
  );
  
  return (
    // ... JSX
  );
}
```

**Benefício**: Reutilizável, testável, mais limpo.

---

### 5.2. Adicionar PropTypes ou Validação Runtime

**Problema**: Props inválidas podem causar bugs silenciosos.

**Solução**: Validar props com Zod:

```typescript
// DailyTimer.tsx
import { z } from 'zod';

const DailyTimerPropsSchema = z.object({
  totalSeconds: z.number().positive(),
  snapshot: DailyFocusLiveSchema,
  onTick: z.function().optional(),
  onComplete: z.function().optional(),
});

function DailyTimer(props: DailyTimerProps) {
  if (process.env.NODE_ENV === 'development') {
    try {
      DailyTimerPropsSchema.parse(props);
    } catch (error) {
      console.error('[DailyTimer] Invalid props:', error);
    }
  }
  
  // ... resto do componente
}
```

**Benefício**: Detecta bugs cedo em desenvolvimento.

---

## Priorização 🎯

### Alta Prioridade (Implementar Primeiro)
1. ✅ **Detecção de relógio alterado** (3.1) — protege contra bugs graves
2. ✅ **Limite máximo de tempo transcorrido** (3.2) — previne estados absurdos
3. ✅ **Validação de snapshot** (3.4) — previne crashes
4. ✅ **Feedback visual ao retornar** (2.1) — melhora UX sem complexidade

### Média Prioridade (Próximas Sprints)
5. ⏳ **Botão "Adicionar 5 minutos"** (2.5) — feature útil, simples
6. ⏳ **Estimativa de conclusão** (4.3) — valor alto, complexidade baixa
7. ⏳ **Vibração ao completar** (2.4) — específico mobile, fácil
8. ⏳ **Histórico de pausas** (4.1) — analytics interessante

### Baixa Prioridade (Backlog)
9. 📋 **Notificações push** (2.3) — alto valor mas alta complexidade
10. 📋 **Modo Pomodoro estrito** (4.2) — nicho
11. 📋 **RequestAnimationFrame** (1.2) — otimização marginal
12. 📋 **Estatísticas de precisão** (4.4) — debug/transparência

---

## Implementação Sugerida (Fase 2)

### Sprint 1: Robustez
```
- [ ] Detecção de relógio alterado (3.1)
- [ ] Limite máximo de tempo (3.2)
- [ ] Validação de snapshot (3.4)
- [ ] Testes para edge cases
```

### Sprint 2: UX
```
- [ ] Feedback visual ao retornar (2.1)
- [ ] Indicador "Sincronizado" (2.2)
- [ ] Botão "Adicionar tempo" (2.5)
- [ ] Estimativa de conclusão (4.3)
```

### Sprint 3: Features Avançadas
```
- [ ] Vibração mobile (2.4)
- [ ] Histórico de pausas (4.1)
- [ ] Retry com backoff (3.3)
- [ ] Hook usePersistedTimer (5.1)
```

### Futuro (Backlog)
```
- [ ] Notificações push (2.3)
- [ ] Modo bloqueado (4.2)
- [ ] Heartbeat crash detection (3.5)
- [ ] Página de estatísticas (4.4)
```

---

## Conclusão

A implementação atual é **sólida** e resolve o problema principal muito bem. As melhorias sugeridas focam em:

1. **Robustez**: Proteger contra edge cases (relógio alterado, sessões zumbis)
2. **UX**: Feedback claro e features úteis (adicionar tempo, estimativa)
3. **Performance**: Otimizações marginais (RAF, debounce)
4. **Avançado**: Features complexas para roadmap futuro (push, analytics)

**Recomendação**: Implementar primeiro os itens de **alta prioridade** (validação, limites, feedback) e avaliar feedback dos usuários antes de investir em features complexas como notificações push.

**ROI estimado**:
- Alta prioridade: **alto impacto, baixo esforço** ✅
- Média prioridade: **médio impacto, baixo esforço** ⏳
- Baixa prioridade: **médio impacto, alto esforço** 📋

---

**Data**: 13/10/2026  
**Versão da Implementação Base**: v1.0 (commit 2b4ffb3)  
**Autor das Sugestões**: Claude (análise do código implementado)

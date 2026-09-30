/**
 * modeFocusTimer.ts — acumulador de "tempo de foco do modo", sincronizado com o Daily Focus.
 *
 * Problema: antes, o tempo de uso de um modo era wall-clock (`Date.now() - startedAt`),
 * contando inclusive os períodos em que o Daily Focus estava PAUSADO. Isso distorcia a
 * métrica de eficiência ("quanto tempo de foco realizei usando este modo").
 *
 * Solução: o tempo do modo só acumula enquanto (modo ativo) E (Daily Focus rodando).
 * Usamos como sinal o snapshot compartilhado `dailyFocusLive` (`running` + `phase`):
 *   - Daily Focus rodando (running && phase com timer) → acumula;
 *   - Daily Focus pausado / sem sessão de foco           → congela.
 *
 * Além do tempo de foco, o acumulador captura métricas ricas "de graça" para análise:
 *   - `pauseCount`     — nº de vezes que o foco foi pausado (transições foco→pausa);
 *   - `pausedMs`       — tempo total pausado com o modo ativo;
 *   - `blocks`         — nº de blocos de foco (fragmentação: 45min corridos ≠ 45min em 9 pedaços);
 *   - `tasksCompleted` — tarefas concluídas enquanto o modo estava ativo.
 *
 * Robustez: um heartbeat (`lastSeenTs`) é atualizado a cada `syncModeFocusTimer`. Se o
 * app dormir/fechar com o Daily Focus "rodando", o tempo não confiável além de
 * `SYNC_GRACE_MS` é DESCARTADO (não conta como foco), evitando super-contagem em
 * reload/background. Um teto por reconciliação também protege contra saltos de relógio.
 *
 * Estado persistido (localStorage) espelha o padrão de "âncora temporal" já usado no
 * FloatingModeCard/dailyFocusLive, sobrevivendo a reload/navegação. Como só existe UMA
 * sessão (única ou multi-card) ativa por vez, um único acumulador basta; `sessionKey`
 * permite estender para um mapa por modo caso surjam modos verdadeiramente paralelos.
 */
import { storageGet, storageSet, storageRemove } from "./storage";
import { SK } from "./storageKeys";
import { loadDailyFocusLive } from "./dailyFocusLive";

/** Margem além da qual tempo "rodando" sem heartbeat é considerado background e descartado. */
const SYNC_GRACE_MS = 20_000;
/** Teto de sanidade por reconciliação (protege contra saltos de relógio / sono profundo). */
const MAX_STEP_MS = 6 * 60 * 60 * 1000; // 6h

interface ModeFocusTimerState {
  /** Chave da sessão de modo (o `startedAt` ISO) — permite detectar sessão trocada. */
  sessionKey: string;
  /** Milissegundos de foco já commitados (fora do trecho em andamento). */
  accumulatedMs: number;
  /** Timestamp (Date.now) da âncora do trecho em andamento; null = pausado. */
  runningSince: number | null;
  /** Último heartbeat confiável (Date.now). */
  lastSeenTs: number;
  /** Início da pausa atual (Date.now); null = não está pausado. */
  pausedSince: number | null;
  /** Nº de transições foco→pausa. */
  pauseCount: number;
  /** Tempo total pausado (ms) com o modo ativo. */
  pausedMs: number;
  /** Nº de blocos de foco iniciados (fragmentação). */
  blocks: number;
  /** Tarefas concluídas enquanto o modo esteve ativo. */
  tasksCompleted: number;
}

export interface ModeFocusStats {
  focusMinutes: number;
  pauseCount: number;
  pausedMinutes: number;
  focusBlocks: number;
  tasksCompleted: number;
}

/** true quando o Daily Focus está efetivamente em foco (rodando e em fase com timer). */
function isDailyFocusCounting(): boolean {
  const live = loadDailyFocusLive();
  if (!live) return false;
  const hasTimer = live.phase === "work" || live.phase === "between";
  return !!live.running && hasTimer;
}

function loadState(): ModeFocusTimerState | null {
  return storageGet<ModeFocusTimerState | null>(SK.MODE_FOCUS_TIMER, null);
}

function saveState(s: ModeFocusTimerState): void {
  storageSet(SK.MODE_FOCUS_TIMER, s);
}

/** Tempo confiável decorrido do trecho em andamento, com teto e grace de heartbeat. */
function trustedRunMs(s: ModeFocusTimerState, now: number): number {
  if (s.runningSince == null) return 0;
  const cap = Math.min(now, s.lastSeenTs + SYNC_GRACE_MS);
  return Math.max(0, Math.min(cap - s.runningSince, MAX_STEP_MS));
}

/** Inicia (zera) o acumulador para uma nova sessão de modo. */
export function startModeFocusTimer(sessionKey: string, now: number = Date.now()): void {
  const counting = isDailyFocusCounting();
  saveState({
    sessionKey,
    accumulatedMs: 0,
    runningSince: counting ? now : null,
    lastSeenTs: now,
    pausedSince: counting ? null : now,
    pauseCount: 0,
    pausedMs: 0,
    blocks: counting ? 1 : 0,
    tasksCompleted: 0,
  });
}

/**
 * Reconcilia o acumulador com o estado atual do Daily Focus. Deve ser chamado sempre que
 * o snapshot `dailyFocusLive` mudar (evento DAILY_FOCUS_LIVE_EVENT), num heartbeat
 * periódico e no mount. Idempotente.
 */
export function syncModeFocusTimer(now: number = Date.now()): void {
  const s = loadState();
  if (!s) return;
  const counting = isDailyFocusCounting();

  if (counting && s.runningSince == null) {
    // Retoma o foco: fecha a pausa em andamento e abre um novo bloco.
    if (s.pausedSince != null) {
      s.pausedMs += Math.max(0, Math.min(now - s.pausedSince, MAX_STEP_MS));
      s.pausedSince = null;
    }
    s.runningSince = now;
    s.blocks += 1;
  } else if (!counting && s.runningSince != null) {
    // Pausa o foco: commita o trecho confiável e abre uma pausa.
    s.accumulatedMs += trustedRunMs(s, now);
    s.runningSince = null;
    s.pausedSince = now;
    s.pauseCount += 1;
  } else if (counting && s.runningSince != null) {
    // Segue em foco: checkpoint — commita o confiável e rola a âncora p/ evitar perder
    // tempo entre eventos e para descartar background além do grace.
    s.accumulatedMs += trustedRunMs(s, now);
    s.runningSince = now;
  }
  // (else: segue pausado — nada a fazer além do heartbeat)

  s.lastSeenTs = now;
  saveState(s);
}

/** Milissegundos de foco AO VIVO (acumulado + trecho confiável em andamento). */
export function liveModeFocusMs(now: number = Date.now()): number {
  const s = loadState();
  if (!s) return 0;
  return s.accumulatedMs + trustedRunMs(s, now);
}

/** true quando o acumulador está contando agora (Daily Focus em foco). */
export function isModeFocusRunning(): boolean {
  const s = loadState();
  return !!s && s.runningSince != null;
}

/** Incrementa o contador de tarefas concluídas com o modo ativo (no-op se sem sessão). */
export function incrementModeTaskCount(): void {
  const s = loadState();
  if (!s) return;
  s.tasksCompleted += 1;
  saveState(s);
}

/** Estatísticas AO VIVO da sessão de modo atual (ou zeros se não houver). */
export function getModeFocusStats(now: number = Date.now()): ModeFocusStats {
  const s = loadState();
  if (!s) return { focusMinutes: 0, pauseCount: 0, pausedMinutes: 0, focusBlocks: 0, tasksCompleted: 0 };
  const focusMs = s.accumulatedMs + trustedRunMs(s, now);
  const pausedMs = s.pausedMs + (s.pausedSince != null ? Math.max(0, Math.min(now - s.pausedSince, MAX_STEP_MS)) : 0);
  return {
    focusMinutes: Math.max(0, Math.round(focusMs / 60000)),
    pauseCount: s.pauseCount,
    pausedMinutes: Math.max(0, Math.round(pausedMs / 60000)),
    focusBlocks: s.blocks,
    tasksCompleted: s.tasksCompleted,
  };
}

/** Encerra o acumulador e retorna as estatísticas finais, limpando o estado. */
export function stopModeFocusTimer(now: number = Date.now()): ModeFocusStats {
  const stats = getModeFocusStats(now);
  storageRemove(SK.MODE_FOCUS_TIMER);
  return stats;
}

/** Total de foco atual em minutos (arredondado, nunca negativo). */
export function getModeFocusMinutes(now: number = Date.now()): number {
  return getModeFocusStats(now).focusMinutes;
}

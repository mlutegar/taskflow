/**
 * dailyFocusLive.ts — snapshot leve da sessão ativa do Daily Focus.
 *
 * Fonte de verdade COMPARTILHADA entre a página (DailyFocusPage, que monta/desmonta
 * conforme o roteamento por hash) e o card flutuante persistente (montado acima do
 * roteador, em main.tsx). Permite que a sessão continue visível — e o timer possa
 * continuar rodando — enquanto o usuário navega por outras páginas.
 *
 * O tempo é representado por uma ÂNCORA temporal (mesmo padrão do `startedAt` do
 * FloatingModeCard): `remainingSecs` é o restante capturado em `anchorTs`. Assim o
 * card calcula o tempo ao vivo sem "possuir" o interval do timer, e a página rehidrata
 * o mesmo valor ao voltar, descontando o tempo decorrido em background.
 */
import { z } from "zod";
import { storageGet, storageSet, storageRemove } from "./storage";
import { SK } from "./storageKeys";
import { fetchActiveSession, upsertActiveSession, deleteActiveSession, beaconActiveSession } from "../api/dailyFocusActiveSession";

// ── Constantes de segurança ──────────────────────────────────────────────────

/** Máximo de horas offline antes de forçar conclusão da sessão */
const MAX_ELAPSED_HOURS = 24;

// ── Validação com Zod ────────────────────────────────────────────────────────

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
  pauseHistory: z.array(z.object({
    pausedAt: z.number(),
    resumedAt: z.number().optional(),
    duration: z.number().optional(),
  })).optional(),
});

/** Chave (fora do prefixo "taskflow.") usada pelo useSessionPersist para o Daily Focus. */
const SESSION_LS_KEY = "taskflow_sess_daily_focus";

function todayIso(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function readSessionPayload(): unknown {
  try {
    const raw = localStorage.getItem(SESSION_LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Entrada no histórico de pausas */
export interface PauseEntry {
  pausedAt: number;
  resumedAt?: number;
  duration?: number; // segundos pausados
}

export interface DailyFocusLive {
  /** Título da tarefa atual. */
  taskTitle: string;
  /** Fase da sessão — o card só aparece em fases com timer ("work"/"between"). */
  phase: string;
  /** true = em foco (contando); false = pausado. */
  running: boolean;
  /** Segundos restantes capturados no instante da âncora (null em rush/tab). */
  remainingSecs: number | null;
  /** Date.now() em que remainingSecs foi capturado. */
  anchorTs: number;
  /** Duração total da tarefa em segundos (para barra/percentual). */
  totalSecs: number;
  /** rush/tab não têm contagem regressiva → mostra tempo decorrido. */
  rushMode: boolean;
  /** Sessão em modo "abas" (tab) — mostra ciclos em vez de contagem. */
  tabMode: boolean;
  /** Ciclos completos no modo tab (rótulo informativo). */
  cycleCount: number;
  /** Título da próxima tarefa (mostrado no painel expandido do card). */
  nextTaskTitle: string;
  /** Índice da tarefa atual (0-based) e total — rótulo "Tarefa i/N". */
  taskIndex: number;
  taskCount: number;
  /** Histórico de pausas durante a sessão (analytics) */
  pauseHistory?: PauseEntry[];
}

/** Evento disparado sempre que o snapshot é gravado/limpo (o card escuta p/ atualizar). */
export const DAILY_FOCUS_LIVE_EVENT = "daily-focus-live-updated";

/** Lê o snapshot atual (ou null), com validação Zod. */
export function loadDailyFocusLive(): DailyFocusLive | null {
  try {
    const raw = storageGet<DailyFocusLive | null>(SK.DAILY_FOCUS_LIVE, null);
    if (!raw) return null;

    // Validar snapshot com Zod
    const validated = DailyFocusLiveSchema.parse(raw);
    return validated;
  } catch (error) {
    console.error('[loadDailyFocusLive] Invalid snapshot, clearing:', error);
    storageRemove(SK.DAILY_FOCUS_LIVE); // Limpar snapshot corrompido
    return null;
  }
}

/** Grava o snapshot e notifica ouvintes. */
export function saveDailyFocusLive(snap: DailyFocusLive): void {
  storageSet(SK.DAILY_FOCUS_LIVE, snap);
  try { window.dispatchEvent(new Event(DAILY_FOCUS_LIVE_EVENT)); } catch { /* noop */ }
  // Sincroniza a sessão ativa com o backend (debounced) p/ reidratar em outro device.
  schedulePushActiveSession(snap);
}

/** Remove o snapshot e notifica ouvintes. */
export function clearDailyFocusLive(): void {
  storageRemove(SK.DAILY_FOCUS_LIVE);
  try { window.dispatchEvent(new Event(DAILY_FOCUS_LIVE_EVENT)); } catch { /* noop */ }
}

// ── Sincronização cross-device da sessão ativa ────────────────────────────────

const PUSH_DEBOUNCE_MS = 2500;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSnap: DailyFocusLive | null = null;
let pushInFlight = false;

/** Versão que já sincronizamos com o servidor (base para o próximo PUT). */
function getKnownVersion(): number {
  return storageGet<number>(SK.DAILY_FOCUS_ACTIVE_VERSION, 0);
}
function setKnownVersion(v: number): void {
  storageSet(SK.DAILY_FOCUS_ACTIVE_VERSION, v);
}

/** Há edições locais ainda não confirmadas pelo servidor? */
function hasPendingLocalWrite(): boolean {
  return pushTimer !== null || pendingSnap !== null || pushInFlight;
}

async function doPush(): Promise<void> {
  pushTimer = null;
  const snap = pendingSnap;
  pendingSnap = null;
  if (!snap) return;

  const focusTimer = storageGet<unknown | null>(SK.MODE_FOCUS_TIMER, null);
  const session = readSessionPayload();

  pushInFlight = true;
  try {
    let res = await upsertActiveSession(snap, session, focusTimer, getKnownVersion());
    // 409: alguém gravou entre o nosso read e write. Adota a versão do servidor
    // como base e re-tenta UMA vez (last-writer-wins com base fresca).
    if (res.status === "conflict") {
      setKnownVersion(res.version);
      res = await upsertActiveSession(snap, session, focusTimer, res.version);
    }
    if (res.status === "ok") setKnownVersion(res.version);
  } finally {
    pushInFlight = false;
  }
}

/**
 * Agenda um push (debounced) do estado atual. Em transições importantes
 * (play/pause/troca de tarefa) chame com flush=true para enviar imediatamente.
 */
export function schedulePushActiveSession(snap: DailyFocusLive, flush = false): void {
  pendingSnap = snap;
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  if (flush) { void doPush(); return; }
  pushTimer = setTimeout(() => { void doPush(); }, PUSH_DEBOUNCE_MS);
}

/** Força o envio imediato do último estado pendente (ou de `snap`). */
export function flushActiveSessionPush(snap?: DailyFocusLive): void {
  if (snap) pendingSnap = snap;
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  void doPush();
}

/**
 * Envio best-effort que sobrevive ao fechamento da aba/app (pagehide) via
 * fetch keepalive. Usa o snapshot pendente ou o último gravado.
 */
export function beaconActiveSessionNow(): void {
  const snap = pendingSnap ?? loadDailyFocusLive();
  if (!snap) return;
  if (snap.phase !== "work" && snap.phase !== "between") return;
  const focusTimer = storageGet<unknown | null>(SK.MODE_FOCUS_TIMER, null);
  beaconActiveSession(snap, readSessionPayload(), focusTimer, getKnownVersion());
}

/** Cancela qualquer push pendente (usar antes de encerrar a sessão remota). */
function cancelPendingPush(): void {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  pendingSnap = null;
}

/**
 * Encerra a sessão ativa no backend (tombstone; `hard` apaga a linha).
 * Cancela pushes pendentes e zera a versão local para não recriar o registro.
 */
export function endRemoteActiveSession(hard = false): void {
  cancelPendingPush();
  storageRemove(SK.DAILY_FOCUS_ACTIVE_VERSION);
  void deleteActiveSession(hard);
}

/**
 * Carrega a sessão ativa do backend e, se houver novidade, grava de volta nos
 * localStorage keys que a página/card leem no boot. Dispara o evento live para
 * que a DailyFocusPage (se já montada) reidrate.
 *
 * Resolução de conflito por VERSÃO (contador monotônico do servidor), imune a
 * relógio. Registrado no useRemoteSync e chamado em visibilitychange/online.
 */
export async function loadRemoteActiveSession(): Promise<void> {
  // Edições locais ainda não confirmadas têm prioridade — não sobrescreve.
  if (hasPendingLocalWrite()) return;

  const remote = await fetchActiveSession();
  if (!remote) return;
  if (remote.date !== todayIso()) return;

  // Tombstone: a sessão foi encerrada em outro dispositivo. Limpa o estado local.
  if (remote.endedAt) {
    const local = loadDailyFocusLive();
    setKnownVersion(remote.version);
    if (local) {
      try { localStorage.removeItem(SESSION_LS_KEY); } catch { /* noop */ }
      clearDailyFocusLive();
    }
    return;
  }

  if (!remote.live) return;
  const remoteLive = remote.live as DailyFocusLive;
  // Só reidrata sessões que tenham timer (work/between).
  if (remoteLive.phase !== "work" && remoteLive.phase !== "between") return;

  // Nada novo: já conhecemos essa versão (ou mais nova) e temos snapshot local.
  const local = loadDailyFocusLive();
  if (local && remote.version <= getKnownVersion()) return;

  // Grava os três snapshots que a página/card consomem no boot.
  storageSet(SK.DAILY_FOCUS_LIVE, remoteLive);
  try {
    if (remote.session && typeof remote.session === "object") {
      localStorage.setItem(SESSION_LS_KEY, JSON.stringify(remote.session));
    }
  } catch { /* noop */ }
  if (remote.focusTimer != null) storageSet(SK.MODE_FOCUS_TIMER, remote.focusTimer);
  setKnownVersion(remote.version);

  try { window.dispatchEvent(new Event(DAILY_FOCUS_LIVE_EVENT)); } catch { /* noop */ }
}

/**
 * Encerra a sessão do Daily Focus a partir do card (fora da página): limpa o snapshot
 * live E o estado de sessão persistido (`taskflow_sess_daily_focus`, do useSessionPersist).
 * Não mexe no nível/dia (dailyFocus.day etc.) — só encerra a sessão em andamento.
 */
export function endDailyFocusSession(): void {
  try { localStorage.removeItem(SESSION_LS_KEY); } catch { /* noop */ }
  clearDailyFocusLive();
  endRemoteActiveSession();
}

/**
 * Segundos restantes AO VIVO: se estiver rodando, desconta o tempo decorrido desde a
 * âncora; se pausado, retorna o valor congelado. Nunca abaixo de 0. Retorna null quando
 * a sessão não tem contagem regressiva (rush/tab).
 *
 * PROTEÇÃO: Se passou mais de MAX_ELAPSED_HOURS desde anchorTs, assume sessão expirada
 * e retorna 0 (forçar conclusão).
 */
export function liveRemaining(snap: DailyFocusLive, now: number = Date.now()): number | null {
  if (snap.remainingSecs == null) return null;
  if (!snap.running) return Math.max(0, snap.remainingSecs);

  const elapsed = (now - snap.anchorTs) / 1000;

  // PROTEÇÃO: Limite máximo de tempo transcorrido (previne estados absurdos)
  if (elapsed > MAX_ELAPSED_HOURS * 3600) {
    console.warn('[liveRemaining] Session expired (>24h elapsed)', {
      elapsed: `${(elapsed / 3600).toFixed(1)}h`,
      anchorTs: new Date(snap.anchorTs).toISOString(),
    });
    return 0; // Forçar conclusão
  }

  return Math.max(0, Math.round(snap.remainingSecs - elapsed));
}

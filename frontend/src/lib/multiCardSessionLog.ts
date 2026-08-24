/**
 * multiCardSessionLog.ts — Registro de sessões multi-card.
 * Captura: quais cards foram usados, início/fim, tempo focado, emoções.
 * Padrão offline-first: localStorage + sync Supabase (fire-and-forget).
 */

import { storageGet, storageSet, storageRemove } from "./storage";
import { SK } from "./storageKeys";

const LS_KEY = "multiCardSessionLog";
const MAX_ENTRIES = 500;
const RETAIN_DAYS = 90;

export interface MultiCardSessionEntry {
  id: string;
  cards: string[];          // IDs dos modos usados (em ordem)
  startedAt: string;        // ISO timestamp
  endedAt: string;          // ISO timestamp
  durationMinutes: number;  // tempo total
  focusedMinutes: number;
  idleMinutes: number;
  idleReason: string[];
  feelings: string[];
  worked: boolean;
  cardRatings?: Record<string, boolean>;
}

/** Dados em andamento persistidos para sobreviver reload */
export interface ActiveMultiCardSession {
  cards: string[];          // IDs dos modos
  startedAt: string;        // ISO timestamp
  currentCardIndex: number;
}

// ── Sessão ativa ────────────────────────────────────────────────────────────

/** Notifica listeners na mesma aba sobre mudança de sessão ativa. */
function dispatchSessionChanged(): void {
  try { window.dispatchEvent(new CustomEvent("multiCardSessionChanged")); } catch {}
}

export function saveActiveSession(session: ActiveMultiCardSession): void {
  storageSet(SK.ACTIVE_MULTI_CARD_SESSION, session);
  dispatchSessionChanged();
}

export function loadActiveSession(): ActiveMultiCardSession | null {
  return storageGet<ActiveMultiCardSession | null>(SK.ACTIVE_MULTI_CARD_SESSION, null);
}

export function clearActiveSession(): void {
  storageRemove(SK.ACTIVE_MULTI_CARD_SESSION);
  dispatchSessionChanged();
}

export function updateActiveSessionIndex(index: number): void {
  const session = loadActiveSession();
  if (!session) return;
  session.currentCardIndex = index;
  storageSet(SK.ACTIVE_MULTI_CARD_SESSION, session);
}

// ── Log de sessões completadas ──────────────────────────────────────────────

function pruneOldEntries(entries: MultiCardSessionEntry[]): MultiCardSessionEntry[] {
  const cutoff = Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000;
  return entries.filter((e) => new Date(e.startedAt).getTime() > cutoff);
}

export function logMultiCardSession(entry: Omit<MultiCardSessionEntry, "id">): boolean {
  try {
    let entries: MultiCardSessionEntry[] = storageGet<MultiCardSessionEntry[]>(LS_KEY) ?? [];
    entries = pruneOldEntries(entries);
    if (entries.length >= MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES + 1);
    const full: MultiCardSessionEntry = { ...entry, id: `mcs_${Date.now()}` };
    entries.push(full);
    storageSet(LS_KEY, entries);

    // Fire-and-forget sync (não bloqueia)
    syncMultiCardSession(full).catch(() => {});

    return true;
  } catch {
    return false;
  }
}

export function getMultiCardSessions(): MultiCardSessionEntry[] {
  try {
    return storageGet<MultiCardSessionEntry[]>(LS_KEY) ?? [];
  } catch {
    return [];
  }
}

async function syncMultiCardSession(entry: MultiCardSessionEntry): Promise<void> {
  try {
    const { syncToBackend } = await import("./syncToBackend");
    syncToBackend("POST", "/multi-card-sessions", entry as unknown as Record<string, unknown>);
  } catch {
    // fire-and-forget — ignore errors
  }
}

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock do client HTTP: controla o que o backend "devolve".
const fetchActiveSession = vi.fn();
const upsertActiveSession = vi.fn();
const deleteActiveSession = vi.fn();
const beaconActiveSession = vi.fn();
vi.mock("../api/dailyFocusActiveSession", () => ({
  fetchActiveSession: (...a: unknown[]) => fetchActiveSession(...a),
  upsertActiveSession: (...a: unknown[]) => upsertActiveSession(...a),
  deleteActiveSession: (...a: unknown[]) => deleteActiveSession(...a),
  beaconActiveSession: (...a: unknown[]) => beaconActiveSession(...a),
}));

import {
  loadRemoteActiveSession,
  loadDailyFocusLive,
  saveDailyFocusLive,
  clearDailyFocusLive,
  endRemoteActiveSession,
  DailyFocusLive,
} from "./dailyFocusLive";

const SESSION_LS_KEY = "taskflow_sess_daily_focus";
const VERSION_LS_KEY = "taskflow.dailyFocus.activeVersion";
const LIVE_LS_KEY = "taskflow.dailyFocus.live";

/** Grava o snapshot local SEM agendar push (evita marcar "pending write"). */
function setLocalLive(live: DailyFocusLive): void {
  localStorage.setItem(LIVE_LS_KEY, JSON.stringify(live));
}

function todayIso(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function makeLive(over: Partial<DailyFocusLive> = {}): DailyFocusLive {
  return {
    taskTitle: "Tarefa remota", phase: "work", running: true, remainingSecs: 600,
    anchorTs: Date.now(), totalSecs: 900, rushMode: false, tabMode: false,
    cycleCount: 0, nextTaskTitle: "", taskIndex: 0, taskCount: 3, ...over,
  };
}

function remotePayload(over: Record<string, unknown> = {}) {
  return {
    date: todayIso(),
    live: makeLive(),
    session: { level: 3, currentIdx: 1 },
    focusTimer: { accumulatedMs: 12345 },
    version: 1,
    endedAt: null,
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

beforeEach(() => {
  // Cancela qualquer push debounced deixado por um teste anterior (estado de módulo).
  endRemoteActiveSession();
  localStorage.clear();
  clearDailyFocusLive();
  fetchActiveSession.mockReset();
  upsertActiveSession.mockReset();
  deleteActiveSession.mockReset();
  beaconActiveSession.mockReset();
  // upsert padrão: sucesso versão N+1
  upsertActiveSession.mockResolvedValue({ status: "ok", version: 2, updatedAt: new Date().toISOString() });
});

describe("loadRemoteActiveSession", () => {
  it("reidrata quando não há sessão local (caso PC → celular)", async () => {
    fetchActiveSession.mockResolvedValue(remotePayload({ live: makeLive({ remainingSecs: 420 }), version: 1 }));

    await loadRemoteActiveSession();

    const live = loadDailyFocusLive();
    expect(live?.phase).toBe("work");
    expect(live?.remainingSecs).toBe(420);
    expect(JSON.parse(localStorage.getItem(SESSION_LS_KEY)!)).toMatchObject({ level: 3, currentIdx: 1 });
    // Guarda a versão sincronizada.
    expect(localStorage.getItem(VERSION_LS_KEY)).toBe("1");
  });

  it("ignora sessão remota de outro dia", async () => {
    fetchActiveSession.mockResolvedValue(remotePayload({ date: "2000-01-01" }));
    await loadRemoteActiveSession();
    expect(loadDailyFocusLive()).toBeNull();
  });

  it("ignora fases sem timer (ex.: prepare)", async () => {
    fetchActiveSession.mockResolvedValue(remotePayload({ live: makeLive({ phase: "prepare" }) }));
    await loadRemoteActiveSession();
    expect(loadDailyFocusLive()).toBeNull();
  });

  it("não sobrescreve quando já conhecemos versão >= remota (LWW por versão)", async () => {
    setLocalLive(makeLive({ taskTitle: "LOCAL" }));
    localStorage.setItem(VERSION_LS_KEY, "5");
    fetchActiveSession.mockResolvedValue(remotePayload({ live: makeLive({ taskTitle: "REMOTO" }), version: 3 }));

    await loadRemoteActiveSession();
    expect(loadDailyFocusLive()?.taskTitle).toBe("LOCAL");
  });

  it("aplica quando a versão remota é mais nova que a conhecida", async () => {
    setLocalLive(makeLive({ taskTitle: "LOCAL" }));
    localStorage.setItem(VERSION_LS_KEY, "2");
    fetchActiveSession.mockResolvedValue(remotePayload({ live: makeLive({ taskTitle: "REMOTO" }), version: 9 }));

    await loadRemoteActiveSession();
    expect(loadDailyFocusLive()?.taskTitle).toBe("REMOTO");
    expect(localStorage.getItem(VERSION_LS_KEY)).toBe("9");
  });

  it("tombstone: encerra a sessão local quando o remoto foi finalizado em outro device", async () => {
    setLocalLive(makeLive({ taskTitle: "LOCAL" }));
    localStorage.setItem(SESSION_LS_KEY, JSON.stringify({ level: 4 }));
    fetchActiveSession.mockResolvedValue(remotePayload({ live: null, endedAt: new Date().toISOString(), version: 7 }));

    await loadRemoteActiveSession();
    expect(loadDailyFocusLive()).toBeNull();
    expect(localStorage.getItem(SESSION_LS_KEY)).toBeNull();
    expect(localStorage.getItem(VERSION_LS_KEY)).toBe("7");
  });

  it("faz no-op quando não há sessão remota", async () => {
    fetchActiveSession.mockResolvedValue(null);
    await loadRemoteActiveSession();
    expect(loadDailyFocusLive()).toBeNull();
  });

  it("não reidrata enquanto há push local pendente (edições não confirmadas ganham)", async () => {
    // saveDailyFocusLive agenda um push debounced → hasPendingLocalWrite() = true.
    saveDailyFocusLive(makeLive({ taskTitle: "LOCAL-EDIT" }));
    fetchActiveSession.mockResolvedValue(remotePayload({ live: makeLive({ taskTitle: "REMOTO" }), version: 99 }));

    await loadRemoteActiveSession();
    // Não deve nem consultar o backend (curto-circuito).
    expect(fetchActiveSession).not.toHaveBeenCalled();
    expect(loadDailyFocusLive()?.taskTitle).toBe("LOCAL-EDIT");
  });
});

describe("endRemoteActiveSession", () => {
  it("deleta remotamente e zera a versão local", async () => {
    localStorage.setItem(VERSION_LS_KEY, "3");
    endRemoteActiveSession();
    expect(deleteActiveSession).toHaveBeenCalled();
    expect(localStorage.getItem(VERSION_LS_KEY)).toBeNull();
  });
});

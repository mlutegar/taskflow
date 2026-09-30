import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock da camada de API: controlamos o resultado de saveSession/fetchSessions.
const saveSession = vi.fn();
const fetchSessions = vi.fn();
vi.mock("../api/dailyFocusSessions", () => ({
  saveSession: (...args: unknown[]) => saveSession(...args),
  fetchSessions: (...args: unknown[]) => fetchSessions(...args),
}));

import {
  addSession,
  getHistory,
  flushUnsyncedSessions,
  retrySessionsNow,
  getPendingCount,
  loadRemoteSessions,
  type HistoryEntry,
} from "./dailyFocusHistory";

const LS_KEY = "daily_focus_history";

function baseEntry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    date: "30/08/2026",
    level: 1,
    tasks: ["tcc"],
    timings: [],
    completedAt: "13:16",
    rushMode: false,
    ...over,
  };
}

const ok = { ok: true, permanent: false };
const transient = { ok: false, permanent: false };
const permanent = { ok: false, permanent: true };

/** Espera as promises fire-and-forget disparadas por addSession resolverem. */
const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  localStorage.removeItem(LS_KEY);
  saveSession.mockReset();
  fetchSessions.mockReset();
});

describe("addSession + outbox", () => {
  it("gera clientId, marca synced:false e sincroniza no sucesso", async () => {
    saveSession.mockResolvedValue(ok);
    addSession(baseEntry());
    const afterAdd = getHistory()[0];
    expect(afterAdd.clientId).toBeTruthy();
    expect(afterAdd.synced).toBe(false);

    await flushMicrotasks();
    expect(getHistory()[0].synced).toBe(true);
    expect(getPendingCount()).toBe(0);
  });

  it("mantém pendente quando o backend falha (transitório) e agenda retry", async () => {
    saveSession.mockResolvedValue(transient);
    addSession(baseEntry());
    await flushMicrotasks();

    const e = getHistory()[0];
    expect(e.synced).not.toBe(true);
    expect(e.retryCount).toBe(1);
    expect(e.nextRetryAt).toBeTypeOf("number");
    expect(getPendingCount()).toBe(1);
  });

  it("marca failedPermanent em erro 4xx e não conta como pendente", async () => {
    saveSession.mockResolvedValue(permanent);
    addSession(baseEntry());
    await flushMicrotasks();

    expect(getHistory()[0].failedPermanent).toBe(true);
    expect(getPendingCount()).toBe(0);
  });
});

describe("flushUnsyncedSessions", () => {
  it("reenvia pendentes e marca como synced", async () => {
    saveSession.mockResolvedValue(transient);
    addSession(baseEntry());
    await flushMicrotasks();
    expect(getPendingCount()).toBe(1);

    // Zera o backoff para permitir reenvio imediato e faz o backend aceitar.
    const h = getHistory().map((e) => ({ ...e, nextRetryAt: undefined }));
    localStorage.setItem(LS_KEY, JSON.stringify(h));
    saveSession.mockResolvedValue(ok);

    await flushUnsyncedSessions();
    expect(getHistory()[0].synced).toBe(true);
    expect(getPendingCount()).toBe(0);
  });

  it("respeita o backoff (não reenvia antes de nextRetryAt)", async () => {
    saveSession.mockResolvedValue(transient);
    addSession(baseEntry());
    await flushMicrotasks();
    saveSession.mockClear();

    await flushUnsyncedSessions(); // backoff ainda em vigor
    expect(saveSession).not.toHaveBeenCalled();
  });

  it("retrySessionsNow força reenvio ignorando backoff e falha permanente", async () => {
    saveSession.mockResolvedValue(permanent);
    addSession(baseEntry());
    await flushMicrotasks();
    expect(getHistory()[0].failedPermanent).toBe(true);

    saveSession.mockResolvedValue(ok);
    await retrySessionsNow();
    expect(getHistory()[0].synced).toBe(true);
  });

  it("não reprocessa concorrentemente (guard)", async () => {
    saveSession.mockImplementation(() => new Promise((r) => setTimeout(() => r(ok), 20)));
    addSession(baseEntry());
    await flushMicrotasks();
    saveSession.mockClear();
    saveSession.mockImplementation(() => new Promise((r) => setTimeout(() => r(ok), 20)));

    // força pendência
    const h = getHistory().map((e) => ({ ...e, synced: false, nextRetryAt: undefined }));
    localStorage.setItem(LS_KEY, JSON.stringify(h));

    await Promise.all([flushUnsyncedSessions(), flushUnsyncedSessions()]);
    expect(saveSession).toHaveBeenCalledTimes(1);
  });
});

describe("loadRemoteSessions", () => {
  it("reconcilia entrada local pendente que já existe no backend (mesmo clientId)", async () => {
    saveSession.mockResolvedValue(transient);
    addSession(baseEntry());
    await flushMicrotasks();
    const cid = getHistory()[0].clientId!;
    expect(getPendingCount()).toBe(1);

    // Backend devolve a MESMA sessão (o POST tinha, na verdade, chegado).
    fetchSessions.mockResolvedValue([{ ...baseEntry(), clientId: cid }]);
    await loadRemoteSessions();

    expect(getHistory()[0].synced).toBe(true);
    expect(getPendingCount()).toBe(0);
  });

  it("não duplica: entrada remota com clientId já local não é adicionada de novo", async () => {
    saveSession.mockResolvedValue(ok);
    addSession(baseEntry());
    await flushMicrotasks();
    const cid = getHistory()[0].clientId!;

    fetchSessions.mockResolvedValue([{ ...baseEntry(), clientId: cid }]);
    await loadRemoteSessions();

    expect(getHistory()).toHaveLength(1);
  });
});

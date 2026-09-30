import { describe, expect, it, beforeEach } from "vitest";
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
  updateActiveSessionIndex,
  updateActiveSessionMinimized,
} from "./multiCardSessionLog";
import { SK } from "./storageKeys";

const KEY = "taskflow." + SK.ACTIVE_MULTI_CARD_SESSION;

describe("multiCardSessionLog — sessão ativa", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("salva e lê a sessão ativa (roundtrip com novos campos)", () => {
    saveActiveSession({
      cards: ["music", "tiktok"],
      startedAt: "2026-01-01T10:00:00.000Z",
      currentCardIndex: 0,
      sessionMode: "sequential",
      intention: "focar",
      minimized: false,
    });
    const loaded = loadActiveSession();
    expect(loaded).toMatchObject({
      cards: ["music", "tiktok"],
      currentCardIndex: 0,
      sessionMode: "sequential",
      intention: "focar",
      minimized: false,
    });
  });

  it("updateActiveSessionIndex atualiza só o índice, preservando o resto", () => {
    saveActiveSession({
      cards: ["music", "tiktok"],
      startedAt: "2026-01-01T10:00:00.000Z",
      currentCardIndex: 0,
      minimized: true,
    });
    updateActiveSessionIndex(1);
    expect(loadActiveSession()).toMatchObject({ currentCardIndex: 1, minimized: true });
  });

  it("updateActiveSessionMinimized alterna o flag sem perder o índice", () => {
    saveActiveSession({
      cards: ["music"],
      startedAt: "2026-01-01T10:00:00.000Z",
      currentCardIndex: 2,
    });
    updateActiveSessionMinimized(true);
    expect(loadActiveSession()).toMatchObject({ currentCardIndex: 2, minimized: true });
    updateActiveSessionMinimized(false);
    expect(loadActiveSession()).toMatchObject({ currentCardIndex: 2, minimized: false });
  });

  it("update* não cria sessão quando não há nenhuma ativa", () => {
    updateActiveSessionMinimized(true);
    updateActiveSessionIndex(3);
    expect(loadActiveSession()).toBeNull();
  });

  it("clearActiveSession remove a sessão", () => {
    saveActiveSession({ cards: ["music"], startedAt: "x", currentCardIndex: 0 });
    expect(localStorage.getItem(KEY)).not.toBeNull();
    clearActiveSession();
    expect(loadActiveSession()).toBeNull();
  });
});

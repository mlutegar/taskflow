import { describe, it, expect, beforeEach } from "vitest";
import {
  setContinuousActivity,
  getContinuousActivity,
  completeContinuousActivity,
  uncompleteLast,
  getCompletedToday,
  getCompletedCountToday,
} from "./continuousActivity";

const KEYS = [
  "taskflow.dailyFocus.continuousActivity",
  "taskflow.dailyFocus.continuousActivity.last",
  "taskflow.dailyFocus.continuousActivity.history",
  "taskflow.dailyFocus.continuousActivity.done",
];

beforeEach(() => {
  KEYS.forEach((k) => localStorage.removeItem(k));
});

describe("completeContinuousActivity", () => {
  it("no-op quando não há atividade", () => {
    expect(completeContinuousActivity()).toBeNull();
    expect(getCompletedToday()).toHaveLength(0);
  });

  it("registra a conclusão, limpa a atual e mantém o log do dia", () => {
    setContinuousActivity({ title: "Responder o Matheus", icon: "💬" });
    const done = completeContinuousActivity();
    expect(done?.title).toBe("Responder o Matheus");
    expect(done?.completedAt).toBeTruthy();
    // atividade atual foi limpa
    expect(getContinuousActivity()).toBeNull();
    // ficou no log de concluídas
    const today = getCompletedToday();
    expect(today).toHaveLength(1);
    expect(today[0].title).toBe("Responder o Matheus");
    expect(getCompletedCountToday()).toBe(1);
  });

  it("acumula múltiplas conclusões no mesmo dia", () => {
    setContinuousActivity({ title: "Anki", icon: "🃏" });
    completeContinuousActivity();
    setContinuousActivity({ title: "Ler artigo", icon: "📖" });
    completeContinuousActivity();
    expect(getCompletedCountToday()).toBe(2);
    expect(getCompletedToday().map((c) => c.title)).toEqual(["Anki", "Ler artigo"]);
  });
});

describe("uncompleteLast", () => {
  it("desfaz a última conclusão restaurando a atividade atual", () => {
    setContinuousActivity({ title: "Anki", icon: "🃏", goalTarget: 20, goalUnit: "cards" });
    completeContinuousActivity();
    expect(getContinuousActivity()).toBeNull();

    const restored = uncompleteLast();
    expect(restored?.title).toBe("Anki");
    expect(getCompletedToday()).toHaveLength(0);
    const current = getContinuousActivity();
    expect(current?.title).toBe("Anki");
    expect(current?.goalTarget).toBe(20);
  });

  it("no-op quando não há conclusões", () => {
    expect(uncompleteLast()).toBeNull();
  });
});

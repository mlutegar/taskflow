import { describe, it, expect, beforeEach } from "vitest";
import { storageSet, storageRemove } from "./storage";
import { SK } from "./storageKeys";
import { usageStats, invalidateUsageCache } from "./sessionUsageLog";

// Helper: ISO YYYY-MM-DD de N dias atrás (local).
function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function seed(entries: Array<Partial<{ modeId: string; date: string; hour: number; tasksCompleted: number }>>): void {
  storageSet(SK.SESSION_USAGE_LOG, entries);
  invalidateUsageCache();
}

describe("usageStats (ranking derivado do sessionUsageLog)", () => {
  beforeEach(() => {
    storageRemove(SK.SESSION_USAGE_LOG);
    invalidateUsageCache();
  });

  it("soma tasksCompleted por modo", () => {
    const today = daysAgoIso(0);
    seed([
      { modeId: "momentum", date: today, hour: 9, tasksCompleted: 3 },
      { modeId: "momentum", date: today, hour: 14, tasksCompleted: 2 },
      { modeId: "rpg", date: today, hour: 10, tasksCompleted: 4 },
    ]);
    const stats = usageStats(7);
    expect(stats.find((s) => s.modeId === "momentum")?.count).toBe(5);
    expect(stats.find((s) => s.modeId === "rpg")?.count).toBe(4);
  });

  it("usa fallback de 1 por sessão quando tasksCompleted está ausente/zero", () => {
    const today = daysAgoIso(0);
    seed([
      { modeId: "gamer_fixed", date: today, hour: 9 },                       // sem tasksCompleted → 1
      { modeId: "gamer_fixed", date: today, hour: 10, tasksCompleted: 0 },   // zero → 1
      { modeId: "gamer_fixed", date: today, hour: 11, tasksCompleted: 5 },   // 5
    ]);
    expect(usageStats(7).find((s) => s.modeId === "gamer_fixed")?.count).toBe(7);
  });

  it("respeita a janela de dias", () => {
    seed([
      { modeId: "reddit_detox", date: daysAgoIso(0), hour: 9, tasksCompleted: 2 },
      { modeId: "reddit_detox", date: daysAgoIso(10), hour: 9, tasksCompleted: 5 },
    ]);
    expect(usageStats(7).find((s) => s.modeId === "reddit_detox")?.count).toBe(2);   // só hoje
    expect(usageStats(30).find((s) => s.modeId === "reddit_detox")?.count).toBe(7);  // ambos
  });

  it("retorna ordenado do mais usado para o menos usado", () => {
    const today = daysAgoIso(0);
    seed([
      { modeId: "a", date: today, hour: 1, tasksCompleted: 1 },
      { modeId: "b", date: today, hour: 2, tasksCompleted: 9 },
      { modeId: "c", date: today, hour: 3, tasksCompleted: 5 },
    ]);
    expect(usageStats(7).map((s) => s.modeId)).toEqual(["b", "c", "a"]);
  });

  it("retorna vazio sem registros", () => {
    invalidateUsageCache();
    expect(usageStats(7)).toEqual([]);
  });
});

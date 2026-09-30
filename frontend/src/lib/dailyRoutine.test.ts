import { describe, it, expect } from "vitest";
import { isDailyToday, computeStreak, completedDateSet, last7Days } from "./dailyRoutine";

// Datas de referência fixas (horário local, meio-dia p/ evitar borda de fuso).
const MON = new Date(2026, 8, 28, 12); // 2026-09-28 é uma segunda-feira
const SAT = new Date(2026, 9, 3, 12);  // 2026-10-03 é um sábado

describe("isDailyToday", () => {
  it("'daily' vale todo dia (dia útil e fim de semana)", () => {
    expect(isDailyToday("daily", MON)).toBe(true);
    expect(isDailyToday("daily", SAT)).toBe(true);
  });

  it("'weekdays' vale só de segunda a sexta", () => {
    expect(isDailyToday("weekdays", MON)).toBe(true);
    expect(isDailyToday("weekdays", SAT)).toBe(false);
  });

  it("recorrência ausente ou desconhecida não conta como diária", () => {
    expect(isDailyToday(null, MON)).toBe(false);
    expect(isDailyToday(undefined, MON)).toBe(false);
    expect(isDailyToday("weekly", MON)).toBe(false);
    expect(isDailyToday("", MON)).toBe(false);
  });
});

describe("completedDateSet", () => {
  it("ignora entradas desfeitas e sem data", () => {
    const set = completedDateSet([
      { date: "2026-09-28" },
      { date: "2026-09-27", undone: true },
      { date: "" },
    ]);
    expect(set.has("2026-09-28")).toBe(true);
    expect(set.has("2026-09-27")).toBe(false);
    expect(set.size).toBe(1);
  });
});

describe("computeStreak", () => {
  it("conta dias consecutivos terminando hoje", () => {
    const set = new Set(["2026-09-26", "2026-09-27", "2026-09-28"]);
    expect(computeStreak(set, MON)).toBe(3);
  });

  it("não quebra o streak se hoje ainda não foi feito (conta a partir de ontem)", () => {
    const set = new Set(["2026-09-26", "2026-09-27"]); // sem hoje (28)
    expect(computeStreak(set, MON)).toBe(2);
  });

  it("retorna 0 quando não há histórico recente", () => {
    expect(computeStreak(new Set(), MON)).toBe(0);
    expect(computeStreak(new Set(["2026-01-01"]), MON)).toBe(0);
  });
});

describe("last7Days", () => {
  it("retorna 7 dias terminando na data de referência", () => {
    const days = last7Days(MON);
    expect(days).toHaveLength(7);
    expect(days[6].iso).toBe("2026-09-28"); // último = hoje
    expect(days[0].iso).toBe("2026-09-22"); // 6 dias antes
  });
});

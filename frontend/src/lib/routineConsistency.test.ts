import { describe, it, expect } from "vitest";

import {
  bestStreak,
  buildHeatmapGrid,
  cellRoutines,
  cellTooltip,
  completionRate,
  currentStreak,
  levelOf,
  monthLabels,
  projectDays,
  rangeBounds,
  weekdayRowLabels,
  type DayCount,
} from "./routineConsistency";
import type { RoutineConsistencyDay, RoutineConsistencyRoutine } from "../api/tasks";

/** Helper: gera dias consecutivos terminando em `to`. */
function days(to: string, specs: Array<[expected: number, completed: number]>): DayCount[] {
  const out: DayCount[] = [];
  const [y, m, d] = to.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  specs.forEach(([expected, completed], i) => {
    const date = new Date(end);
    date.setDate(date.getDate() - (specs.length - 1 - i));
    out.push({
      date: [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-"),
      expected,
      completed,
    });
  });
  return out;
}

const TODAY = "2026-10-18";

describe("levelOf", () => {
  it("retorna null quando não há rotina agendada", () => {
    expect(levelOf(0, 0)).toBeNull();
  });

  it("mapeia as cinco faixas de porcentagem", () => {
    expect(levelOf(3, 0)).toBe(0);     // 0%
    expect(levelOf(3, 1)).toBe(1);     // 33,3% arredonda p/ 33 → faixa 1–33
    expect(levelOf(100, 33)).toBe(1);  // 33% → faixa 1–33
    expect(levelOf(100, 34)).toBe(2);  // 34% → faixa 34–66
    expect(levelOf(3, 2)).toBe(3);     // 66,7% arredonda p/ 67 → faixa 67–99
    expect(levelOf(100, 66)).toBe(2);
    expect(levelOf(100, 67)).toBe(3);
    expect(levelOf(100, 99)).toBe(3);
    expect(levelOf(3, 3)).toBe(4);     // 100%
  });

  it("nunca passa de 4 mesmo com mais conclusões que o esperado", () => {
    expect(levelOf(2, 5)).toBe(4);
  });
});

describe("currentStreak", () => {
  it("conta dias concluídos consecutivos terminando hoje", () => {
    const data = days(TODAY, [[2, 2], [2, 2], [2, 2]]);
    expect(currentStreak(data, TODAY)).toBe(3);
  });

  it("não quebra quando HOJE ainda está incompleto — conta até ontem", () => {
    const data = days(TODAY, [[3, 3], [3, 3], [3, 1]]); // hoje 1 de 3
    expect(currentStreak(data, TODAY)).toBe(2);
  });

  it("não quebra quando hoje está totalmente zerado", () => {
    const data = days(TODAY, [[3, 3], [3, 3], [3, 0]]);
    expect(currentStreak(data, TODAY)).toBe(2);
  });

  it("conta hoje quando hoje já está 100%", () => {
    const data = days(TODAY, [[1, 1], [1, 1], [1, 1]]);
    expect(currentStreak(data, TODAY)).toBe(3);
  });

  it("pula dias sem rotina agendada sem contá-los nem quebrar a sequência", () => {
    // anteontem 100%, ontem sem rotina, hoje 100%
    const data = days(TODAY, [[2, 2], [0, 0], [2, 2]]);
    expect(currentStreak(data, TODAY)).toBe(2);
  });

  it("quebra num dia incompleto no passado", () => {
    const data = days(TODAY, [[2, 2], [2, 1], [2, 2], [2, 2]]);
    expect(currentStreak(data, TODAY)).toBe(2);
  });

  it("retorna 0 sem histórico", () => {
    expect(currentStreak([], TODAY)).toBe(0);
  });

  it("retorna 0 quando ontem e hoje estão incompletos", () => {
    const data = days(TODAY, [[2, 2], [2, 0], [2, 0]]);
    expect(currentStreak(data, TODAY)).toBe(0);
  });
});

describe("bestStreak", () => {
  it("pega a maior sequência, não a atual", () => {
    const data = days(TODAY, [[1, 1], [1, 1], [1, 1], [1, 1], [1, 0], [1, 1], [1, 1]]);
    expect(bestStreak(data)).toBe(4);
  });

  it("ignora dias sem rotina ao emendar a sequência", () => {
    const data = days(TODAY, [[1, 1], [0, 0], [1, 1], [1, 1]]);
    expect(bestStreak(data)).toBe(3);
  });

  it("retorna 0 quando nada foi concluído", () => {
    expect(bestStreak(days(TODAY, [[2, 1], [2, 0]]))).toBe(0);
  });
});

describe("completionRate", () => {
  it("considera concluído só o dia 100%", () => {
    const data = days(TODAY, [[2, 2], [2, 1], [3, 3], [1, 0]]);
    expect(completionRate(data)).toEqual({ pct: 50, done: 2, total: 4 });
  });

  it("ignora dias sem rotina agendada no total", () => {
    const data = days(TODAY, [[2, 2], [0, 0], [0, 0], [2, 0]]);
    expect(completionRate(data)).toEqual({ pct: 50, done: 1, total: 2 });
  });

  it("retorna 0% quando não há nenhum dia elegível", () => {
    expect(completionRate(days(TODAY, [[0, 0], [0, 0]]))).toEqual({ pct: 0, done: 0, total: 0 });
  });

  it("retorna 0% para histórico vazio", () => {
    expect(completionRate([])).toEqual({ pct: 0, done: 0, total: 0 });
  });
});

describe("buildHeatmapGrid", () => {
  it("alinha a primeira semana com células vazias antes do início", () => {
    // 2026-10-14 é uma quarta-feira (índice 3)
    const data = days("2026-10-16", [[1, 1], [1, 0], [1, 1]]);
    const weeks = buildHeatmapGrid(data, "2026-10-16");
    expect(weeks[0].slice(0, 3).every((c) => c.date === null)).toBe(true);
    expect(weeks[0][3].date).toBe("2026-10-14");
  });

  it("não gera células futuras além de hoje", () => {
    const data = days("2026-10-20", [[1, 1], [1, 1], [1, 1]]); // 18,19,20
    const weeks = buildHeatmapGrid(data, "2026-10-18");
    const dates = weeks.flat().map((c) => c.date).filter(Boolean);
    expect(dates[dates.length - 1]).toBe("2026-10-18");
    expect(dates).not.toContain("2026-10-19");
  });

  it("marca a célula de hoje", () => {
    const weeks = buildHeatmapGrid(days(TODAY, [[1, 1]]), TODAY);
    expect(weeks.flat().find((c) => c.date === TODAY)?.isToday).toBe(true);
  });

  it("completa a última semana com células vazias", () => {
    const weeks = buildHeatmapGrid(days(TODAY, [[1, 1]]), TODAY);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("retorna grade vazia sem dados", () => {
    expect(buildHeatmapGrid([], TODAY)).toEqual([]);
  });
});

/**
 * Regressão: o heatmap colapsava para UMA célula quando a rotina mais antiga
 * era recente, porque a grade era ancorada no primeiro dia COM dado. Ancorar
 * em `from` faz o período inteiro sempre ser desenhado.
 */
describe("buildHeatmapGrid ancorado em `from`", () => {
  it("desenha o período inteiro mesmo com dado de um único dia", () => {
    const sparse = days(TODAY, [[1, 1]]); // só hoje
    const weeks = buildHeatmapGrid(sparse, TODAY, "2026-04-22"); // 180 dias inclusivos
    const realCells = weeks.flat().filter((c) => c.date);
    expect(realCells.length).toBe(180);
    expect(realCells[0].date).toBe("2026-04-22");
    expect(realCells[realCells.length - 1].date).toBe(TODAY);
  });

  it("dias sem dado viram células neutras, não buracos", () => {
    const weeks = buildHeatmapGrid(days(TODAY, [[1, 1]]), TODAY, "2026-10-12");
    const ontem = weeks.flat().find((c) => c.date === "2026-10-17");
    expect(ontem).toBeDefined();
    expect(ontem?.level).toBeNull();
    expect(ontem?.expected).toBe(0);
  });

  it("sem nenhum dado, `from` sozinho já monta a grade", () => {
    const weeks = buildHeatmapGrid([], TODAY, "2026-10-12");
    const realCells = weeks.flat().filter((c) => c.date);
    expect(realCells.length).toBe(7);
    expect(realCells.every((c) => c.level === null)).toBe(true);
  });

  it("ignora `from` posterior ao primeiro dia com dado", () => {
    const data = days(TODAY, [[1, 1], [1, 1], [1, 1]]); // 16, 17, 18
    const weeks = buildHeatmapGrid(data, TODAY, "2026-10-17");
    const realCells = weeks.flat().filter((c) => c.date);
    expect(realCells[0].date).toBe("2026-10-16");
  });
});

describe("weekdayRowLabels", () => {
  it("usa nomes de três letras por padrão", () => {
    expect(weekdayRowLabels()).toEqual(["", "Seg", "", "Qua", "", "Sex", ""]);
  });

  it("usa uma letra no modo curto (mobile)", () => {
    expect(weekdayRowLabels(true)).toEqual(["", "S", "", "Q", "", "S", ""]);
  });
});

describe("monthLabels", () => {
  it("rotula apenas a primeira semana de cada mês", () => {
    const data = days("2026-11-10", Array.from({ length: 40 }, () => [1, 1] as [number, number]));
    const labels = monthLabels(buildHeatmapGrid(data, "2026-11-10"));
    const filled = labels.filter(Boolean);
    expect(filled).toContain("Nov");
    expect(new Set(filled).size).toBe(filled.length); // sem repetição
  });
});

describe("rangeBounds", () => {
  it("usa janelas inclusivas terminando hoje", () => {
    expect(rangeBounds("30d", TODAY)).toEqual({ from: "2026-09-19", to: TODAY });
    expect(rangeBounds("1y", TODAY).to).toBe(TODAY);
  });
});

const cell = (over: Partial<Parameters<typeof cellTooltip>[0]> = {}) => ({
  date: TODAY, expected: 0, completed: 0, level: null, isToday: false,
  expectedIdx: [], completedIdx: [], ...over,
}) as Parameters<typeof cellTooltip>[0];

describe("cellTooltip", () => {
  it("formata data e contagem de rotinas", () => {
    expect(cellTooltip(cell({ expected: 3, completed: 2, level: 2, isToday: true })))
      .toBe("18 out 2026 · 2 de 3 rotinas");
  });

  it("usa singular com uma rotina", () => {
    expect(cellTooltip(cell({ expected: 1, completed: 1, level: 4, isToday: true })))
      .toBe("18 out 2026 · 1 de 1 rotina");
  });

  it("avisa quando não há rotina agendada", () => {
    expect(cellTooltip(cell())).toBe("18 out 2026 · sem rotina agendada");
  });
});

const ROUTINES: RoutineConsistencyRoutine[] = [
  { id: "a", title: "Ler", recurrence: "daily" },
  { id: "b", title: "Correr", recurrence: "weekdays" },
  { id: "c", title: "Meditar", recurrence: "daily" },
];

describe("cellRoutines", () => {
  it("lista as rotinas do dia marcando quais foram feitas", () => {
    const result = cellRoutines(
      cell({ expected: 3, completed: 1, expectedIdx: [0, 1, 2], completedIdx: [1] }),
      ROUTINES,
    );
    expect(result).toEqual([
      { id: "b", title: "Correr", done: true },
      { id: "a", title: "Ler", done: false },
      { id: "c", title: "Meditar", done: false },
    ]);
  });

  it("mostra as concluídas primeiro", () => {
    const result = cellRoutines(
      cell({ expected: 3, completed: 2, expectedIdx: [0, 1, 2], completedIdx: [0, 2] }),
      ROUTINES,
    );
    expect(result.map((r) => r.done)).toEqual([true, true, false]);
  });

  it("lista só as rotinas agendadas naquele dia", () => {
    // Sábado: "Correr" (weekdays) não entra
    const result = cellRoutines(
      cell({ expected: 2, completed: 0, expectedIdx: [0, 2], completedIdx: [] }),
      ROUTINES,
    );
    expect(result.map((r) => r.title)).toEqual(["Ler", "Meditar"]);
  });

  it("retorna vazio em dia sem rotina agendada", () => {
    expect(cellRoutines(cell(), ROUTINES)).toEqual([]);
  });
});

describe("projectDays (filtro por rotina)", () => {
  const api: RoutineConsistencyDay[] = [
    { date: "2026-10-16", expected: [0, 1, 2], completed: [0, 1] },
    { date: "2026-10-17", expected: [0, 2], completed: [2] },     // sábado: sem "Correr"
    { date: "2026-10-18", expected: [0, 2], completed: [0, 2] },
  ];

  it("sem filtro, soma todas as rotinas do dia", () => {
    expect(projectDays(api).map((d) => [d.expected, d.completed])).toEqual([
      [3, 2], [2, 1], [2, 2],
    ]);
  });

  it("com filtro, considera só a rotina escolhida", () => {
    // índice 0 = "Ler": agendada nos 3 dias, feita no 1º e no 3º
    expect(projectDays(api, 0).map((d) => [d.expected, d.completed])).toEqual([
      [1, 1], [1, 0], [1, 1],
    ]);
  });

  it("dia em que a rotina filtrada não estava agendada vira neutro", () => {
    // índice 1 = "Correr" (weekdays): sábado e domingo ficam expected 0
    expect(projectDays(api, 1).map((d) => [d.expected, d.completed])).toEqual([
      [1, 1], [0, 0], [0, 0],
    ]);
  });

  it("filtro muda a sequência atual, pulando os dias neutros", () => {
    // "Meditar" (idx 2): não feita no 1º dia, feita no 2º e no 3º
    expect(currentStreak(projectDays(api, 2), "2026-10-18")).toBe(2);
    // "Correr" (idx 1): feita no único dia em que estava agendada; os dias
    // seguintes são neutros e não quebram a sequência
    expect(currentStreak(projectDays(api, 1), "2026-10-18")).toBe(1);
  });

  it("filtro muda o % de dias concluídos (dias neutros saem do total)", () => {
    expect(completionRate(projectDays(api, 1))).toEqual({ pct: 100, done: 1, total: 1 });
    expect(completionRate(projectDays(api, 0))).toEqual({ pct: 67, done: 2, total: 3 });
  });
});

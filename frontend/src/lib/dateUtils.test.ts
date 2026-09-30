import { describe, it, expect } from "vitest";
import { daysUntilISO, dueDateLabel, todayISO, daysAgoISO } from "./dateUtils";

describe("daysUntilISO", () => {
  it("retorna 0 para hoje", () => {
    expect(daysUntilISO(todayISO())).toBe(0);
  });
  it("retorna 1 para amanhã e -1 para ontem", () => {
    expect(daysUntilISO(daysAgoISO(-1))).toBe(1);
    expect(daysUntilISO(daysAgoISO(1))).toBe(-1);
  });
  it("retorna NaN para entrada vazia ou inválida", () => {
    expect(Number.isNaN(daysUntilISO(""))).toBe(true);
    expect(Number.isNaN(daysUntilISO("abc"))).toBe(true);
  });
});

describe("dueDateLabel", () => {
  it("hoje / amanhã", () => {
    expect(dueDateLabel(todayISO())).toEqual({ text: "vence hoje", tone: "today" });
    expect(dueDateLabel(daysAgoISO(-1))).toEqual({ text: "vence amanhã", tone: "soon" });
  });
  it("futuro próximo vs distante", () => {
    expect(dueDateLabel(daysAgoISO(-5))).toEqual({ text: "vence em 5 dias", tone: "soon" });
    expect(dueDateLabel(daysAgoISO(-10))).toEqual({ text: "vence em 10 dias", tone: "normal" });
  });
  it("atrasada (singular e plural)", () => {
    expect(dueDateLabel(daysAgoISO(1))).toEqual({ text: "atrasada 1 dia", tone: "overdue" });
    expect(dueDateLabel(daysAgoISO(2))).toEqual({ text: "atrasada 2 dias", tone: "overdue" });
  });
  it("retorna null para entrada inválida", () => {
    expect(dueDateLabel("")).toBeNull();
  });
});

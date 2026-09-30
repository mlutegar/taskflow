import { describe, it, expect } from "vitest";
import { parseQuickTask } from "./quickTaskParse";
import { todayISO, daysAgoISO } from "./dateUtils";

describe("parseQuickTask", () => {
  it("título simples volta intacto", () => {
    const r = parseQuickTask("Comprar pão");
    expect(r.title).toBe("Comprar pão");
    expect(r.due_date).toBeUndefined();
    expect(r.priority).toBeUndefined();
  });

  it("extrai data, hora e prioridade", () => {
    const r = parseQuickTask("Pagar boleto amanhã 14h !alta");
    expect(r.title).toBe("Pagar boleto");
    expect(r.due_date).toBe(daysAgoISO(-1));
    expect(r.due_time).toBe("14:00");
    expect(r.priority).toBe(2);
  });

  it("hoje + prioridade numérica", () => {
    const r = parseQuickTask("Comprar pão hoje !1");
    expect(r.title).toBe("Comprar pão");
    expect(r.due_date).toBe(todayISO());
    expect(r.priority).toBe(1);
  });

  it("hora com minutos (14h30) e (9:30)", () => {
    expect(parseQuickTask("X 14h30").due_time).toBe("14:30");
    expect(parseQuickTask("X 9:30").due_time).toBe("09:30");
  });

  it("depois de amanhã", () => {
    expect(parseQuickTask("Reunião depois de amanhã").due_date).toBe(daysAgoISO(-2));
  });

  it("data explícita dd/mm", () => {
    const r = parseQuickTask("Consulta 25/12");
    expect(r.due_date?.endsWith("-12-25")).toBe(true);
    expect(r.title).toBe("Consulta");
  });

  it("não esvazia o título quando só há tokens", () => {
    const r = parseQuickTask("amanhã");
    expect(r.title).toBe("amanhã");
    expect(r.due_date).toBe(daysAgoISO(-1));
  });

  it("prioridade por palavra crítica", () => {
    expect(parseQuickTask("Deploy !crítica").priority).toBe(1);
  });
});

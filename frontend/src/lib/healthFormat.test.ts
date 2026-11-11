import { describe, it, expect } from "vitest";
import { dayTitle, formatQty, nowHHMM, shiftISO } from "./healthFormat";

describe("healthFormat", () => {
  it("shiftISO anda dias no calendário (virada de mês/ano)", () => {
    expect(shiftISO("2026-11-11", -1)).toBe("2026-11-10");
    expect(shiftISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("nowHHMM formata com zero à esquerda", () => {
    expect(nowHHMM(new Date(2026, 10, 11, 7, 5))).toBe("07:05");
  });

  it("dayTitle: Hoje / Ontem / data", () => {
    expect(dayTitle("2026-11-11", "2026-11-11")).toBe("Hoje");
    expect(dayTitle("2026-11-10", "2026-11-11")).toBe("Ontem");
    expect(dayTitle("2026-11-05", "2026-11-11")).not.toBe("Hoje");
  });

  it("formatQty remove zeros sobrando", () => {
    expect(formatQty(2)).toBe("2");
    expect(formatQty(0.5)).toBe("0.5");
    expect(formatQty(2.25)).toBe("2.25");
  });
});

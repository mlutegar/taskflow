import { describe, it, expect } from "vitest";
import { formatBRL, parseBRL, centsFromDigits, splitCents } from "./money";

describe("money", () => {
  it("formata centavos em BRL", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(5)).toBe("R$ 0,05");
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(-1050)).toBe("-R$ 10,50");
  });
  it("interpreta texto digitado sem float", () => {
    expect(parseBRL("12,50")).toBe(1250);
    expect(parseBRL("1.234,5")).toBe(123450);
    expect(parseBRL("12")).toBe(1200);
    expect(parseBRL("R$ 0,07")).toBe(7);
    expect(parseBRL("19.99")).toBe(1999);
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("")).toBeNull();
  });
  it("máscara de dígitos", () => {
    expect(centsFromDigits("1250")).toBe(1250);
    expect(centsFromDigits("")).toBe(0);
    expect(centsFromDigits("12a5")).toBe(125);
  });
  it("parcelas fecham o total", () => {
    expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333]);
  });
});

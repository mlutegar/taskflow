import { describe, it, expect } from "vitest";
import { formatDuration, weekLabel, weekStartISO, weekdayOf } from "./weekUtils";

describe("weekUtils", () => {
  it("weekdayOf: 0=domingo", () => {
    expect(weekdayOf("2026-11-11")).toBe(3); // quarta
    expect(weekdayOf("2026-11-15")).toBe(0); // domingo
  });

  it("weekStartISO: a semana começa na segunda", () => {
    expect(weekStartISO("2026-11-11")).toBe("2026-11-09");
    expect(weekStartISO("2026-11-09")).toBe("2026-11-09"); // segunda
    expect(weekStartISO("2026-11-15")).toBe("2026-11-09"); // domingo fecha a semana
    expect(weekStartISO("2027-01-01")).toBe("2026-12-28"); // virada de ano
  });

  it("weekLabel mostra segunda a domingo", () => {
    const l = weekLabel("2026-11-09");
    expect(l).toContain("09");
    expect(l).toContain("15");
  });

  it("formatDuration", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(125)).toBe("2h05");
  });
});

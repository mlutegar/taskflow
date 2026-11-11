import { describe, it, expect } from "vitest";
import { computeReminders } from "./medicationReminders";
import type { TodayDose } from "../api/saude";

const dose = (over: Partial<TodayDose>): TodayDose => ({
  medicationId: "m1",
  name: "Losartana",
  dose: "50mg",
  scheduleId: "s1",
  time: "20:00",
  doseQty: 1,
  status: "pending",
  takenAt: null,
  stockQty: 10,
  lowStock: false,
  ...over,
});

describe("computeReminders", () => {
  const now = new Date(2026, 10, 11, 12, 0, 0); // 11/11/2026 12:00 local

  it("agenda só doses pendentes ainda no futuro, em ordem", () => {
    const r = computeReminders(
      [
        dose({ scheduleId: "a", time: "20:00" }),
        dose({ scheduleId: "b", time: "08:00" }), // passou
        dose({ scheduleId: "c", time: "15:30" }),
        dose({ scheduleId: "d", time: "18:00", status: "taken" }), // já tomada
        dose({ scheduleId: "e", time: "19:00", status: "skipped" }),
      ],
      now
    );
    expect(r.map((x) => x.key)).toEqual(["c@15:30", "a@20:00"]);
    expect(r[0].delayMs).toBe(3.5 * 3600 * 1000);
  });

  it("horário exatamente agora não agenda; texto inclui nome, dose e quantidade", () => {
    expect(computeReminders([dose({ time: "12:00" })], now)).toHaveLength(0);
    const [r] = computeReminders([dose({ time: "13:00", doseQty: 2 })], now);
    expect(r.body).toBe("Losartana (50mg) · 2 unidades");
  });
});

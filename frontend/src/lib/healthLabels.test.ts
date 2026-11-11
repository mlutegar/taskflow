import { describe, it, expect } from "vitest";
import { frequencyText } from "./healthLabels";

describe("frequencyText", () => {
  it("descreve cada frequência de passo", () => {
    expect(frequencyText({ frequency: "daily", daysOfWeek: [], intervalDays: null })).toBe("Todos os dias");
    expect(frequencyText({ frequency: "weekdays", daysOfWeek: [], intervalDays: null })).toBe("Segunda a sexta");
    expect(frequencyText({ frequency: "custom_days", daysOfWeek: [2, 5], intervalDays: null })).toBe("Ter, Sex");
    expect(frequencyText({ frequency: "every_n_days", daysOfWeek: [], intervalDays: 3 })).toBe("A cada 3 dias");
  });
});

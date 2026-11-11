import type { MedFrequency, ProductCategory, ProductStatus } from "../api/saude";

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const FREQUENCY_LABELS: Record<MedFrequency, string> = {
  daily: "Todos os dias",
  weekdays: "Segunda a sexta",
  custom_days: "Dias da semana específicos",
  every_n_days: "A cada N dias",
};

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  protetor: "Protetor solar",
  hidratante: "Hidratante",
  esfoliante: "Esfoliante",
  limpeza: "Limpeza",
  serum: "Sérum",
  outro: "Outro",
};

export const STATUS_LABELS: Record<ProductStatus, string> = {
  have: "Tenho",
  low: "Acabando",
  need_to_buy: "Preciso comprar",
};

export function frequencyText(s: { frequency: MedFrequency; daysOfWeek: number[]; intervalDays: number | null }): string {
  switch (s.frequency) {
    case "daily": return "Todos os dias";
    case "weekdays": return "Segunda a sexta";
    case "custom_days": return s.daysOfWeek.map((d) => WEEKDAY_SHORT[d]).join(", ");
    case "every_n_days": return `A cada ${s.intervalDays} dias`;
  }
}

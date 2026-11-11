import type { MedFrequency, ProductCategory, ProductStatus } from "../api/saude";

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const FREQUENCY_LABELS: Record<MedFrequency, string> = {
  daily: "Todos os dias",
  weekdays: "Segunda a sexta",
  custom_days: "Dias da semana específicos",
  every_n_days: "A cada N dias",
};

/** Sugestões de tipo de treino (o campo aceita texto livre). */
export const WORKOUT_TYPES = ["Musculação", "Corrida", "Caminhada", "Ciclismo", "Natação", "Yoga", "Funcional", "Alongamento", "Futebol"];

/** Ordem de exibição dos dias (a semana começa na segunda); valores = getDay (0=dom). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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

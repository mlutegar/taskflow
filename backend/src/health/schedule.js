/**
 * health/schedule.js — regra de frequência (pura) usada por Remédios e, na Fase B,
 * pelos passos de Skincare.
 *
 * Frequências:
 *  - daily        todo dia
 *  - weekdays     seg–sex
 *  - custom_days  dias da semana em `daysOfWeek` (0=dom … 6=sáb)
 *  - every_n_days a cada `intervalDays` dias, ÂNCORA = `startDate` (o dia do início aplica)
 *
 * Datas são "YYYY-MM-DD" (dia civil). Fora de [startDate, endDate] nunca aplica.
 */
import { dayNumber, dayOfWeek } from "../recurrenceDays.js";

export const FREQUENCIES = ["daily", "weekdays", "custom_days", "every_n_days"];

export function appliesOnDate(rule, date) {
  const { frequency = "daily", daysOfWeek = [], intervalDays, startDate, endDate } = rule;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;

  switch (frequency) {
    case "daily":
      return true;
    case "weekdays": {
      const dow = dayOfWeek(date);
      return dow >= 1 && dow <= 5;
    }
    case "custom_days":
      return Array.isArray(daysOfWeek) && daysOfWeek.includes(dayOfWeek(date));
    case "every_n_days": {
      const n = Number(intervalDays);
      if (!Number.isInteger(n) || n < 1 || !startDate) return false;
      return (dayNumber(date) - dayNumber(startDate)) % n === 0;
    }
    default:
      return false;
  }
}

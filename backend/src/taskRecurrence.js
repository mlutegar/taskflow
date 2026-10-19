const DAY_MS = 86_400_000;
const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export function validTimeZone(value) {
  if (!value || typeof value !== "string" || value.length > 64) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function dateInTimeZone(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function storedDate(date) {
  return new Date(`${date}T00:00:00.000Z`);
}

function parts(date) { return date.split("-").map(Number); }
function iso(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}
function addDays(date, days) {
  const [year, month, day] = parts(date);
  return iso(year, month, day + days);
}
function addMonths(date, months, forceFirst = false) {
  const [year, month, day] = parts(date);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(target.getUTCFullYear(), target.getUTCMonth() + 1, forceFirst ? 1 : Math.min(day, lastDay));
}
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}
function addYears(date, years) {
  const [year, month, day] = parts(date);
  let nextYear = year + years;
  let nextDay = day;

  // Caso especial: 29/02 em ano não bissexto
  if (month === 2 && day === 29 && !isLeapYear(nextYear)) {
    nextDay = 28;
  }

  // Caso especial: dia excede o último dia do mês (ex: 31 em meses com 30 dias)
  const daysInMonth = new Date(Date.UTC(nextYear, month, 0)).getUTCDate();
  if (nextDay > daysInMonth) {
    nextDay = daysInMonth;
  }

  return iso(nextYear, month, nextDay);
}
function weekday(date) {
  const [year, month, day] = parts(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

export function isBrazilianHoliday(date) {
  const [year] = parts(date);
  const fixed = new Set(["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"]);
  if (fixed.has(date.slice(5))) return true;
  const easter = easterSunday(year);
  return [addDays(easter, -48), addDays(easter, -47), addDays(easter, -2), addDays(easter, 60)].includes(date);
}

function advanceToAllowedDay(date, recurrence, rule = {}) {
  let next = date;
  for (let i = 0; i < 370; i++) {
    const dow = weekday(next);
    const blockedSchedule = recurrence === "weekdays"
      ? (dow === 0 || dow === 6)
      : recurrence === "custom" && rule.type === "weekdays"
        ? !(rule.weekdays || []).map(Number).includes(dow)
        : false;
    const blockedWeekend = rule.skipWeekends && (dow === 0 || dow === 6);
    const blockedHoliday = rule.skipHolidays && isBrazilianHoliday(next);
    if (!blockedSchedule && !blockedWeekend && !blockedHoliday) return next;
    next = addDays(next, 1);
  }
  return next;
}

export function computeNextDueDate(currentDueDate, recurrence, rule = {}, now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const today = dateInTimeZone(now, timeZone);
  const base = currentDueDate && currentDueDate > today ? currentDueDate : today;
  let next;

  if (recurrence === "monthly") next = addMonths(base, 1);
  else if (recurrence === "monthly_first") next = addMonths(base, 1, true);
  else if (recurrence === "yearly") next = addYears(base, 1);
  else if (recurrence === "weekly") next = addDays(base, 7);
  else if (recurrence === "biweekly") next = addDays(base, 14);
  else if (recurrence === "weekdays") {
    next = addDays(base, 1);
    while ([0, 6].includes(weekday(next))) next = addDays(next, 1);
  } else if (recurrence === "custom" && rule.type === "weekdays") {
    const allowed = new Set((rule.weekdays || []).map(Number));
    next = addDays(base, 1);
    for (let i = 0; i < 14 && !allowed.has(weekday(next)); i++) next = addDays(next, 1);
  } else if (recurrence === "custom") {
    next = addDays(base, Math.max(1, Math.min(365, Number(rule.intervalDays) || 1)));
  } else {
    next = addDays(base, 1);
  }

  return advanceToAllowedDay(next, recurrence, rule);
}

export function parseRecurrenceRule(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return {}; }
}

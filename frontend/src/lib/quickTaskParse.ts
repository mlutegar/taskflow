/**
 * quickTaskParse.ts — parsing leve de linguagem natural para a captura rápida.
 *
 * Extrai do título tokens de data, hora e prioridade, devolvendo o título limpo
 * e os campos detectados. Tudo em hora LOCAL (usa os helpers de dateUtils).
 *
 * Exemplos:
 *   "Pagar boleto amanhã 14h !alta"  → { title: "Pagar boleto", due_date: <amanhã>, due_time: "14:00", priority: 2 }
 *   "Estudar terça 9:30"             → { title: "Estudar", due_date: <próxima terça>, due_time: "09:30" }
 *   "Comprar pão hoje !1"            → { title: "Comprar pão", due_date: <hoje>, priority: 1 }
 *
 * Conservador por padrão: só remove do título os tokens efetivamente
 * reconhecidos; se nada casar, o título volta intacto.
 */

import { todayISO, daysAgoISO } from "./dateUtils";

export interface ParsedQuickTask {
  title: string;
  due_date?: string;
  due_time?: string;
  priority?: number;
}

const PRIORITY_WORDS: Record<string, number> = {
  critica: 1, crítica: 1, urgente: 1,
  alta: 2,
  media: 3, média: 3,
  baixa: 4,
};

// Segunda=1 … Domingo=0 (getDay). Aceita abreviações.
const WEEKDAYS: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1,
  terca: 2, terça: 2, ter: 2,
  quarta: 3, qua: 3,
  quinta: 4, qui: 4,
  sexta: 5, sex: 5,
  sabado: 6, sábado: 6, sab: 6,
};

/** ISO (YYYY-MM-DD) local N dias à frente de hoje. */
function inDaysISO(n: number): string {
  return daysAgoISO(-n);
}

/** Próxima ocorrência (estritamente futura, ou hoje) de um dia da semana. */
function nextWeekdayISO(target: number): string {
  const now = new Date();
  const diff = (target - now.getDay() + 7) % 7;
  // 0 → hoje é o próprio dia; usamos hoje (não pula 7 dias).
  return inDaysISO(diff);
}

/** Remove um trecho do título e normaliza espaços. */
function strip(title: string, matched: string): string {
  return title.replace(matched, " ").replace(/\s{2,}/g, " ").trim();
}

export function parseQuickTask(raw: string): ParsedQuickTask {
  let title = (raw || "").trim();
  const result: ParsedQuickTask = { title };
  if (!title) return result;

  // ── Prioridade: !alta / !1 / p2 ──────────────────────────────────────────
  // Usamos lookahead `(?=\s|$)` em vez de `\b` porque `\b` não funciona após
  // caracteres acentuados (crítica, média) — \w é só [A-Za-z0-9_].
  const prioWord = title.match(/(^|\s)!(crítica|critica|urgente|alta|média|media|baixa)(?=\s|$)/i);
  if (prioWord) {
    result.priority = PRIORITY_WORDS[prioWord[2].toLowerCase()];
    title = strip(title, prioWord[0]);
  } else {
    const prioNum = title.match(/(^|\s)[!p]([1-4])\b/i);
    if (prioNum) {
      result.priority = Number(prioNum[2]);
      title = strip(title, prioNum[0]);
    }
  }

  // ── Hora: 14h / 14h30 / 9:30 ─────────────────────────────────────────────
  const timeH = title.match(/(^|\s)(\d{1,2})h(\d{2})?\b/i);
  const timeColon = title.match(/(^|\s)(\d{1,2}):(\d{2})\b/);
  if (timeH) {
    const hh = Math.min(23, Number(timeH[2]));
    const mm = timeH[3] ? Math.min(59, Number(timeH[3])) : 0;
    result.due_time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    title = strip(title, timeH[0]);
  } else if (timeColon) {
    const hh = Math.min(23, Number(timeColon[2]));
    const mm = Math.min(59, Number(timeColon[3]));
    result.due_time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    title = strip(title, timeColon[0]);
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  const depoisAmanha = title.match(/(^|\s)depois de (amanhã|amanha)(?=\s|$)/i);
  const amanha = title.match(/(^|\s)(amanhã|amanha)(?=\s|$)/i);
  const hoje = title.match(/(^|\s)hoje(?=\s|$)/i);
  const ddmm = title.match(/(^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);

  if (depoisAmanha) {
    result.due_date = inDaysISO(2);
    title = strip(title, depoisAmanha[0]);
  } else if (amanha) {
    result.due_date = inDaysISO(1);
    title = strip(title, amanha[0]);
  } else if (hoje) {
    result.due_date = todayISO();
    title = strip(title, hoje[0]);
  } else if (ddmm) {
    const d = Number(ddmm[2]);
    const m = Number(ddmm[3]);
    const now = new Date();
    let y = ddmm[4] ? Number(ddmm[4]) : now.getFullYear();
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      result.due_date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      title = strip(title, ddmm[0]);
    }
  } else {
    // Dia da semana (só se aparecer como palavra isolada).
    for (const [word, dow] of Object.entries(WEEKDAYS)) {
      const re = new RegExp(`(^|\\s)${word}(?=\\s|$)`, "i");
      const m = title.match(re);
      if (m) {
        result.due_date = nextWeekdayISO(dow);
        title = strip(title, m[0]);
        break;
      }
    }
  }

  result.title = title.trim();
  // Se a limpeza esvaziou o título (só tinha tokens), preserva o texto original.
  if (!result.title) result.title = raw.trim();
  return result;
}

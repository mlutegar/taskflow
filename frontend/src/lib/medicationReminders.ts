/**
 * Lembretes LOCAIS de remédio (best-effort).
 *
 * Só disparam com o app/aba aberto (timers + Notification API). Lembrete confiável com o
 * app fechado exige Web Push (VAPID + handler `push` no SW + agendador no backend) —
 * pendência registrada no CLAUDE.md.
 */
import type { TodayDose } from "../api/saude";

export interface DoseReminder {
  key: string; // scheduleId + hora (evita duplicar)
  title: string;
  body: string;
  delayMs: number;
}

/** Converte "HH:MM" para um Date no dia de `now`. */
export function timeToDate(time: string, now: Date): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Doses pendentes de HOJE cujo horário ainda não passou → lista de lembretes a agendar.
 * Horários já passados e doses já registradas (tomei/pulei) não geram lembrete.
 */
export function computeReminders(doses: TodayDose[], now: Date): DoseReminder[] {
  const out: DoseReminder[] = [];
  for (const d of doses) {
    if (d.status !== "pending") continue;
    const delayMs = timeToDate(d.time, now).getTime() - now.getTime();
    if (delayMs <= 0) continue;
    const qty = d.doseQty === 1 ? "1 unidade" : `${d.doseQty} unidades`;
    out.push({
      key: `${d.scheduleId}@${d.time}`,
      title: `💊 Hora do remédio — ${d.time}`,
      body: `${d.name}${d.dose ? ` (${d.dose})` : ""} · ${qty}`,
      delayMs,
    });
  }
  return out.sort((a, b) => a.delayMs - b.delayMs);
}

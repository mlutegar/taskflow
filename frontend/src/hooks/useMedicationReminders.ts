import { useEffect } from "react";
import { useTodayDoses } from "./useMedications";
import { computeReminders } from "../lib/medicationReminders";
import { getPermission, showNotification } from "../lib/notifications";
import { storageGet } from "../lib/storage";
import { SK } from "../lib/storageKeys";
import { todayISO } from "../lib/dateUtils";

/** true se o usuário ativou os lembretes de remédio E o navegador permite notificações. */
export function medicationRemindersActive(): boolean {
  return storageGet<boolean>(SK.MED_REMINDERS_ENABLED, false) === true && getPermission() === "granted";
}

/**
 * Agenda timers locais para as doses pendentes de hoje (best-effort: só dispara com o
 * app aberto). Compartilha o cache de `useTodayDoses` com a página de Saúde.
 * Chamar no Root (acima do early-return de login) com `enabled = !!user`.
 */
export function useMedicationReminders(enabled: boolean): void {
  const active = enabled && medicationRemindersActive();
  const { data } = useTodayDoses(todayISO(), active);

  useEffect(() => {
    if (!active || !data) return;
    const timers = computeReminders(data.items, new Date()).map((r) =>
      setTimeout(() => {
        showNotification(r.title, { body: r.body, tag: `med-${r.key}`, renotify: true });
      }, r.delayMs)
    );
    return () => timers.forEach(clearTimeout);
  }, [active, data]);
}

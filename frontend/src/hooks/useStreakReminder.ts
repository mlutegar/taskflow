import { useEffect } from "react";
import { getStreak, getHistory } from "../lib/dailyFocusHistory";
import { todayISO, ptBRtoISO } from "../lib/dateUtils";

export function useStreakReminder(): void {
  useEffect(() => {
    const hour: number = new Date().getHours();
    if (hour < 17) return;

    const today: string = todayISO();

    const notifiedDate: string | null = localStorage.getItem("taskflow.streakNotifiedDate");
    if (notifiedDate === today) return;

    const streak: number = getStreak();
    if (streak < 2) return;

    const history = getHistory();
    const hasSessionToday: boolean = history.some((entry) => {
      if (!entry.date) return false;
      return ptBRtoISO(entry.date) === today;
    });

    if (hasSessionToday) return;

    function showNotif(): void {
      if (typeof Notification === "undefined") return;
      new Notification("⚡ Streak em risco!", {
        body: `Voce tem ${streak} dias seguidos. Faca uma sessao hoje!`,
        icon: "/icons/icon-192x192.png",
        tag: "streak-reminder",
      });
      localStorage.setItem("taskflow.streakNotifiedDate", today);
    }

    if (typeof Notification === "undefined") return;

    if (Notification.permission === "granted") {
      showNotif();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p: NotificationPermission) => {
        if (p === "granted") showNotif();
      });
    }
  }, []);
}

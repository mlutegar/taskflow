import { useEffect } from "react";
import { getStreak, getHistory } from "../lib/dailyFocusHistory";

export function useStreakReminder() {
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 17) return;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const today = `${yyyy}-${mm}-${dd}`;

    const notifiedDate = localStorage.getItem("taskflow.streakNotifiedDate");
    if (notifiedDate === today) return;

    const streak = getStreak();
    if (streak < 2) return;

    const history = getHistory();
    const hasSessionToday = history.some((entry) => {
      if (!entry.date) return false;
      const parts = entry.date.split("/");
      if (parts.length !== 3) return false;
      const iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
      return iso === today;
    });

    if (hasSessionToday) return;

    function showNotif() {
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
      Notification.requestPermission().then((p) => {
        if (p === "granted") showNotif();
      });
    }
  }, []);
}

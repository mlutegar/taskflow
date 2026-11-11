import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { getPermission, requestPermission } from "../../lib/notifications";
import { storageGet, storageSet } from "../../lib/storage";
import { SK } from "../../lib/storageKeys";
import { useToast } from "../shared/Toast";
import TodayDoses from "./TodayDoses";
import MedicationList from "./MedicationList";
import IntakeHistory from "./IntakeHistory";
import styles from "./Health.module.css";

type Sub = "today" | "meds" | "history";

/** Ativa/desativa os lembretes locais (best-effort: só com o app aberto). */
function RemindersToggle(): JSX.Element | null {
  const { showToast } = useToast();
  const perm = getPermission();
  const [enabled, setEnabled] = useState<boolean>(storageGet<boolean>(SK.MED_REMINDERS_ENABLED, false) === true);

  if (perm === "unsupported") return null;

  const toggle = async (): Promise<void> => {
    if (enabled) {
      storageSet(SK.MED_REMINDERS_ENABLED, false);
      setEnabled(false);
      return;
    }
    const ok = perm === "granted" || (await requestPermission());
    if (!ok) {
      showToast("Permita as notificações do navegador para ativar os lembretes.", "warning");
      return;
    }
    storageSet(SK.MED_REMINDERS_ENABLED, true);
    setEnabled(true);
    showToast("Lembretes ativados — avisam enquanto o app estiver aberto.", "success");
  };

  return (
    <button className={`${styles.chip} ${enabled ? styles.active : ""}`} onClick={toggle} aria-pressed={enabled}>
      {enabled ? <Bell size={14} aria-hidden="true" /> : <BellOff size={14} aria-hidden="true" />}{" "}
      Lembretes
    </button>
  );
}

export default function MedicationsSection(): JSX.Element {
  const [sub, setSub] = useState<Sub>("today");
  const items: { id: Sub; label: string }[] = [
    { id: "today", label: "Hoje" },
    { id: "meds", label: "Remédios" },
    { id: "history", label: "Histórico" },
  ];

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.subtabs} role="tablist" aria-label="Remédios">
          {items.map((i) => (
            <button
              key={i.id}
              role="tab"
              aria-selected={sub === i.id}
              className={`${styles.chip} ${sub === i.id ? styles.active : ""}`}
              onClick={() => setSub(i.id)}
            >
              {i.label}
            </button>
          ))}
        </div>
        <RemindersToggle />
      </div>

      {sub === "today" && <TodayDoses />}
      {sub === "meds" && <MedicationList />}
      {sub === "history" && <IntakeHistory />}
    </>
  );
}

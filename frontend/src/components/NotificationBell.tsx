import { useState, useEffect } from "react";
import {
  isSupported,
  getPermission,
  requestPermission,
  savePreference,
  loadPreference,
  showNotification,
} from "../lib/notifications";

/**
 * NotificationBell — botão para ativar/desativar notificações push locais.
 * Adicione em qualquer header/toolbar da aplicação.
 */
export default function NotificationBell(): JSX.Element | null {
  const [permission, setPermission] = useState<string>("default");
  const [enabled, setEnabled]       = useState<boolean>(true);

  useEffect(() => {
    setPermission(getPermission());
    const pref = loadPreference();
    if (pref.enabled !== undefined) setEnabled(pref.enabled);
  }, []);

  if (!isSupported()) return null;

  const handleClick = async (): Promise<void> => {
    if (permission === "denied") {
      alert("Notificações bloqueadas. Habilite nas configurações do navegador e recarregue a página.");
      return;
    }
    if (permission !== "granted") {
      const granted = await requestPermission();
      const newPerm = granted ? "granted" : "denied";
      setPermission(newPerm);
      if (granted) {
        savePreference(true);
        setEnabled(true);
        showNotification("TaskFlow", { body: "Notificações ativadas! Você receberá lembretes de tarefas." });
      }
      return;
    }
    const next = !enabled;
    setEnabled(next);
    savePreference(next);
  };

  const icon  = permission !== "granted" ? "🔕" : enabled ? "🔔" : "🔕";
  const label = permission !== "granted"
    ? "Ativar notificações"
    : enabled
      ? "Notificações ativas — clique para desativar"
      : "Notificações desativadas — clique para ativar";

  return (
    <button
      onClick={handleClick}
      title={label}
      aria-label={label}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: "1.2rem",
        padding: "0.25rem 0.4rem",
        borderRadius: "0.375rem",
        lineHeight: 1,
      }}
    >
      {icon}
    </button>
  );
}

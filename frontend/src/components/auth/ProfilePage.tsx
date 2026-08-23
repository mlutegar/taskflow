import { useState } from "react";
import { formatBuildDate } from "../../version.js";
import { useConfirm } from "../ConfirmDialog";

const USER_KEY = "taskflow.authUser";

function getStoredUser(): { email?: string } | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
}

interface ProfilePageProps {
  onSignOut: () => void;
}

export default function ProfilePage({ onSignOut }: ProfilePageProps) {
  const user = getStoredUser();
  const email = user?.email ?? "";
  const [checking, setChecking] = useState<boolean>(false);
  const { confirm, ConfirmUI } = useConfirm();

  const handleCheckUpdates = async (): Promise<void> => {
    const ok = await confirm({
      title: "Buscar atualizações?",
      message: "O app será recarregado e o cache local será limpo.",
      confirmLabel: "Recarregar",
    });
    if (!ok) return;
    setChecking(true);
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    window.location.reload(true as unknown as boolean);
  };

  const handleSignOut = async (): Promise<void> => {
    const ok = await confirm({
      title: "Sair da conta?",
      message: "Você será redirecionado para a tela de login.",
      confirmLabel: "Sair",
    });
    if (ok) onSignOut();
  };

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  };
  const label: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" };
  const btnBase: React.CSSProperties = {
    width: "100%", padding: "12px 16px", background: "none", border: "none",
    borderRadius: "var(--radius-sm)", fontSize: 14, fontWeight: 600,
    cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center",
    gap: 10, transition: "background 0.15s",
  };

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>👤 Perfil</h2>

      <div style={card}>
        <div style={label}>Conta</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{email || "—"}</div>
      </div>

      <div style={card}>
        <div style={label}>Versão instalada</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>{formatBuildDate()}</div>
      </div>

      <div style={{ ...card, padding: "4px" }}>
        <button
          onClick={handleCheckUpdates}
          disabled={checking}
          style={{ ...btnBase, color: "var(--text)", opacity: checking ? 0.6 : 1 }}
          onMouseEnter={(e) => !checking && (e.currentTarget.style.background = "var(--surface-hover, rgba(0,0,0,0.05))")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          {checking ? "⏳ Limpando cache..." : "🔄 Buscar atualizações"}
        </button>
      </div>

      <div style={{ ...card, padding: "4px" }}>
        <button
          onClick={handleSignOut}
          style={{ ...btnBase, color: "var(--danger, #e05252)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(224,82,82,0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          🚪 Sair da conta
        </button>
      </div>

      {ConfirmUI}
    </div>
  );
}

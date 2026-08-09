import { supabase } from "../../lib/supabase";
import { useState, useEffect } from "react";
import { formatBuildDate } from "../../version.js";
import { useConfirm } from "../ConfirmDialog";

export default function ProfilePage({ onSignOut }) {
  const [email, setEmail] = useState("");
  const { confirm, ConfirmUI } = useConfirm();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email ?? "");
    });
  }, []);

  const handleSignOut = async () => {
    const ok = await confirm({
      title: "Sair da conta?",
      message: "Você será redirecionado para a tela de login.",
      confirmLabel: "Sair",
    });
    if (ok) onSignOut();
  };

  return (
    <div style={{
      maxWidth: 480,
      margin: "40px auto",
      padding: "0 20px",
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>👤 Perfil</h2>

      {/* Info da conta */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Conta
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{email || "—"}</div>
      </div>

      {/* Botão sair */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "4px",
      }}>
        <button
          onClick={handleSignOut}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "none",
            border: "none",
            borderRadius: "var(--radius-sm)",
            color: "var(--danger, #e05252)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 10,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(224,82,82,0.08)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "none"}
        >
          🚪 Sair da conta
        </button>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", opacity: 0.4 }}>
        {formatBuildDate()}
      </div>

      {ConfirmUI}
    </div>
  );
}

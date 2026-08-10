import { supabase } from "../../lib/supabase";
import { useState, useEffect } from "react";
import { formatBuildDate } from "../../version.js";
import { useConfirm } from "../ConfirmDialog";

export default function ProfilePage({ onSignOut }) {
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null); // { type: "success"|"error", text }
  const { confirm, ConfirmUI } = useConfirm();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email ?? "");
    });
  }, []);

  const handleCheckUpdates = async () => {
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

    window.location.reload(true);
  };

  const handleChangePassword = async () => {
    if (!email) return;
    setPasswordMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      setPasswordMsg({ type: "error", text: "Erro ao enviar e-mail. Tente novamente." });
    } else {
      setPasswordMsg({ type: "success", text: `Link enviado para ${email}` });
    }
  };

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

      {/* Versão do app */}
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
          Versão instalada
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>
          {formatBuildDate()}
        </div>
      </div>

      {/* Segurança */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "4px",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{
          padding: "8px 16px 4px",
          fontSize: 11,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          Segurança
        </div>
        <button
          onClick={handleChangePassword}
          disabled={!email}
          style={{
            width: "100%",
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderRadius: "var(--radius-sm)",
            color: "var(--text)",
            fontSize: 14,
            fontWeight: 600,
            cursor: email ? "pointer" : "default",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 10,
            transition: "background 0.15s",
            opacity: email ? 1 : 0.5,
          }}
          onMouseEnter={(e) => email && (e.currentTarget.style.background = "var(--surface-hover, rgba(0,0,0,0.05))")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          🔑 Alterar senha
        </button>
        {passwordMsg && (
          <div style={{
            margin: "0 12px 10px",
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            background: passwordMsg.type === "success" ? "rgba(78,204,163,0.1)" : "rgba(224,82,82,0.1)",
            color: passwordMsg.type === "success" ? "var(--success)" : "var(--danger)",
          }}>
            {passwordMsg.text}
          </div>
        )}
      </div>

      {/* Botão buscar atualizações */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "4px",
      }}>
        <button
          onClick={handleCheckUpdates}
          disabled={checking}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "none",
            border: "none",
            borderRadius: "var(--radius-sm)",
            color: "var(--text)",
            fontSize: 14,
            fontWeight: 600,
            cursor: checking ? "default" : "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 10,
            transition: "background 0.15s",
            opacity: checking ? 0.6 : 1,
          }}
          onMouseEnter={(e) => !checking && (e.currentTarget.style.background = "var(--surface-hover, rgba(0,0,0,0.05))")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          {checking ? "⏳ Limpando cache..." : "🔄 Buscar atualizações"}
        </button>
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

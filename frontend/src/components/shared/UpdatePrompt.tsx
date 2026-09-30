import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

/**
 * Banner "Nova versão disponível — Atualizar".
 *
 * Com `registerType: "prompt"`, o novo service worker fica em "waiting" e este
 * componente mostra um banner. Ao clicar em "Atualizar", `updateSW(true)` envia
 * SKIP_WAITING ao SW e recarrega a página com a versão nova — sem o usuário
 * precisar fechar/reabrir o PWA manualmente.
 *
 * Também revalida periodicamente (e ao voltar o foco), já que um SPA por hash
 * não dispara navegações que fariam o browser checar por atualizações.
 */
export default function UpdatePrompt(): JSX.Element | null {
  const [needRefresh, setNeedRefresh] = useState<boolean>(false);
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // Checa por nova versão a cada 60s e ao reabrir/focar o app.
        const check = (): void => { registration.update().catch(() => {}); };
        const iv = setInterval(check, 60_000);
        const onVisible = (): void => { if (document.visibilityState === "visible") check(); };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", check);
        // Guarda cleanup no próprio registration (efeito roda uma vez).
        (registration as unknown as { _cleanup?: () => void })._cleanup = () => {
          clearInterval(iv);
          document.removeEventListener("visibilitychange", onVisible);
          window.removeEventListener("focus", check);
        };
      },
    });
    setUpdateSW(() => update);
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 10000, display: "flex", alignItems: "center", gap: 12,
        background: "var(--surface, #1a1a22)", color: "var(--text, #fff)",
        border: "1px solid var(--accent, #7c6ef5)", borderRadius: 12,
        boxShadow: "0 12px 32px rgba(0,0,0,0.45)", padding: "10px 14px",
        maxWidth: "min(92vw, 420px)", fontSize: 13, fontWeight: 600,
      }}
    >
      <span style={{ fontSize: 16 }} aria-hidden="true">✨</span>
      <span style={{ flex: 1 }}>Nova versão disponível</span>
      <button
        onClick={() => updateSW?.(true)}
        style={{
          padding: "7px 14px", borderRadius: 8, border: "none",
          background: "var(--accent, #7c6ef5)", color: "#fff",
          fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        Atualizar
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Depois"
        title="Depois"
        style={{
          padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)",
          background: "none", color: "var(--text-muted)", fontWeight: 600,
          fontSize: 12, cursor: "pointer",
        }}
      >
        Depois
      </button>
    </div>
  );
}

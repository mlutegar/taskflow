/**
 * ConfirmDialog — Modal de confirmação para ações destrutivas.
 *
 * Uso via hook useConfirm():
 *   const { confirm, ConfirmUI } = useConfirm();
 *   // No JSX: {ConfirmUI}
 *   // Para pedir confirmação:
 *   const ok = await confirm({ title: "Excluir rotina?", message: "Essa ação não pode ser desfeita.", confirmLabel: "Excluir" });
 *   if (ok) deletar();
 */

import { useState, useCallback, useRef } from "react";

// ── Componente visual ─────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ open, title, message, confirmLabel = "Confirmar", onConfirm, onCancel }: ConfirmDialogProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 0 env(safe-area-inset-bottom)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius) var(--radius) 0 0",
          padding: "24px 20px 20px",
          width: "100%",
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          animation: "slideUp 0.18s ease",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{title}</div>
        {message && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{message}</div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "10px 0",
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", color: "var(--text)",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "10px 0",
              background: "rgba(224,82,82,0.15)", border: "1px solid rgba(224,82,82,0.4)",
              borderRadius: "var(--radius-sm)", color: "var(--danger, #e05252)",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
}

export function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean>; ConfirmUI: JSX.Element } {
  const [state, setState] = useState<ConfirmState>({ open: false, title: "", message: "", confirmLabel: "Confirmar" });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(({ title, message, confirmLabel = "Excluir" }: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ open: true, title, message: message ?? "", confirmLabel });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current?.(false);
  }, []);

  const ConfirmUI = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmUI };
}

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import styles from "./Toast.module.css";

export type ToastType = "info" | "success" | "error" | "warning";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastOptions {
  /** Ação opcional (ex.: "Desfazer"). Ao clicar, executa e fecha o toast. */
  action?: ToastAction;
  /** Duração em ms antes de sumir sozinho (default 3000; use maior p/ ações). */
  durationMs?: number;
  /** Alias de `durationMs` (se ambos forem passados, `durationMs` vence). */
  duration?: number;
  /** Tipo do toast quando as opções são passadas como 2º argumento: `showToast(msg, { type, duration })`. */
  type?: ToastType;
}

interface ToastContextValue {
  /** `showToast(msg)`, `showToast(msg, "error")`, `showToast(msg, "error", { durationMs })` ou `showToast(msg, { type, duration })`. */
  showToast: (message: string, typeOrOptions?: ToastType | ToastOptions, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, typeOrOptions?: ToastType | ToastOptions, maybeOptions?: ToastOptions): void => {
    const options: ToastOptions | undefined = typeof typeOrOptions === "object" && typeOrOptions !== null ? typeOrOptions : maybeOptions;
    const type: ToastType = (typeof typeOrOptions === "string" ? typeOrOptions : options?.type) ?? "info";
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => {
      const next = [...prev, { id, message, type, action: options?.action }];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, options?.durationMs ?? options?.duration ?? 3000);
  }, []);

  const dismiss = (id: string): void => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={styles.container}>
        {toasts.map(t => (
          <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
            <span className={styles.icon}>
              {t.type === "success" ? "✅" : t.type === "error" || t.type === "warning" ? "⚠️" : "ℹ️"}
            </span>
            <span className={styles.message}>{t.message}</span>
            {t.action && (
              <button
                className={styles.action}
                onClick={() => { t.action?.onClick(); dismiss(t.id); }}
              >
                {t.action.label}
              </button>
            )}
            <button className={styles.close} onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

import { useState, useRef, useEffect } from "react";
import { User, Mail, Package, RefreshCw, LogOut, Copy, Check, Pencil, Sun, Moon } from "lucide-react";
import { formatBuildDate, APP_VERSION } from "../../version.js";
import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../shared/Toast";
import { getStoredTheme, setTheme, type Theme } from "../../lib/theme.js";
import styles from "./ProfilePage.module.css";

const USER_KEY = "taskflow.authUser";
const NAME_KEY = "taskflow.displayName";

function getStoredUser(): { email?: string; name?: string } | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
}
function getStoredName(): string {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}

interface ProfilePageProps {
  onSignOut: () => void;
}

export default function ProfilePage({ onSignOut }: ProfilePageProps) {
  const user = getStoredUser();
  const email = user?.email ?? "";
  const { confirm, ConfirmUI } = useConfirm();
  const { showToast } = useToast();

  const [checking, setChecking] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [theme, setThemeState] = useState<Theme>(getStoredTheme());

  const [name, setName] = useState<string>(() => getStoredName() || user?.name || "");
  const [editingName, setEditingName] = useState<boolean>(false);
  const [nameDraft, setNameDraft] = useState<string>(name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  const displayName = name || email.split("@")[0] || "Usuário";
  const initial = (displayName.trim()[0] || "?").toUpperCase();

  const handleChangeTheme = (next: Theme): void => {
    setTheme(next);
    setThemeState(next);
    showToast(next === "light" ? "Tema claro ativado" : "Tema escuro ativado", "success");
  };

  const handleCopyEmail = async (): Promise<void> => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      showToast("Email copiado", "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Não foi possível copiar", "error");
    }
  };

  const saveName = (): void => {
    const trimmed = nameDraft.trim();
    setName(trimmed);
    try { localStorage.setItem(NAME_KEY, trimmed); } catch { /* ignore */ }
    setEditingName(false);
    showToast("Nome atualizado", "success");
  };

  const handleCheckUpdates = async (): Promise<void> => {
    setChecking(true);
    try {
      let hasUpdate = false;
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          hasUpdate = Boolean(reg.waiting || reg.installing);
        }
      }

      if (hasUpdate) {
        const ok = await confirm({
          title: "Nova versão disponível",
          message: "O app será recarregado para aplicar a atualização.",
          confirmLabel: "Atualizar agora",
        });
        if (!ok) { setChecking(false); return; }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        window.location.reload();
        return;
      }

      showToast("Você já está na última versão ✓", "success");
    } catch {
      showToast("Falha ao verificar atualizações", "error");
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    const ok = await confirm({
      title: "Sair da conta?",
      message: "Você será redirecionado para a tela de login.",
      confirmLabel: "Sair",
    });
    if (ok) onSignOut();
  };

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.avatar} aria-hidden="true">{initial}</div>
        <div className={styles.headerInfo}>
          {editingName ? (
            <input
              ref={nameInputRef}
              className={styles.nameInput}
              value={nameDraft}
              maxLength={40}
              aria-label="Nome de exibição"
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") { setNameDraft(name); setEditingName(false); }
              }}
            />
          ) : (
            <div className={styles.nameRow}>
              <h2 className={styles.name}>{displayName}</h2>
              <button
                className={styles.iconBtn}
                aria-label="Editar nome"
                onClick={() => { setNameDraft(name); setEditingName(true); }}
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
            </div>
          )}
          {email && <div className={styles.subtitle}>{email}</div>}
        </div>
      </div>

      {/* ── Conta ──────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Conta</div>
        <div className={styles.card}>
          <div className={styles.chip}><Mail size={20} aria-hidden="true" /></div>
          <div className={styles.cardBody}>
            <div className={styles.label}>Email</div>
            <div className={styles.value}>{email || "—"}</div>
          </div>
          {email && (
            <button
              className={styles.iconBtn}
              aria-label="Copiar email"
              onClick={handleCopyEmail}
            >
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
          )}
        </div>
      </section>

      {/* ── Aparência ──────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Aparência</div>
        <div className={styles.card}>
          <div className={styles.chip}>
            {theme === "light" ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </div>
          <div className={styles.cardBody}>
            <div className={styles.label}>Tema</div>
            <div className={`${styles.value} ${styles.valueMuted}`}>{theme === "light" ? "Claro" : "Escuro"}</div>
          </div>
          <div className={styles.toggle} role="group" aria-label="Selecionar tema">
            <button
              className={`${styles.toggleOpt} ${theme === "dark" ? styles.toggleActive : ""}`}
              aria-pressed={theme === "dark"}
              onClick={() => handleChangeTheme("dark")}
            >
              <Moon size={14} aria-hidden="true" /> Escuro
            </button>
            <button
              className={`${styles.toggleOpt} ${theme === "light" ? styles.toggleActive : ""}`}
              aria-pressed={theme === "light"}
              onClick={() => handleChangeTheme("light")}
            >
              <Sun size={14} aria-hidden="true" /> Claro
            </button>
          </div>
        </div>
      </section>

      {/* ── Sobre o app ────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Sobre o app</div>
        <div className={styles.card}>
          <div className={styles.chip}><Package size={20} aria-hidden="true" /></div>
          <div className={styles.cardBody}>
            <div className={styles.label}>Versão instalada</div>
            <div className={`${styles.value} ${styles.valueMuted}`}>{APP_VERSION} · {formatBuildDate()}</div>
          </div>
        </div>
        <button
          className={styles.actionBtn}
          onClick={handleCheckUpdates}
          disabled={checking}
          aria-label="Buscar atualizações"
        >
          <RefreshCw size={18} aria-hidden="true" className={checking ? styles.spin : undefined} />
          {checking ? "Verificando..." : "Buscar atualizações"}
        </button>
      </section>

      {/* ── Sessão ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Sessão</div>
        <button
          className={`${styles.actionBtn} ${styles.danger}`}
          onClick={handleSignOut}
          aria-label="Sair da conta"
        >
          <LogOut size={18} aria-hidden="true" />
          Sair da conta
        </button>
      </section>

      {ConfirmUI}
    </div>
  );
}

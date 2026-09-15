import { useState, useRef, FormEvent } from "react";
import styles from "./LoginPage.module.css";
import { formatBuildDate } from "../../version.js";

interface LoginPageProps {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
}

export default function LoginPage({ signIn, signUp }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err: unknown) {
      setError(translateError((err as { message?: string }).message));
      // Mantém o e-mail digitado, limpa apenas a senha e devolve o foco a ela.
      setPassword("");
      passwordRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  function toggleMode(): void {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setError("");
    setInfo("");
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <div className={styles.logo}>⚡</div>
        <h1 className={styles.title}>TaskFlow</h1>
        <p className={styles.subtitle}>
          {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            E-mail
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoFocus
              autoComplete="email"
            />
          </label>

          <label className={styles.label}>
            Senha
            <div className={styles.passwordWrap}>
              <input
                ref={passwordRef}
                className={styles.input}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"}
                required
                minLength={mode === "signup" ? 6 : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          {error && <p className={styles.error}>{error}</p>}
          {info && <p className={styles.info}>{info}</p>}

          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button className={styles.toggle} onClick={toggleMode}>
          {mode === "login"
            ? "Não tem conta? Cadastre-se"
            : "Já tem conta? Entrar"}
        </button>

        <span className={styles.buildDate}>{formatBuildDate()}</span>
      </div>
    </div>
  );
}

/**
 * O backend já retorna mensagens de erro localizadas em português no campo
 * `message`. Esta função apenas garante um fallback amigável quando a mensagem
 * vem vazia (ex.: erro inesperado sem corpo).
 */
function translateError(msg: string | undefined): string {
  return msg && msg.trim() ? msg : "Ocorreu um erro. Tente novamente.";
}

import { useState } from "react";
import styles from "./LoginPage.module.css";
import { formatBuildDate } from "../../version.js";

export default function LoginPage({ signIn, signUp }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setInfo("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
      }
    } catch (err) {
      setError(translateError(err.message));
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
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
              autoComplete="email"
            />
          </label>

          <label className={styles.label}>
            Senha
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
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

function translateError(msg) {
  if (!msg) return "Ocorreu um erro. Tente novamente.";
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (msg.includes("User already registered")) return "Este e-mail já está cadastrado.";
  if (msg.includes("Password should be at least")) return "A senha deve ter pelo menos 6 caracteres.";
  if (msg.includes("Unable to validate email")) return "E-mail inválido.";
  if (msg.includes("rate limit")) return "Muitas tentativas. Aguarde um momento.";
  return msg;
}

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import LoginPage from "./LoginPage";

// Evita depender do define __BUILD_DATE__ no ambiente de teste.
vi.mock("../../version.js", () => ({ formatBuildDate: () => "build test" }));

afterEach(() => cleanup());

describe("LoginPage", () => {
  it("exibe a mensagem de erro e mantém o formulário montado ao errar a senha", async () => {
    // Regressão: antes, o LoginPage era desmontado durante a tentativa (gate de
    // loading global no Root), descartando o setError e "reiniciando" a tela.
    const signIn = vi.fn().mockRejectedValue(new Error("E-mail ou senha incorretos."));
    const signUp = vi.fn();

    render(<LoginPage signIn={signIn} signUp={signUp} />);

    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "senhaerrada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    // A mensagem aparece...
    expect(await screen.findByText("E-mail ou senha incorretos.")).toBeInTheDocument();
    // ...e o formulário continua montado (botão Entrar ainda presente).
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(signIn).toHaveBeenCalledWith("a@b.com", "senhaerrada");
  });

  it("mostra fallback amigável quando o erro não tem mensagem", async () => {
    const signIn = vi.fn().mockRejectedValue(new Error(""));
    render(<LoginPage signIn={signIn} signUp={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Ocorreu um erro. Tente novamente.")).toBeInTheDocument();
  });

  it("alterna a visibilidade da senha", () => {
    render(<LoginPage signIn={vi.fn()} signUp={vi.fn()} />);
    const pwd = screen.getByPlaceholderText("••••••••") as HTMLInputElement;

    expect(pwd.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(pwd.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(pwd.type).toBe("password");
  });
});

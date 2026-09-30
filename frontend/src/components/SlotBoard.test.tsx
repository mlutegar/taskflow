import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import SlotBoard from "./SlotBoard";

// Mock das libs de log usadas pelas sugestões/analytics (sem I/O real).
vi.mock("../lib/multiCardSessionLog", () => ({ getMultiCardSessions: () => [] }));
vi.mock("../lib/sessionUsageLog", () => ({ getUsageLogs: () => [] }));
vi.mock("../lib/customModes", () => ({ getCustomModes: () => [] }));
// ComboAnalytics e ModePicker são pesados — stub simples.
vi.mock("./ComboAnalytics", () => ({ default: () => null }));
vi.mock("./ModePicker", () => ({ default: () => <div data-testid="mode-picker" /> }));

describe("SlotBoard", () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  it("isola os slots por namespace de storage", () => {
    // Pré-carrega uma composição só no namespace do Daily Focus.
    localStorage.setItem(
      "taskflow.slotBoard.daily-focus",
      JSON.stringify([{ slotId: "s1", mode: { id: "agua", emoji: "💧", name: "Água", tagline: "", color: "#4af", colorBg: "#123" } }]),
    );

    // Board global (sem namespace) não deve ver a composição do Daily Focus.
    const { unmount } = render(<SlotBoard onStartSession={() => {}} />);
    expect(screen.getByText(/Nenhum modo ainda/i)).toBeInTheDocument();
    unmount();

    // Board com namespace "daily-focus" enxerga o slot pré-carregado.
    render(<SlotBoard onStartSession={() => {}} storageNamespace="daily-focus" />);
    expect(screen.getByText("Água")).toBeInTheDocument();
  });

  it("mostra a sugestão contextual de pausa longa", () => {
    render(<SlotBoard onStartSession={() => {}} suggestContext="long-pause" />);
    expect(screen.getByText(/Recarregar — pausa longa/i)).toBeInTheDocument();
  });

  it("inicia a sessão com os cards e o modo selecionado", () => {
    localStorage.setItem(
      "taskflow.slotBoard.df",
      JSON.stringify([{ slotId: "s1", mode: { id: "meditar", emoji: "🧘", name: "Meditar", tagline: "", color: "#4af", colorBg: "#123" } }]),
    );
    const onStart = vi.fn();
    render(<SlotBoard onStartSession={onStart} storageNamespace="df" />);

    fireEvent.click(screen.getByRole("button", { name: /Iniciar sessão/i }));

    expect(onStart).toHaveBeenCalledTimes(1);
    const [cards, mode] = onStart.mock.calls[0];
    expect(cards.map((c: { id: string }) => c.id)).toEqual(["meditar"]);
    expect(mode).toBe("sequential"); // default
  });

  it("carrega uma sugestão contextual como composição ao clicar", () => {
    const onStart = vi.fn();
    render(<SlotBoard onStartSession={onStart} suggestContext="long-pause" storageNamespace="df2" />);

    fireEvent.click(screen.getByText(/Recarregar — pausa longa/i));

    // Após carregar, os modos curados aparecem na lista de slots.
    expect(screen.getByText("Esticar")).toBeInTheDocument();
    expect(screen.getByText("Meditar")).toBeInTheDocument();
  });
});

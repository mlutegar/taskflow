import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import FloatingModeCard from "./FloatingModeCard";
import { ModeConfig } from "./types";

// Acumulador de foco mockado — o card lê getModeFocusStats no preview.
vi.mock("../../lib/modeFocusTimer", () => ({
  liveModeFocusMs: () => 0,
  isModeFocusRunning: () => true,
  getModeFocusStats: () => ({ focusMinutes: 12, pauseCount: 1, pausedMinutes: 2, focusBlocks: 1, tasksCompleted: 2 }),
}));

const MODE: ModeConfig = { id: "music_hundred", name: "100 Músicas", emoji: "🎵" } as ModeConfig;

function setup() {
  const onQuickEnd = vi.fn();
  const onDetail = vi.fn();
  const onDiscard = vi.fn();
  const onExpand = vi.fn();
  render(
    <FloatingModeCard
      mode={MODE}
      startedAt={new Date().toISOString()}
      onExpand={onExpand}
      onQuickEnd={onQuickEnd}
      onDetail={onDetail}
      onDiscard={onDiscard}
    />,
  );
  return { onQuickEnd, onDetail, onDiscard, onExpand };
}

/** Abre o painel de encerramento clicando no botão "Encerrar sessão". */
function openConfirm(): void {
  fireEvent.click(screen.getByLabelText("Encerrar sessão"));
}

describe("FloatingModeCard — encerramento salva para análise", () => {
  beforeEach(() => cleanup());

  it("abre o painel com preview do foco medido", () => {
    setup();
    openConfirm();
    expect(screen.getByText(/Funcionou\?/)).toBeInTheDocument();
    expect(screen.getByText(/12 min focado/)).toBeInTheDocument();
    expect(screen.getByText(/2 tarefas/)).toBeInTheDocument();
  });

  it("👍 Sim → registra rápido como worked=true", () => {
    const { onQuickEnd } = setup();
    openConfirm();
    fireEvent.click(screen.getByLabelText("Funcionou — registrar e sair"));
    expect(onQuickEnd).toHaveBeenCalledWith(true);
  });

  it("👎 Não → registra rápido como worked=false", () => {
    const { onQuickEnd } = setup();
    openConfirm();
    fireEvent.click(screen.getByLabelText("Não funcionou — registrar e sair"));
    expect(onQuickEnd).toHaveBeenCalledWith(false);
  });

  it("Detalhar → abre o formulário completo", () => {
    const { onDetail } = setup();
    openConfirm();
    fireEvent.click(screen.getByLabelText("Detalhar registro na tela cheia"));
    expect(onDetail).toHaveBeenCalledTimes(1);
  });

  it("Descartar → encerra sem registrar", () => {
    const { onDiscard } = setup();
    openConfirm();
    fireEvent.click(screen.getByLabelText("Descartar sem registrar"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("Cancelar → volta ao card sem encerrar", () => {
    const { onQuickEnd, onDiscard } = setup();
    openConfirm();
    fireEvent.click(screen.getByLabelText("Cancelar"));
    expect(screen.queryByText(/Funcionou\?/)).not.toBeInTheDocument();
    expect(onQuickEnd).not.toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
  });
});

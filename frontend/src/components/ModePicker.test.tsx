import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ModePicker from "./ModePicker";
import { todayISO } from "../lib/dateUtils";

// Usa dois modos reais e estáveis do catálogo
const MUSIC_ID = "music";
const MUSIC_NAME = "Music Mode";

const logsMock = vi.fn<[], { modeId: string; date: string; hour: number }[]>(() => []);

vi.mock("../lib/sessionUsageLog", () => ({
  getUsageLogs: () => logsMock(),
}));
vi.mock("../lib/customModes", () => ({
  getCustomModes: () => [],
}));

describe("ModePicker — resumo de hoje", () => {
  beforeEach(() => logsMock.mockReset());

  it("mostra estado vazio quando nada foi feito hoje", () => {
    logsMock.mockReturnValue([]);
    render(<ModePicker onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/Nenhum modo realizado hoje ainda/i)).toBeInTheDocument();
  });

  it("lista os modos feitos hoje com contagem", () => {
    const today = todayISO();
    logsMock.mockReturnValue([
      { modeId: MUSIC_ID, date: today, hour: 9 },
      { modeId: MUSIC_ID, date: today, hour: 11 },
    ]);
    render(<ModePicker onSelect={() => {}} onClose={() => {}} />);
    const summary = screen.getByRole("status");
    expect(summary).toHaveTextContent(/você já realizou 1 modo/i);
    expect(summary).toHaveTextContent(new RegExp(`${MUSIC_NAME} ×2 \\(11h\\)`));
  });

  it("filtra 'só não feitos hoje' escondendo o modo já usado", () => {
    const today = todayISO();
    logsMock.mockReturnValue([{ modeId: MUSIC_ID, date: today, hour: 9 }]);
    render(<ModePicker onSelect={() => {}} onClose={() => {}} />);
    // com o modo visível na lista (aparece o nome ao menos uma vez no card)
    fireEvent.click(screen.getByRole("button", { name: /Só não feitos hoje/i }));
    // após filtrar, o card do Music Mode não deve mais estar na lista
    const cards = screen.queryAllByText(MUSIC_NAME);
    // o nome ainda pode aparecer no resumo (role=status), mas não como card clicável
    const cardMatches = cards.filter((el) => el.closest("button"));
    expect(cardMatches.length).toBe(0);
  });
});

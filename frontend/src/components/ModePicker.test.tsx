import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ModePicker from "./ModePicker";
import { todayISO } from "../lib/dateUtils";

// Usa dois modos reais e estáveis do catálogo
const MUSIC_ID = "music_hundred";
const MUSIC_NAME = "100 Músicas";

const logsMock = vi.fn<[], { modeId: string; date: string; hour: number }[]>(() => []);

vi.mock("../lib/sessionUsageLog", () => ({
  getUsageLogs: () => logsMock(),
  getModeSuccessRate: () => null,
  getBestHourForMode: () => null,
}));
vi.mock("../lib/customModes", () => ({
  getCustomModes: () => [],
  getHiddenModeIds: () => new Set<string>(),
  toggleHiddenMode: () => new Set<string>(),
  setHiddenModeIds: () => {},
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
    const summary = screen.getAllByRole("status")[0];
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

  it("cicla a ordem e persiste a escolha entre remontagens", () => {
    logsMock.mockReturnValue([]);
    localStorage.clear();
    const { unmount } = render(<ModePicker onSelect={() => {}} onClose={() => {}} />);

    // Padrão → A–Z
    fireEvent.click(screen.getByRole("button", { name: /Ordem:/i }));
    expect(screen.getByRole("button", { name: /Ordem: A–Z/i })).toBeInTheDocument();

    // Cicla até Aleatória (A–Z → Mais usados → Menos usados → Aleatória)
    fireEvent.click(screen.getByRole("button", { name: /Ordem:/i }));
    expect(screen.getByRole("button", { name: /Ordem: Mais usados/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ordem:/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ordem:/i }));
    expect(screen.getByRole("button", { name: /Ordem: Aleatória/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Embaralhar/i })).toBeInTheDocument();

    // Remonta: a ordem "Aleatória" deve persistir
    unmount();
    cleanup();
    render(<ModePicker onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /Ordem: Aleatória/i })).toBeInTheDocument();
  });

  it("favorita um modo e persiste entre remontagens", () => {
    logsMock.mockReturnValue([]);
    localStorage.clear();
    const { unmount } = render(<ModePicker onSelect={() => {}} onClose={() => {}} />);

    const favBtn = screen.getByRole("button", { name: `Favoritar ${MUSIC_NAME}` });
    fireEvent.click(favBtn);
    expect(
      screen.getByRole("button", { name: `Remover ${MUSIC_NAME} dos favoritos` })
    ).toBeInTheDocument();

    // Remonta: o favorito deve continuar marcado
    unmount();
    cleanup();
    render(<ModePicker onSelect={() => {}} onClose={() => {}} />);
    expect(
      screen.getByRole("button", { name: `Remover ${MUSIC_NAME} dos favoritos` })
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhes ao clicar com o botão direito no card", () => {
    logsMock.mockReturnValue([]);
    localStorage.clear();
    render(<ModePicker onSelect={() => {}} onClose={() => {}} />);

    // Botão direito (context menu) no card do Music Mode
    fireEvent.contextMenu(screen.getByText(MUSIC_NAME));

    // O painel abre com um diálogo e mostra os passos ("o que fazer")
    expect(screen.getByRole("dialog", { name: /Detalhes do modo 100 Músicas/i })).toBeInTheDocument();
    expect(screen.getByText(/O que fazer/i)).toBeInTheDocument();
    expect(screen.getByText(/volte aqui/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar este modo/i })).toBeInTheDocument();
  });

  it("abre os detalhes ao SEGURAR (long-press) e não ao arrastar", () => {
    vi.useFakeTimers();
    logsMock.mockReturnValue([]);
    localStorage.clear();
    try {
      render(<ModePicker onSelect={() => {}} onClose={() => {}} />);
      const label = screen.getByText(MUSIC_NAME);

      // Arrastar não deve abrir (movimento > tolerância cancela o timer)
      fireEvent.pointerDown(label, { clientX: 10, clientY: 10, pointerType: "touch" });
      fireEvent.pointerMove(label, { clientX: 60, clientY: 60, pointerType: "touch" });
      vi.advanceTimersByTime(600);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      fireEvent.pointerUp(label);

      // Segurar (sem mover) abre após o delay
      fireEvent.pointerDown(label, { clientX: 10, clientY: 10, pointerType: "touch" });
      vi.advanceTimersByTime(600);
      expect(screen.getByRole("dialog", { name: /Detalhes do modo 100 Músicas/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

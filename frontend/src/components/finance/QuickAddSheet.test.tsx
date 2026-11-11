import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import QuickAddSheet from "./QuickAddSheet";
import MonthTab from "./MonthTab";

const cats = [
  { id: "c1", kind: "expense", name: "Mercado", emoji: "🛒" },
  { id: "c2", kind: "expense", name: "Transporte", emoji: "🚌" },
  { id: "c3", kind: "income", name: "Salário", emoji: "💼" },
];

vi.mock("../../hooks/useFinance", () => ({
  useFinanceCategories: () => ({ data: cats }),
  useSaveEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateSeries: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useFinanceSummary: () => ({
    isLoading: false,
    isError: false,
    data: {
      incomeCents: 100, expenseCents: 50, balanceCents: 50, previousMonth: "2026-10", byCategory: [],
      previous: { balanceCents: 0 },
      delta: { incomeCents: 0, incomePct: null, expenseCents: 0, expensePct: null },
    },
  }),
}));
vi.mock("../shared/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

describe("QuickAddSheet", () => {
  it("abre em Gasto só com categorias de gasto", async () => {
    render(<QuickAddSheet defaultDate="2026-11-11" initialType="expense" onClose={() => {}} />);
    expect(screen.getByText(/Mercado/)).toBeTruthy();
    expect(screen.queryByText(/Salário/)).toBeNull();
    await waitFor(() => expect(screen.getByLabelText("Valor")).toBe(document.activeElement));
  });

  it("abre em Ganho só com categorias de ganho e troca no topo", () => {
    render(<QuickAddSheet defaultDate="2026-11-11" initialType="income" onClose={() => {}} />);
    expect(screen.getByText(/Salário/)).toBeTruthy();
    expect(screen.queryByText(/Mercado/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Gasto" }));
    expect(screen.getByText(/Mercado/)).toBeTruthy();
    expect(screen.queryByText(/Salário/)).toBeNull();
  });

  it("data e forma de pagamento ficam fora de 'Mais opções'", () => {
    render(<QuickAddSheet defaultDate="2026-11-11" initialType="expense" onClose={() => {}} />);
    expect(screen.getByDisplayValue("2026-11-11")).toBeTruthy();
    expect(screen.getByText(/Mais opções \(descrição, recorrência\)/)).toBeTruthy();
    expect(screen.queryByText("Descrição")).toBeNull();
  });
});

describe("MonthTab", () => {
  it("tocar em Entradas/Saídas pede Ganho/Gasto", () => {
    const onAdd = vi.fn();
    render(<MonthTab month="2026-11" onAdd={onAdd} />);
    fireEvent.click(screen.getByLabelText("Adicionar ganho"));
    fireEvent.click(screen.getByLabelText("Adicionar gasto"));
    expect(onAdd.mock.calls).toEqual([["income"], ["expense"]]);
  });
});

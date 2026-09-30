import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import DueTodayPanel from "./DueTodayPanel";
import DailyRoutinePanel from "./DailyRoutinePanel";
import { todayISO, daysAgoISO } from "../lib/dateUtils";

/**
 * Smoke test do cenário que gerou o React #310: alternância entre render com
 * lista VAZIA e lista CHEIA (early return + hooks). Garante que os painéis não
 * quebram em nenhum dos casos.
 */

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

function mkTask(over: Record<string, unknown>) {
  return {
    id: String(Math.random()),
    title: "Tarefa",
    description: null,
    priority: 4,
    completed: false,
    due_date: null,
    due_time: null,
    recurrence: null,
    recurrence_rule: null,
    project_id: null,
    version: 0,
    checklist: [],
    checklist_count: 0,
    checklist_completed_count: 0,
    ...over,
  } as any;
}

const noop = vi.fn();
const asyncNoop = vi.fn().mockResolvedValue(undefined);

describe("DueTodayPanel — smoke (vazio/cheio)", () => {
  it("não quebra com lista vazia (retorna null)", () => {
    expect(() =>
      render(wrap(<DueTodayPanel tasks={[]} onComplete={noop} onUpdate={asyncNoop} />))
    ).not.toThrow();
  });

  it("não quebra com atrasadas + hoje + sem prazo", () => {
    const tasks = [
      mkTask({ title: "Atrasada", due_date: daysAgoISO(3) }),
      mkTask({ title: "Hoje", due_date: todayISO() }),
      mkTask({ title: "Sem prazo" }),
    ];
    expect(() =>
      render(wrap(<DueTodayPanel tasks={tasks} onComplete={noop} onUpdate={asyncNoop} />))
    ).not.toThrow();
  });
});

describe("DailyRoutinePanel — smoke (vazio/cheio)", () => {
  it("não quebra com lista vazia (retorna null)", () => {
    expect(() =>
      render(wrap(<DailyRoutinePanel tasks={[]} onComplete={noop} onReopen={noop} />))
    ).not.toThrow();
  });

  it("não quebra com rotinas diárias", () => {
    const tasks = [
      mkTask({ title: "Rotina 1", recurrence: "daily" }),
      mkTask({ title: "Rotina 2", recurrence: "daily", completed: true }),
    ];
    expect(() =>
      render(wrap(<DailyRoutinePanel tasks={tasks} onComplete={noop} onReopen={noop} />))
    ).not.toThrow();
  });
});

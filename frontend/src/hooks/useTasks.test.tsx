import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useTasks } from "./useTasks";
import { tasksApi } from "../api/tasks";

vi.mock("../api/tasks", () => ({
  tasksApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    complete: vi.fn(),
    countCompletedToday: vi.fn().mockResolvedValue(0),
    addChecklistItem: vi.fn(),
    toggleChecklistItem: vi.fn(),
    updateChecklistItem: vi.fn(),
    deleteChecklistItem: vi.fn(),
  },
}));

const mocked = tasksApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makeTask(over: Record<string, unknown> = {}) {
  return {
    id: "t1",
    title: "Tarefa",
    priority: 4,
    version: 0,
    checklist: [],
    checklist_count: 0,
    checklist_completed_count: 0,
    ...over,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function setup() {
  return renderHook(() => useTasks("active", "priority"), { wrapper });
}

describe("useTasks — updates otimistas e rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.countCompletedToday.mockResolvedValue(0);
  });

  it("cria tarefa aparecendo imediatamente (otimista) e confirma com o servidor", async () => {
    // Lista realista: o servidor só passa a devolver a tarefa após a criação,
    // como aconteceria de verdade (evita que o invalidate apague o otimista).
    const store: Array<Record<string, unknown>> = [];
    mocked.list.mockImplementation(async () => [...store]);
    mocked.create.mockImplementation(
      (data: Record<string, unknown>) =>
        new Promise((resolve) =>
          setTimeout(() => {
            const created = makeTask({ id: "real-1", title: data.title });
            store.unshift(created);
            resolve(created);
          }, 40)
        )
    );

    const { result } = setup();
    await waitFor(() => expect(result.current.tasks).toHaveLength(0));

    let promise!: Promise<unknown>;
    act(() => {
      promise = result.current.handleCreateTask({ title: "Nova" });
    });

    // Aparece antes da resposta do servidor (janela otimista).
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(result.current.tasks[0].title).toBe("Nova");

    await act(async () => { await promise; });
    await waitFor(() => expect(result.current.tasks[0].id).toBe("real-1"));
  });

  it("reverte a criação quando o servidor falha e expõe o erro", async () => {
    mocked.list.mockResolvedValue([]);
    mocked.create.mockRejectedValue(new Error("Falha de rede"));

    const { result } = setup();
    await waitFor(() => expect(result.current.tasks).toHaveLength(0));

    await act(async () => {
      await result.current.handleCreateTask({ title: "Nova" }).catch(() => {});
    });

    await waitFor(() => expect(result.current.mutationError).toBe("Falha de rede"));
    expect(result.current.tasks).toHaveLength(0);
  });

  it("reverte a edição de título quando o update falha", async () => {
    mocked.list.mockResolvedValue([makeTask({ title: "Original" })]);
    mocked.update.mockRejectedValue(new Error("Conflito"));

    const { result } = setup();
    await waitFor(() => expect(result.current.tasks[0].title).toBe("Original"));

    await act(async () => {
      await result.current.handleUpdateTask("t1", { title: "Editado" }).catch(() => {});
    });

    await waitFor(() => expect(result.current.mutationError).toBe("Conflito"));
    expect(result.current.tasks[0].title).toBe("Original");
  });

  it("envia a versão atual no update para detecção de conflito", async () => {
    mocked.list.mockResolvedValue([makeTask({ version: 3 })]);
    mocked.update.mockResolvedValue(makeTask({ version: 4, title: "Editado" }));

    const { result } = setup();
    await waitFor(() => expect(result.current.tasks[0].version).toBe(3));

    await act(async () => {
      await result.current.handleUpdateTask("t1", { title: "Editado" });
    });

    expect(mocked.update).toHaveBeenCalledWith("t1", { title: "Editado", version: 3 });
  });

  it("não reverte a tarefa recém-salva quando um refetch chega com versão antiga (keepNewer)", async () => {
    // O servidor "esquece" o update por um instante (leitura de réplica atrasada):
    // continua devolvendo a versão antiga na listagem logo após o PATCH.
    mocked.list.mockResolvedValue([makeTask({ version: 3, due_date: "2026-01-01" })]);
    mocked.update.mockResolvedValue(makeTask({ version: 4, due_date: "2026-02-02" }));

    const { result } = setup();
    await waitFor(() => expect(result.current.tasks[0].version).toBe(3));

    await act(async () => {
      await result.current.handleUpdateTask("t1", { due_date: "2026-02-02" });
    });

    // due_date afeta ordenação → o onSettled dispara um refetch da lista. Mesmo
    // que a lista volte com a versão 3 antiga, o cache mantém a 4 confirmada.
    await waitFor(() => expect(mocked.list.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(result.current.tasks[0].version).toBe(4);
    expect(result.current.tasks[0].due_date).toBe("2026-02-02");
  });

  it("reverte o toggle de subitem quando falha", async () => {
    const withItem = makeTask({
      checklist: [{ id: "c1", description: "Sub", completed: false, parent_id: null }],
      checklist_count: 1,
    });
    mocked.list.mockResolvedValue([withItem]);
    mocked.toggleChecklistItem.mockRejectedValue(new Error("Erro"));

    const { result } = setup();
    await waitFor(() => expect(result.current.tasks[0].checklist).toHaveLength(1));

    await act(async () => {
      await result.current.handleToggleTaskChecklist("t1", "c1").catch(() => {});
    });

    await waitFor(() =>
      expect(result.current.tasks[0].checklist[0].completed).toBe(false)
    );
  });

  it("permite tentar novamente depois de falha e confirma estado salvo", async () => {
    let stored = makeTask({ title: "Original", version: 2 });
    mocked.list.mockImplementation(async () => [stored]);
    mocked.update
      .mockRejectedValueOnce(new Error("Rede indisponível"))
      .mockImplementation(async (_id: string, data: Record<string, unknown>) => {
        stored = { ...stored, ...data, version: 3 };
        return stored;
      });

    const { result } = setup();
    await waitFor(() => expect(result.current.tasks[0].title).toBe("Original"));

    await act(async () => {
      await result.current.handleUpdateTask("t1", { title: "Novo" }).catch(() => {});
    });
    expect(result.current.tasks[0].title).toBe("Original");
    expect(result.current.syncState).toBe("error");

    await act(async () => { await result.current.retryLastMutation(); });

    await waitFor(() => expect(result.current.tasks[0].title).toBe("Novo"));
    expect(mocked.update).toHaveBeenCalledTimes(2);
    expect(result.current.syncState).toBe("saved");
  });

  it("mantém add, edição e exclusão de subitem coerentes sem reload", async () => {
    let stored = makeTask();
    mocked.list.mockImplementation(async () => [stored]);
    mocked.addChecklistItem.mockImplementation(async (_taskId: string, description: string) => {
      const item = { id: "c1", description, completed: false, parent_id: null };
      stored = { ...stored, checklist: [item], checklist_count: 1 };
      return item;
    });
    mocked.updateChecklistItem.mockImplementation(async (_taskId: string, _itemId: string, fields: Record<string, unknown>) => {
      const item = { ...stored.checklist[0], ...fields };
      stored = { ...stored, checklist: [item] };
      return item;
    });
    mocked.deleteChecklistItem.mockImplementation(async () => {
      stored = { ...stored, checklist: [], checklist_count: 0 };
      return null;
    });

    const { result } = setup();
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    await act(async () => { await result.current.handleAddTaskChecklist("t1", "Primeiro"); });
    await waitFor(() => expect(result.current.tasks[0].checklist[0].description).toBe("Primeiro"));

    await act(async () => { await result.current.handleUpdateTaskChecklist("t1", "c1", { description: "Editado" }); });
    expect(result.current.tasks[0].checklist[0].description).toBe("Editado");

    await act(async () => { await result.current.handleDeleteTaskChecklist("t1", "c1"); });
    await waitFor(() => expect(result.current.tasks[0].checklist).toHaveLength(0));
  });

  it("isola o cache por filtro, ordenação e projeto", async () => {
    mocked.list.mockResolvedValue([]);
    renderHook(() => useTasks("today", "due_date_asc", "project-1"), { wrapper });
    await waitFor(() => expect(mocked.list).toHaveBeenCalled());
    expect(mocked.list).toHaveBeenCalledWith({
      status: "today",
      sort: "due_date_asc",
      projectId: "project-1",
    });
  });
});

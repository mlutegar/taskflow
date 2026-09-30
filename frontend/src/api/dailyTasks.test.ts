import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do cliente HTTP para inspecionar os paths chamados.
// vi.hoisted: as fns precisam existir antes do vi.mock (que é içado ao topo).
const { get, post, del, put } = vi.hoisted(() => ({
  get: vi.fn(() => Promise.resolve([])),
  post: vi.fn(() => Promise.resolve({ ok: true })),
  del: vi.fn(() => Promise.resolve(null)),
  put: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("../lib/apiClient", () => ({
  api: { get, post, delete: del, put },
}));

import { dailyTasksApi } from "./dailyTasks";
import { todayISO } from "../lib/dateUtils";

describe("dailyTasksApi — data LOCAL (regressão do bug de fuso)", () => {
  beforeEach(() => {
    get.mockClear(); post.mockClear(); del.mockClear(); put.mockClear();
  });

  it("load usa a data LOCAL (todayISO), nunca UTC (toISOString)", () => {
    dailyTasksApi.load();
    expect(get).toHaveBeenCalledWith(`/daily-tasks/${todayISO()}`);
    // Trava: não pode voltar a usar o dia UTC do toISOString.
    const utcDay = new Date().toISOString().split("T")[0];
    const localDay = todayISO();
    // Só é um teste real de fuso quando os dois divergem; quando iguais,
    // ainda garantimos que o path bate com todayISO().
    if (utcDay !== localDay) {
      expect(get).not.toHaveBeenCalledWith(`/daily-tasks/${utcDay}`);
    }
  });

  it("add e remove usam a mesma data LOCAL", () => {
    dailyTasksApi.add("t1");
    dailyTasksApi.remove("t1");
    expect(post).toHaveBeenCalledWith(`/daily-tasks/${todayISO()}/t1`);
    expect(del).toHaveBeenCalledWith(`/daily-tasks/${todayISO()}/t1`);
  });

  it("reorder envia os taskIds como strings para a data local", () => {
    dailyTasksApi.reorder(["a", 2, "c"]);
    expect(put).toHaveBeenCalledWith(`/daily-tasks/${todayISO()}/reorder`, { taskIds: ["a", "2", "c"] });
  });
});

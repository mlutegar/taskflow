import { describe, expect, it, vi } from "vitest";
import { subscribeToTaskChanges } from "./taskSync";
import { taskKeys } from "./taskKeys";

describe("sincronização de tarefas", () => {
  it("mantém chaves distintas por visão", () => {
    expect(taskKeys.list("today", "due_date_asc", "p1")).toEqual([
      "tasks", "list", "today", "due_date_asc", "p1",
      "all-times", "all-assigned", "all-priorities", "all-due",
    ]);
    expect(taskKeys.list("today", "due_date_asc", "p1", "lt30")).toEqual([
      "tasks", "list", "today", "due_date_asc", "p1",
      "lt30", "all-assigned", "all-priorities", "all-due",
    ]);
    // Padrões preenchem dimensões ausentes para manter listas isoladas.
    expect(taskKeys.list()).toEqual([
      "tasks", "list", "all", "default", "all-projects",
      "all-times", "all-assigned", "all-priorities", "all-due",
    ]);
    expect(taskKeys.completedToday()).toEqual(["tasks", "completed-today"]);
  });

  /**
   * Estas duas views vivem FORA de `lists()`. Se alguém mudar isso sem ajustar
   * as invalidações em `useTasks`, a tarefa criada volta a só aparecer após
   * reload — que foi exatamente o bug corrigido.
   */
  it("views de painel ficam fora de lists() e têm chave própria", () => {
    expect(taskKeys.todayPanelAll()).toEqual(["tasks", "today-panel-all"]);
    expect(taskKeys.routineConsistency()).toEqual(["tasks", "routine-consistency"]);

    const lists = taskKeys.lists().join("|");
    expect(taskKeys.todayPanelAll().join("|").startsWith(lists)).toBe(false);
    expect(taskKeys.routineConsistency().join("|").startsWith(lists)).toBe(false);
  });

  it("reage a alterações vindas de outra aba via storage", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToTaskChanges(onChange);

    window.dispatchEvent(new StorageEvent("storage", {
      key: "taskflow.tasksChangedAt",
      newValue: JSON.stringify({ type: "tasks-changed", sourceId: "outra-aba", at: Date.now() }),
    }));

    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

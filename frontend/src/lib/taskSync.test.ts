import { describe, expect, it, vi } from "vitest";
import { subscribeToTaskChanges } from "./taskSync";
import { taskKeys } from "./taskKeys";

describe("sincronização de tarefas", () => {
  it("mantém chaves distintas por visão", () => {
    expect(taskKeys.list("today", "due_date_asc", "p1")).toEqual([
      "tasks", "list", "today", "due_date_asc", "p1", "all-times",
    ]);
    expect(taskKeys.list("today", "due_date_asc", "p1", "lt30")).toEqual([
      "tasks", "list", "today", "due_date_asc", "p1", "lt30",
    ]);
    // Padrões preenchem dimensões ausentes para manter listas isoladas.
    expect(taskKeys.list()).toEqual([
      "tasks", "list", "all", "default", "all-projects", "all-times",
    ]);
    expect(taskKeys.completedToday()).toEqual(["tasks", "completed-today"]);
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

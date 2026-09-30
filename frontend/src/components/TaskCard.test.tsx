import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TaskCard from "./TaskCard";

const handlers = {
  onComplete: vi.fn(),
  onReopen: vi.fn(),
  onDelete: vi.fn(),
  onUpdate: vi.fn().mockResolvedValue(undefined),
  onAddChecklist: vi.fn().mockResolvedValue(undefined),
  onToggleChecklist: vi.fn(),
  onUpdateChecklist: vi.fn().mockResolvedValue(undefined),
  onDeleteChecklist: vi.fn(),
};

function task(title: string, checklist: Array<Record<string, unknown>> = []) {
  return {
    id: "task-1",
    title,
    description: null,
    priority: 4,
    due_date: null,
    recurrence: null,
    completed: false,
    checklist,
    checklist_count: checklist.length,
    checklist_completed_count: 0,
  };
}

describe("TaskCard", () => {
  it("renderiza novamente quando a tarefa muda sem timestamps", () => {
    const { rerender } = render(<TaskCard task={task("Título antigo")} {...handlers} />);

    rerender(<TaskCard task={task("Título atualizado")} {...handlers} />);

    expect(screen.getByText("Título atualizado")).toBeInTheDocument();
    expect(screen.queryByText("Título antigo")).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoDelete } from './useUndoDelete';

describe('useUndoDelete', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with undoTask null', () => {
    const onConfirmDelete = vi.fn();
    const { result } = renderHook(() => useUndoDelete(onConfirmDelete));

    expect(result.current.undoTask).toBeNull();
  });

  it('sets undoTask when handleDeleteTask is called', () => {
    const onConfirmDelete = vi.fn();
    const { result } = renderHook(() => useUndoDelete(onConfirmDelete));
    const task = { id: 'task-1', title: 'Test task' };

    act(() => {
      result.current.handleDeleteTask(task);
    });

    expect(result.current.undoTask).not.toBeNull();
    expect(result.current.undoTask.task).toEqual(task);
    expect(result.current.undoTask.expiresAt).toBeGreaterThan(Date.now());
  });

  it('calls onConfirmDelete after 5s timeout without undo', () => {
    const onConfirmDelete = vi.fn();
    const { result } = renderHook(() => useUndoDelete(onConfirmDelete));
    const task = { id: 'task-1', title: 'Test task' };

    act(() => {
      result.current.handleDeleteTask(task);
    });

    expect(onConfirmDelete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onConfirmDelete).toHaveBeenCalledOnce();
    expect(onConfirmDelete).toHaveBeenCalledWith('task-1');
    expect(result.current.undoTask).toBeNull();
  });

  it('does NOT call onConfirmDelete when undo is triggered before timeout', () => {
    const onConfirmDelete = vi.fn();
    const { result } = renderHook(() => useUndoDelete(onConfirmDelete));
    const task = { id: 'task-2', title: 'Undo me' };

    act(() => {
      result.current.handleDeleteTask(task);
    });

    act(() => {
      vi.advanceTimersByTime(2000); // still within the 5s window
    });

    act(() => {
      result.current.handleUndoDelete();
    });

    // Advance past the original timeout
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(onConfirmDelete).not.toHaveBeenCalled();
    expect(result.current.undoTask).toBeNull();
  });

  it('handleUndoDelete returns the original task', () => {
    const onConfirmDelete = vi.fn();
    const { result } = renderHook(() => useUndoDelete(onConfirmDelete));
    const task = { id: 'task-3', title: 'Return me' };

    act(() => {
      result.current.handleDeleteTask(task);
    });

    let returned;
    act(() => {
      returned = result.current.handleUndoDelete();
    });

    expect(returned).toEqual(task);
  });

  it('handleDismiss immediately commits the delete without waiting for timeout', () => {
    const onConfirmDelete = vi.fn();
    const { result } = renderHook(() => useUndoDelete(onConfirmDelete));
    const task = { id: 'task-4', title: 'Dismiss me' };

    act(() => {
      result.current.handleDeleteTask(task);
    });

    act(() => {
      result.current.handleDismiss();
    });

    expect(onConfirmDelete).toHaveBeenCalledOnce();
    expect(onConfirmDelete).toHaveBeenCalledWith('task-4');
    expect(result.current.undoTask).toBeNull();

    // Confirm timeout does NOT fire a second call
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onConfirmDelete).toHaveBeenCalledOnce();
  });

  it('committing a second delete before undo flushes the first immediately', () => {
    const onConfirmDelete = vi.fn();
    const { result } = renderHook(() => useUndoDelete(onConfirmDelete));
    const task1 = { id: 'task-5', title: 'First' };
    const task2 = { id: 'task-6', title: 'Second' };

    act(() => {
      result.current.handleDeleteTask(task1);
    });

    act(() => {
      result.current.handleDeleteTask(task2);
    });

    // task1 should have been committed immediately
    expect(onConfirmDelete).toHaveBeenCalledOnce();
    expect(onConfirmDelete).toHaveBeenCalledWith('task-5');

    // undoTask is now for task2
    expect(result.current.undoTask.task).toEqual(task2);

    // Let task2 timeout fire
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onConfirmDelete).toHaveBeenCalledTimes(2);
    expect(onConfirmDelete).toHaveBeenLastCalledWith('task-6');
  });

  it('handleUndoDelete is a no-op when no pending delete exists', () => {
    const onConfirmDelete = vi.fn();
    const { result } = renderHook(() => useUndoDelete(onConfirmDelete));

    let returned;
    act(() => {
      returned = result.current.handleUndoDelete();
    });

    expect(returned).toBeUndefined();
    expect(onConfirmDelete).not.toHaveBeenCalled();
  });
});

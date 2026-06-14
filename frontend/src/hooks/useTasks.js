import { useState, useEffect, useCallback } from "react";
import { tasksApi } from "../api/tasks";

export function useTasks(taskFilter, taskSort) {
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(null);
  const [completedToday, setCompletedToday] = useState(0);

  const refreshCompletedToday = useCallback(async () => {
    try { setCompletedToday(await tasksApi.countCompletedToday()); } catch {}
  }, []);

  useEffect(() => { refreshCompletedToday(); }, [refreshCompletedToday]);

  const fetchTasks = useCallback(async () => {
    try {
      setTasksError(null);
      const params = {};
      if (taskFilter) params.status = taskFilter;
      if (taskSort) params.sort = taskSort;
      let data = await tasksApi.list(params);
      if (taskSort === "overdue") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        data = [...data].sort((a, b) => {
          const aOverdue = a.due_date && new Date(a.due_date) < today;
          const bOverdue = b.due_date && new Date(b.due_date) < today;
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          if (!a.due_date && !b.due_date) return (a.priority ?? 99) - (b.priority ?? 99);
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        });
      }
      setTasks(data);
    } catch (e) {
      setTasksError(e.message);
    } finally {
      setTasksLoading(false);
    }
  }, [taskFilter, taskSort]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreateTask = async (data) => {
    const task = await tasksApi.create(data);
    setTasks((prev) => [task, ...prev]);
  };

  const handleCompleteTask = async (id) => {
    const currentTask = tasks.find((t) => t.id === id);
    const task = await tasksApi.complete(id, currentTask);
    setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
    refreshCompletedToday();
  };

  const handleReopenTask = async (id) => {
    const task = await tasksApi.reopen(id);
    setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
    refreshCompletedToday();
  };

  const handleUpdateTask = async (id, data) => {
    const task = await tasksApi.update(id, data);
    setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
  };

  const handleAddTaskChecklist = async (taskId, description, parentId = null) => {
    const item = await tasksApi.addChecklistItem(taskId, description, parentId);
    setTasks((prev) => prev.map((t) =>
      t.id === taskId ? { ...t, checklist: [...t.checklist, item], checklist_count: t.checklist_count + 1 } : t
    ));
  };

  const handleToggleTaskChecklist = async (taskId, itemId) => {
    const item = await tasksApi.toggleChecklistItem(taskId, itemId);
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const newChecklist = t.checklist.map((c) => (c.id === itemId ? item : c));
      return { ...t, checklist: newChecklist, checklist_completed_count: newChecklist.filter((c) => c.completed).length };
    }));
  };

  const handleUpdateTaskChecklist = async (taskId, itemId, fields) => {
    const item = await tasksApi.updateChecklistItem(taskId, itemId, fields);
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const newChecklist = t.checklist.map((c) => (c.id === itemId ? item : c));
      return { ...t, checklist: newChecklist };
    }));
  };

  const handleDeleteTaskChecklist = async (taskId, itemId) => {
    await tasksApi.deleteChecklistItem(taskId, itemId);
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const toRemove = new Set([itemId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const c of t.checklist) {
          if (c.parent_id != null && toRemove.has(c.parent_id) && !toRemove.has(c.id)) {
            toRemove.add(c.id);
            changed = true;
          }
        }
      }
      const newChecklist = t.checklist.filter((c) => !toRemove.has(c.id));
      return {
        ...t,
        checklist: newChecklist,
        checklist_count: newChecklist.length,
        checklist_completed_count: newChecklist.filter((c) => c.completed).length,
      };
    }));
  };

  return {
    tasks,
    setTasks,
    tasksLoading,
    tasksError,
    completedToday,
    handleCreateTask,
    handleCompleteTask,
    handleReopenTask,
    handleUpdateTask,
    handleAddTaskChecklist,
    handleToggleTaskChecklist,
    handleUpdateTaskChecklist,
    handleDeleteTaskChecklist,
  };
}

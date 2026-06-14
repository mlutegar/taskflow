import { useState, useEffect, useCallback } from "react";
import { routinesApi } from "../api/routines";

export function useRoutines(routineFilter) {
  const [routines, setRoutines] = useState([]);
  const [routinesLoading, setRoutinesLoading] = useState(true);
  const [routinesError, setRoutinesError] = useState(null);

  const fetchRoutines = useCallback(async () => {
    try {
      setRoutinesError(null);
      const params = {};
      if (routineFilter) params.status = routineFilter;
      setRoutines(await routinesApi.list(params));
    } catch (e) {
      setRoutinesError(e.message);
    } finally {
      setRoutinesLoading(false);
    }
  }, [routineFilter]);

  useEffect(() => { fetchRoutines(); }, [fetchRoutines]);

  const handleCreateRoutine = async (data) => {
    const routine = await routinesApi.create(data);
    setRoutines((prev) => [...prev, routine]);
  };

  const handleCompleteRoutine = async (id) => {
    const routine = await routinesApi.complete(id);
    setRoutines((prev) => prev.map((r) => (r.id === id ? routine : r)));
  };

  const handleUncompleteRoutine = async (id) => {
    const routine = await routinesApi.uncomplete(id);
    setRoutines((prev) => prev.map((r) => (r.id === id ? routine : r)));
  };

  const handleDeleteRoutine = async (id) => {
    await routinesApi.delete(id);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRoutine = async (id, data) => {
    const routine = await routinesApi.update(id, data);
    setRoutines((prev) => prev.map((r) => (r.id === id ? routine : r)));
  };

  const handleCompleteRoutineForDate = async (id, dateStr) => {
    const routine = await routinesApi.completeForDate(id, dateStr);
    setRoutines((prev) => prev.map((r) => (r.id === id ? routine : r)));
  };

  const handleAddProgress = async (id, amount) => {
    const routine = await routinesApi.addProgress(id, amount);
    setRoutines((prev) => prev.map((r) => (r.id === id ? routine : r)));
  };

  const handleAddRoutineChecklist = async (routineId, description) => {
    const item = await routinesApi.addChecklistItem(routineId, description);
    setRoutines((prev) => prev.map((r) =>
      r.id === routineId ? { ...r, checklist: [...r.checklist, item], checklist_count: r.checklist_count + 1 } : r
    ));
  };

  const handleToggleRoutineChecklist = async (routineId, itemId) => {
    const item = await routinesApi.toggleChecklistItem(routineId, itemId);
    setRoutines((prev) => prev.map((r) => {
      if (r.id !== routineId) return r;
      const newChecklist = r.checklist.map((c) => (c.id === itemId ? item : c));
      return { ...r, checklist: newChecklist, checklist_completed_count: newChecklist.filter((c) => c.completed).length };
    }));
    fetchRoutines();
  };

  const handleDeleteRoutineChecklist = async (routineId, itemId) => {
    await routinesApi.deleteChecklistItem(routineId, itemId);
    setRoutines((prev) => prev.map((r) => {
      if (r.id !== routineId) return r;
      const newChecklist = r.checklist.filter((c) => c.id !== itemId);
      return { ...r, checklist: newChecklist, checklist_count: newChecklist.length };
    }));
  };

  return {
    routines,
    routinesLoading,
    routinesError,
    handleCreateRoutine,
    handleCompleteRoutine,
    handleUncompleteRoutine,
    handleDeleteRoutine,
    handleUpdateRoutine,
    handleCompleteRoutineForDate,
    handleAddProgress,
    handleAddRoutineChecklist,
    handleToggleRoutineChecklist,
    handleDeleteRoutineChecklist,
  };
}

import { supabase } from "../lib/supabase";

const TODAY = () => new Date().toISOString().split("T")[0];

function shapeRoutine(routine) {
  const checklist = (routine.checklist ?? []).sort((a, b) => a.order - b.order || a.id - b.id);
  const isCompletedToday = routine.last_completed_date === TODAY();
  const progressPercentage =
    routine.target_value
      ? Math.min(100, (routine.current_progress / routine.target_value) * 100)
      : null;
  return {
    ...routine,
    checklist,
    checklist_count: checklist.length,
    checklist_completed_count: checklist.filter((c) => c.completed).length,
    is_completed_today: isCompletedToday,
    progress_percentage: progressPercentage,
  };
}

function throwIfError(error) {
  if (error) throw new Error(error.message);
}

async function fetchRoutine(id) {
  const { data, error } = await supabase
    .from("routines")
    .select("*, checklist:routine_checklist_items(*)")
    .eq("id", id)
    .single();
  throwIfError(error);
  return data;
}

async function ensureDailyReset(routine) {
  const today = TODAY();
  if (routine.last_completed_date && routine.last_completed_date < today) {
    const updates = [];
    if (routine.current_progress > 0) {
      updates.push(
        supabase.from("routines").update({ current_progress: 0 }).eq("id", routine.id)
      );
      routine.current_progress = 0;
    }
    updates.push(
      supabase
        .from("routine_checklist_items")
        .update({ completed: false })
        .eq("routine_id", routine.id)
        .eq("completed", true)
    );
    await Promise.all(updates);
    if (routine.checklist) {
      routine.checklist = routine.checklist.map((c) => ({ ...c, completed: false }));
    }
  }
  return routine;
}

export const routinesApi = {
  list: async (params = {}) => {
    const { data, error } = await supabase
      .from("routines")
      .select("*, checklist:routine_checklist_items(*)")
      .order("title");
    throwIfError(error);

    const routines = await Promise.all(data.map(ensureDailyReset));
    const shaped = routines.map(shapeRoutine);

    if (params.status === "pending") return shaped.filter((r) => !r.is_completed_today);
    if (params.status === "done") return shaped.filter((r) => r.is_completed_today);
    return shaped;
  },

  create: async (data) => {
    const { data: routine, error } = await supabase
      .from("routines")
      .insert(data)
      .select("*, checklist:routine_checklist_items(*)")
      .single();
    throwIfError(error);
    return shapeRoutine(routine);
  },

  update: async (id, data) => {
    const { data: routine, error } = await supabase
      .from("routines")
      .update(data)
      .eq("id", id)
      .select("*, checklist:routine_checklist_items(*)")
      .single();
    throwIfError(error);
    return shapeRoutine(routine);
  },

  delete: async (id) => {
    const { error } = await supabase.from("routines").delete().eq("id", id);
    throwIfError(error);
    return null;
  },

  complete: async (id) => {
    const today = TODAY();
    const routine = await fetchRoutine(id);
    const history = Array.from(new Set([...routine.completion_history, today]));
    const updates = {
      last_completed_date: today,
      completion_history: history,
      ...(routine.target_value ? { current_progress: routine.target_value } : {}),
    };
    await supabase.from("routine_checklist_items").update({ completed: true }).eq("routine_id", id);
    return routinesApi.update(id, updates);
  },

  uncomplete: async (id) => {
    const today = TODAY();
    const routine = await fetchRoutine(id);
    const history = routine.completion_history.filter((d) => d !== today);
    const lastDate = history.length > 0 ? history[history.length - 1] : null;
    const updates = {
      last_completed_date: lastDate,
      completion_history: history,
      ...(routine.target_value ? { current_progress: 0 } : {}),
    };
    await supabase.from("routine_checklist_items").update({ completed: false }).eq("routine_id", id);
    return routinesApi.update(id, updates);
  },

  completeForDate: async (id, dateStr) => {
    const today = TODAY();
    if (dateStr > today) throw new Error("Não é possível marcar como feita para uma data futura");
    const routine = await fetchRoutine(id);
    const history = Array.from(new Set([...routine.completion_history, dateStr])).sort();
    const lastDate =
      routine.last_completed_date == null || dateStr > routine.last_completed_date
        ? dateStr
        : routine.last_completed_date;
    return routinesApi.update(id, { completion_history: history, last_completed_date: lastDate });
  },

  addProgress: async (id, amount) => {
    const today = TODAY();
    const routine = await fetchRoutine(id);
    await ensureDailyReset(routine);
    if (!routine.target_value) throw new Error("Rotina não tem valor alvo");

    const newProgress = Math.min(routine.target_value, routine.current_progress + amount);
    const updates = { current_progress: newProgress };

    if (newProgress >= routine.target_value) {
      const history = Array.from(new Set([...routine.completion_history, today]));
      updates.last_completed_date = today;
      updates.completion_history = history;
    }

    return routinesApi.update(id, updates);
  },

  addChecklistItem: async (routineId, description) => {
    const { data: existing } = await supabase
      .from("routine_checklist_items")
      .select("id")
      .eq("routine_id", routineId);
    const order = existing?.length ?? 0;

    const { data, error } = await supabase
      .from("routine_checklist_items")
      .insert({ routine_id: routineId, description, order })
      .select()
      .single();
    throwIfError(error);
    return data;
  },

  toggleChecklistItem: async (routineId, itemId) => {
    const { data: current, error: fetchError } = await supabase
      .from("routine_checklist_items")
      .select("completed")
      .eq("id", itemId)
      .single();
    throwIfError(fetchError);

    const newCompleted = !current.completed;
    const { data, error } = await supabase
      .from("routine_checklist_items")
      .update({ completed: newCompleted })
      .eq("id", itemId)
      .select()
      .single();
    throwIfError(error);

    // Auto-complete a rotina se todos os itens foram marcados
    if (newCompleted) {
      const { data: allItems } = await supabase
        .from("routine_checklist_items")
        .select("completed")
        .eq("routine_id", routineId);
      if (allItems?.length > 0 && allItems.every((i) => i.completed)) {
        const today = TODAY();
        const routine = await fetchRoutine(routineId);
        if (routine.last_completed_date !== today) {
          const history = Array.from(new Set([...routine.completion_history, today]));
          await supabase
            .from("routines")
            .update({ last_completed_date: today, completion_history: history })
            .eq("id", routineId);
        }
      }
    }

    return data;
  },

  deleteChecklistItem: async (_routineId, itemId) => {
    const { error } = await supabase.from("routine_checklist_items").delete().eq("id", itemId);
    throwIfError(error);
    return null;
  },
};

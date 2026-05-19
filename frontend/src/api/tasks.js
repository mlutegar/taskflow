import { supabase } from "../lib/supabase";

function shapeTask(task) {
  const checklist = (task.checklist ?? []).sort((a, b) => a.order - b.order || a.id - b.id);
  return {
    ...task,
    checklist,
    checklist_count: checklist.length,
    checklist_completed_count: checklist.filter((c) => c.completed).length,
  };
}

function throwIfError(error) {
  if (error) throw new Error(error.message);
}

export const tasksApi = {
  list: async (params = {}) => {
    let query = supabase.from("tasks").select("*, checklist:checklist_items(*)");

    if (params.status === "active") query = query.eq("completed", false);
    else if (params.status === "completed") query = query.eq("completed", true);

    if (params.sort === "due_date") {
      query = query.order("due_date", { nullsFirst: false }).order("priority");
    } else if (params.sort === "created") {
      query = query.order("created_at", { ascending: false });
    } else {
      query = query.order("priority").order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    throwIfError(error);
    return data.map(shapeTask);
  },

  create: async (data) => {
    const { data: task, error } = await supabase
      .from("tasks")
      .insert(data)
      .select("*, checklist:checklist_items(*)")
      .single();
    throwIfError(error);
    return shapeTask(task);
  },

  update: async (id, data) => {
    const { data: task, error } = await supabase
      .from("tasks")
      .update(data)
      .eq("id", id)
      .select("*, checklist:checklist_items(*)")
      .single();
    throwIfError(error);
    return shapeTask(task);
  },

  delete: async (id) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    throwIfError(error);
    return null;
  },

  complete: (id) => tasksApi.update(id, { completed: true }),

  reopen: (id) => tasksApi.update(id, { completed: false }),

  addChecklistItem: async (taskId, description) => {
    const { data: existing } = await supabase
      .from("checklist_items")
      .select("id")
      .eq("task_id", taskId);
    const order = existing?.length ?? 0;

    const { data, error } = await supabase
      .from("checklist_items")
      .insert({ task_id: taskId, description, order })
      .select()
      .single();
    throwIfError(error);
    return data;
  },

  toggleChecklistItem: async (_taskId, itemId) => {
    const { data: current, error: fetchError } = await supabase
      .from("checklist_items")
      .select("completed")
      .eq("id", itemId)
      .single();
    throwIfError(fetchError);

    const { data, error } = await supabase
      .from("checklist_items")
      .update({ completed: !current.completed })
      .eq("id", itemId)
      .select()
      .single();
    throwIfError(error);
    return data;
  },

  deleteChecklistItem: async (_taskId, itemId) => {
    const { error } = await supabase.from("checklist_items").delete().eq("id", itemId);
    throwIfError(error);
    return null;
  },
};

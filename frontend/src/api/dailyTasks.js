import { supabase } from "../lib/supabase";

function throwIfError(error) {
  if (error) throw new Error(error.message);
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

export const dailyTasksApi = {
  /** Retorna os task_ids selecionados para uma data (padrão: hoje), em ordem de posição. */
  load: async (date = todayDate()) => {
    const { data, error } = await supabase
      .from("daily_tasks")
      .select("task_id, position")
      .eq("date", date)
      .order("position", { ascending: true });
    throwIfError(error);
    return (data ?? []).map((r) => r.task_id);
  },

  /** Adiciona uma tarefa ao dia. Usa a próxima posição disponível. */
  add: async (taskId, date = todayDate()) => {
    // busca a maior posição atual para o dia
    const { data: existing } = await supabase
      .from("daily_tasks")
      .select("position")
      .eq("date", date)
      .order("position", { ascending: false })
      .limit(1);
    const position = existing?.length ? existing[0].position + 1 : 0;

    const { error } = await supabase
      .from("daily_tasks")
      .insert({ date, task_id: taskId, position })
      .select()
      .single();
    // ignora conflito de unique (tarefa já estava no dia)
    if (error && !error.message.includes("unique")) throwIfError(error);
  },

  /** Remove uma tarefa do dia. */
  remove: async (taskId, date = todayDate()) => {
    const { error } = await supabase
      .from("daily_tasks")
      .delete()
      .eq("date", date)
      .eq("task_id", taskId);
    throwIfError(error);
  },
};

import { supabase } from "../lib/supabase";

export const modeStatsApi = {
  // Retorna { [modeId]: count }
  list: async () => {
    const { data, error } = await supabase
      .from("mode_stats")
      .select("mode_id, task_count");
    if (error) throw new Error(error.message);
    return Object.fromEntries((data ?? []).map((r) => [r.mode_id, r.task_count]));
  },

  // Incrementa +1 de forma atômica via RPC e retorna o novo total
  increment: async (modeId) => {
    const { data, error } = await supabase.rpc("increment_mode_stat", {
      p_mode_id: modeId,
    });
    if (error) throw new Error(error.message);
    return data; // novo task_count
  },
};

export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (
    filter?: string,
    sort?: string,
    projectId?: string,
    time?: string,
    assignedTo?: string,
    priorities?: string,
    dueFilter?: string
  ) =>
    [
      ...taskKeys.lists(),
      filter || "all",
      sort || "default",
      projectId || "all-projects",
      time || "all-times",
      assignedTo || "all-assigned",
      priorities || "all-priorities",
      dueFilter || "all-due",
    ] as const,
  completedToday: () => [...taskKeys.all, "completed-today"] as const,
  /**
   * Lista completa que alimenta os painéis da aba Tarefas (Rotina Diária,
   * Hoje & Atrasadas, modal de detalhes). Fica FORA de `lists()`, então toda
   * mutação que cria/remove tarefa precisa invalidar esta chave também — senão
   * a tarefa nova só aparece depois de um reload.
   */
  todayPanelAll: () => [...taskKeys.all, "today-panel-all"] as const,
  /** Heatmap de consistência das rotinas (prefixo; a chave completa leva from/to). */
  routineConsistency: () => [...taskKeys.all, "routine-consistency"] as const,
  mutations: () => [...taskKeys.all, "mutation"] as const,
  mutation: (name: string) => [...taskKeys.mutations(), name] as const,
};

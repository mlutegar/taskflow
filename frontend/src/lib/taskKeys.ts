export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (filter?: string, sort?: string, projectId?: string, time?: string) =>
    [...taskKeys.lists(), filter || "all", sort || "default", projectId || "all-projects", time || "all-times"] as const,
  completedToday: () => [...taskKeys.all, "completed-today"] as const,
  mutations: () => [...taskKeys.all, "mutation"] as const,
  mutation: (name: string) => [...taskKeys.mutations(), name] as const,
};

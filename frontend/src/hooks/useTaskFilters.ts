import { useState, useEffect, useMemo, useCallback } from "react";

export interface TaskFilters {
  assignedTo: "me" | "none" | null;
  projectIds: string[];
  priorities: number[];
  timeEstimate: "fast" | "medium" | "long" | "none" | null;
  dueFilter: "overdue" | "today" | "this_week" | "no_date" | null;
}

const DEFAULT_FILTERS: TaskFilters = {
  assignedTo: null,
  projectIds: [],
  priorities: [],
  timeEstimate: null,
  dueFilter: null,
};

export function useTaskFilters() {
  const [filters, setFilters] = useState<TaskFilters>(() => {
    // 1. Tentar carregar da URL
    const params = new URLSearchParams(window.location.search);
    if (
      params.has("assigned") ||
      params.has("projects") ||
      params.has("priorities") ||
      params.has("time") ||
      params.has("due")
    ) {
      return {
        assignedTo: (params.get("assigned") as any) || null,
        projectIds: params.get("projects")?.split(",").filter(Boolean) || [],
        priorities: params.get("priorities")?.split(",").map(Number).filter(Boolean) || [],
        timeEstimate: (params.get("time") as any) || null,
        dueFilter: (params.get("due") as any) || null,
      };
    }

    // 2. Tentar carregar do localStorage
    try {
      const userId = localStorage.getItem("taskflow.userId");
      if (userId) {
        const stored = localStorage.getItem(`taskflow.filters.${userId}`);
        if (stored) return JSON.parse(stored);
      }
    } catch {}

    // 3. Default
    return DEFAULT_FILTERS;
  });

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (filters.assignedTo) params.set("assigned", filters.assignedTo);
    else params.delete("assigned");

    if (filters.projectIds.length) params.set("projects", filters.projectIds.join(","));
    else params.delete("projects");

    if (filters.priorities.length) params.set("priorities", filters.priorities.join(","));
    else params.delete("priorities");

    if (filters.timeEstimate) params.set("time", filters.timeEstimate);
    else params.delete("time");

    if (filters.dueFilter) params.set("due", filters.dueFilter);
    else params.delete("due");

    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }, [filters]);

  // Sync localStorage (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const userId = localStorage.getItem("taskflow.userId");
        if (userId) {
          localStorage.setItem(`taskflow.filters.${userId}`, JSON.stringify(filters));
        }
      } catch {}
    }, 500);
    return () => clearTimeout(timeout);
  }, [filters]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.assignedTo) count++;
    count += filters.projectIds.length;
    count += filters.priorities.length;
    if (filters.timeEstimate) count++;
    if (filters.dueFilter) count++;
    return count;
  }, [filters]);

  const clearAll = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const removeFilter = useCallback((key: keyof TaskFilters, value?: any) => {
    setFilters((prev) => {
      if (key === "projectIds") {
        return { ...prev, projectIds: prev.projectIds.filter((id) => id !== value) };
      } else if (key === "priorities") {
        return { ...prev, priorities: prev.priorities.filter((p) => p !== value) };
      } else {
        return { ...prev, [key]: null };
      }
    });
  }, []);

  // Converte filtros para parâmetros da API
  const toAPIParams = useCallback(() => {
    return {
      assignedTo: filters.assignedTo || undefined,
      priorities: filters.priorities.length ? filters.priorities.join(",") : undefined,
      dueFilter: filters.dueFilter || undefined,
      time: filters.timeEstimate || undefined,
      projectId: filters.projectIds[0] || undefined, // Por enquanto apenas 1 projeto (TODO: multi)
    };
  }, [filters]);

  return {
    filters,
    setFilters,
    activeCount,
    clearAll,
    removeFilter,
    toAPIParams,
  };
}

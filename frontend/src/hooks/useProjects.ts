import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectInput, projectsApi } from "../api/projects";

export function useProjects(includeArchived = false) {
  const queryClient = useQueryClient();
  const queryKey = ["projects", includeArchived];
  const query = useQuery({ queryKey, queryFn: () => projectsApi.list(includeArchived) });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };
  const create = useMutation({ mutationFn: (data: ProjectInput) => projectsApi.create(data), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<ProjectInput> }) => projectsApi.update(id, data), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => projectsApi.delete(id), onSuccess: refresh });
  return {
    projects: query.data || [],
    loading: query.isLoading,
    error: (query.error as Error | null)?.message || null,
    createProject: create.mutateAsync,
    updateProject: (id: string, data: Partial<ProjectInput>) => update.mutateAsync({ id, data }),
    deleteProject: remove.mutateAsync,
  };
}

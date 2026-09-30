import { api } from "../lib/apiClient";

export interface OrbitaFolder {
  path: string;
  name: string;
  recent?: boolean;
}

export interface OrbitaLaunchResult {
  ok: boolean;
  key: string;
  openUrl: string;
  reused: boolean;
  provider: string;
}

export interface OrbitaLaunchInput {
  taskId?: string;
  path?: string;
  prompt: string;
  provider?: string;
  reuseKey?: string;
}

export const orbitaApi = {
  /** Lista as pastas/projetos do Órbita (Claude Web). */
  listProjects: async (): Promise<OrbitaFolder[]> => {
    const data = (await api.get("/orbita/projects")) as { folders?: OrbitaFolder[] };
    return data?.folders ?? [];
  },

  /**
   * Abre (ou reusa) uma aba no Órbita e envia o prompt automaticamente.
   * Passe `reuseKey` para continuar a mesma conversa em vez de abrir nova aba.
   */
  launch: (input: OrbitaLaunchInput) =>
    api.post("/orbita/launch", input, { timeoutMs: 15000 }) as Promise<OrbitaLaunchResult>,
};

export interface PreferencesShape {
  orbitaPromptTemplate?: string;
  [k: string]: unknown;
}

export const preferencesApi = {
  get: () => api.get("/preferences") as Promise<PreferencesShape>,
  saveOrbitaTemplate: (orbitaPromptTemplate: string) =>
    api.put("/preferences", { orbitaPromptTemplate }) as Promise<unknown>,
};

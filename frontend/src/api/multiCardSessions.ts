/**
 * multiCardSessions.ts — API client para sessões multi-card.
 */

import { api } from "../lib/apiClient";
import type { MultiCardSessionEntry } from "../lib/multiCardSessionLog";

export async function createMultiCardSession(entry: MultiCardSessionEntry): Promise<unknown> {
  return api.post("/multi-card-sessions", entry);
}

export async function fetchMultiCardSessions(): Promise<MultiCardSessionEntry[]> {
  const data = await api.get("/multi-card-sessions");
  if (!data || !Array.isArray(data)) return [];
  return data as MultiCardSessionEntry[];
}

export async function fetchMultiCardSession(id: string): Promise<MultiCardSessionEntry | null> {
  try {
    return await api.get(`/multi-card-sessions/${id}`);
  } catch {
    return null;
  }
}

export async function deleteMultiCardSession(id: string): Promise<unknown> {
  return api.delete(`/multi-card-sessions/${id}`);
}

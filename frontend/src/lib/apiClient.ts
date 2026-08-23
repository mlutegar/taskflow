/**
 * apiClient.js — Cliente HTTP para o backend TaskFlow.
 * Injeta automaticamente o JWT (armazenado no localStorage pelo AuthContext)
 * em cada requisição. Timeout de 9 segundos por requisição via AbortController.
 */
import { API_TIMEOUT_MS } from "../config/constants";

const BASE_URL: string = import.meta.env.VITE_API_URL || "http://localhost:3001";
const TIMEOUT_MS: number = API_TIMEOUT_MS;

function getToken(): string | null {
  return localStorage.getItem("taskflow.authToken");
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = await getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if ((err as { name?: string }).name === "AbortError") {
      throw new Error("Timeout: servidor não respondeu em 9s");
    }
    throw err;
  }
  clearTimeout(timer);

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Erro ${res.status}`);
  }

  return data;
}

export const api = {
  get:    (path: string): Promise<unknown>               => request("GET",    path),
  post:   (path: string, body?: unknown): Promise<unknown> => request("POST",   path, body),
  patch:  (path: string, body?: unknown): Promise<unknown> => request("PATCH",  path, body),
  put:    (path: string, body?: unknown): Promise<unknown> => request("PUT",    path, body),
  delete: (path: string): Promise<unknown>               => request("DELETE", path),
};

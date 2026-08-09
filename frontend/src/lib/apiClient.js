/**
 * apiClient.js — Cliente HTTP para o backend TaskFlow.
 * Injeta automaticamente o JWT do Supabase em cada requisição.
 * Timeout de 9 segundos por requisição via AbortController.
 */
import { supabase } from "./supabase";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const TIMEOUT_MS = 9_000;

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

async function request(method, path, body) {
  const token = await getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("Timeout: servidor não respondeu em 9s");
    }
    throw err;
  }
  clearTimeout(timer);

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `Erro ${res.status}`);
  }

  return data;
}

export const api = {
  get:    (path)        => request("GET",    path),
  post:   (path, body)  => request("POST",   path, body),
  patch:  (path, body)  => request("PATCH",  path, body),
  put:    (path, body)  => request("PUT",    path, body),
  delete: (path)        => request("DELETE", path),
};

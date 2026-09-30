import { apiConnection, ApiError } from "../lib/apiClient";

export interface UploadedImage {
  url: string;
  filename: string;
  size?: number;
}

/**
 * Envia uma imagem para o backend e retorna a URL pública.
 * Usa fetch + FormData diretamente (o apiClient só lida com JSON) e injeta o
 * mesmo JWT do apiClient via apiConnection().
 */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const { baseUrl, token } = apiConnection();
  const form = new FormData();
  form.append("file", file);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}/uploads/images`, {
    method: "POST",
    headers,
    body: form,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const d = data as { message?: string; error?: string } | null;
    throw new ApiError(d?.error || d?.message || `Erro ${res.status}`, res.status, data);
  }
  return data as UploadedImage;
}

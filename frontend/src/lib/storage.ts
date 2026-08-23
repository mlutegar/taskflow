/**
 * storage.js — Centralized localStorage helpers for TaskFlow.
 * All keys are prefixed with "taskflow." to avoid collisions.
 * Functions are safe (try/catch) and handle missing/corrupt values gracefully.
 */

import { STORAGE_PREFIX } from "../config/constants";

const PREFIX: string = STORAGE_PREFIX;

/** Read a JSON value. Returns defaultValue if missing or unparseable. */
export function storageGet<T = unknown>(key: string, defaultValue: T = null as unknown as T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Write a JSON value.
 * Returns true on success, false on failure (e.g. storage quota exceeded).
 */
export function storageSet(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err: any) {
    if (err?.name === "QuotaExceededError" || err?.code === 22) {
      console.warn(`[taskflow] localStorage cheio — não foi possível salvar "${key}". Considere limpar dados antigos.`);
    }
    return false;
  }
}

/** Remove a key. */
export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // silently fail
  }
}

/** Read an integer. Returns defaultValue (0) if missing. */
export function storageGetInt(key: string, defaultValue: number = 0): number {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return defaultValue;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  } catch {
    return defaultValue;
  }
}

/** Write an integer. */
export function storageSetInt(key: string, value: number): void {
  try {
    localStorage.setItem(PREFIX + key, String(parseInt(String(value), 10)));
  } catch {
    // silently fail
  }
}

/** Append an item to a stored array (creates array if missing). Trims to maxLen. */
export function storageAppend<T = unknown>(key: string, item: T, maxLen: number = Infinity): void {
  try {
    const existing = storageGet<T[]>(key, []);
    const arr = Array.isArray(existing) ? existing : [];
    arr.push(item);
    const trimmed = maxLen < Infinity ? arr.slice(-maxLen) : arr;
    storageSet(key, trimmed);
  } catch {
    // silently fail
  }
}

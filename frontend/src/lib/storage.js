/**
 * storage.js — Centralized localStorage helpers for TaskFlow.
 * All keys are prefixed with "taskflow." to avoid collisions.
 * Functions are safe (try/catch) and handle missing/corrupt values gracefully.
 */

const PREFIX = 'taskflow.';

/** Read a JSON value. Returns defaultValue if missing or unparseable. */
export function storageGet(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

/** Write a JSON value. Silently fails if storage is full. */
export function storageSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // silently fail (e.g. storage quota exceeded)
  }
}

/** Remove a key. */
export function storageRemove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // silently fail
  }
}

/** Read an integer. Returns defaultValue (0) if missing. */
export function storageGetInt(key, defaultValue = 0) {
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
export function storageSetInt(key, value) {
  try {
    localStorage.setItem(PREFIX + key, String(parseInt(value, 10)));
  } catch {
    // silently fail
  }
}

/** Append an item to a stored array (creates array if missing). Trims to maxLen. */
export function storageAppend(key, item, maxLen = Infinity) {
  try {
    const existing = storageGet(key, []);
    const arr = Array.isArray(existing) ? existing : [];
    arr.push(item);
    const trimmed = maxLen < Infinity ? arr.slice(-maxLen) : arr;
    storageSet(key, trimmed);
  } catch {
    // silently fail
  }
}

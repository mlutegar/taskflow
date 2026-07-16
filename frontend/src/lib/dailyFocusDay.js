// Estado diário do Daily Focus.
// Persiste: nível alcançado hoje + modos usados hoje.
// Reseta automaticamente quando a data muda.

const LS_KEY = "taskflow.dailyFocus.day";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function read() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj?.date !== todayIso()) return null; // dia virou — ignora
    return obj;
  } catch {
    return null;
  }
}

function write(obj) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...obj, date: todayIso() }));
  } catch {}
}

/** Retorna o estado completo de hoje: { date, level, usedModes } */
export function getDayState() {
  return read() ?? { date: todayIso(), level: 1, usedModes: [] };
}

/** Nível mais alto atingido hoje (default 1). */
export function getDayLevel() {
  return getDayState().level;
}

/**
 * Atualiza o nível do dia se `level` for maior que o atual.
 * Nunca diminui o nível registrado no dia.
 */
export function setDayLevel(level) {
  const state = getDayState();
  if (level > state.level) {
    write({ ...state, level });
  }
}

/** Lista de modeIds já usados hoje. */
export function getUsedModes() {
  return getDayState().usedModes;
}

/**
 * Adiciona modeIds ao registro de hoje (sem duplicatas).
 * @param {string[]} modeIds
 */
export function addUsedModes(modeIds) {
  if (!modeIds?.length) return;
  const state = getDayState();
  const merged = Array.from(new Set([...state.usedModes, ...modeIds]));
  write({ ...state, usedModes: merged });
}

// Estado diário do Daily Focus.
// Persiste: nível alcançado hoje + contagem de usos por modo hoje.
// Reseta automaticamente quando a data muda.

const LS_KEY = "taskflow.dailyFocus.day";

// Fix #11: usar data local (não UTC) para evitar bug de fuso horário
function todayIso() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function read() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj?.date !== todayIso()) return null; // dia virou — ignora
    // Migração: formato legado usava array, agora usa objeto { [modeId]: count }
    if (Array.isArray(obj.usedModes)) {
      obj.usedModes = Object.fromEntries(obj.usedModes.map((id) => [id, 1]));
    }
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
  return read() ?? { date: todayIso(), level: 1, usedModes: {} };
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

/**
 * Objeto com contagem de usos por modeId hoje: { [modeId]: count }.
 * Retorna {} se nenhum modo foi usado.
 */
export function getUsedModes() {
  return getDayState().usedModes;
}

/**
 * Incrementa o contador de cada modeId no registro de hoje.
 * @param {string[]} modeIds
 */
export function addUsedModes(modeIds) {
  if (!modeIds?.length) return;
  const state = getDayState();
  const counts = { ...state.usedModes };
  for (const id of modeIds) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
  write({ ...state, usedModes: counts });
}

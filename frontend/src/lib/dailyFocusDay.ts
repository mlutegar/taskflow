import { fetchTodayState, upsertTodayState } from "../api/dailyFocusDayState";

// Estado diário do Daily Focus.
// Persiste: nível alcançado hoje + contagem de usos por modo hoje.
// Reseta automaticamente quando a data muda.

const LS_KEY = "taskflow.dailyFocus.day";

interface DayState {
  date: string;
  level: number;
  usedModes: Record<string, number>;
}

// Fix #11: usar data local (não UTC) para evitar bug de fuso horário
function todayIso(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function read(): DayState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj?.date !== todayIso()) return null; // dia virou — ignora
    // Migração: formato legado usava array, agora usa objeto { [modeId]: count }
    if (Array.isArray(obj.usedModes)) {
      obj.usedModes = Object.fromEntries(obj.usedModes.map((id: string) => [id, 1]));
    }
    return obj as DayState;
  } catch {
    return null;
  }
}

function write(obj: DayState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...obj, date: todayIso() }));
  } catch {}
  // Sincroniza com Supabase (fire-and-forget)
  upsertTodayState(obj.level, obj.usedModes || {}).catch(() => {});
}

/** Retorna o estado completo de hoje: { date, level, usedModes } */
export function getDayState(): DayState {
  return read() ?? { date: todayIso(), level: 1, usedModes: {} };
}

/** Nível mais alto atingido hoje (default 1). */
export function getDayLevel(): number {
  return getDayState().level;
}

/**
 * Atualiza o nível do dia se `level` for maior que o atual.
 * Nunca diminui o nível registrado no dia.
 */
export function setDayLevel(level: number): void {
  const state = getDayState();
  if (level > state.level) {
    write({ ...state, level });
  }
}

/**
 * Objeto com contagem de usos por modeId hoje: { [modeId]: count }.
 * Retorna {} se nenhum modo foi usado.
 */
export function getUsedModes(): Record<string, number> {
  return getDayState().usedModes;
}

/**
 * Incrementa o contador de cada modeId no registro de hoje.
 * @param {string[]} modeIds
 */
export function addUsedModes(modeIds: string[]): void {
  if (!modeIds?.length) return;
  const state = getDayState();
  const counts: Record<string, number> = { ...state.usedModes };
  for (const id of modeIds) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
  write({ ...state, usedModes: counts });
}

/**
 * Carrega o estado do dia do Supabase e mescla com localStorage.
 * Pega o maior level entre os dois e soma as contagens de modos.
 * Deve ser chamado no boot do app após login.
 */
export async function loadRemoteTodayState(): Promise<void> {
  try {
    const remote = await fetchTodayState();
    if (!remote) return;

    const local = getDayState();
    const today = todayIso();

    // Só mescla se o remoto for de hoje
    if (remote.date !== today) return;

    const mergedLevel = Math.max(local.level, remote.level);
    const mergedModes: Record<string, number> = { ...remote.usedModes };
    for (const [id, count] of Object.entries(local.usedModes || {})) {
      mergedModes[id] = Math.max(mergedModes[id] || 0, count);
    }

    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ date: today, level: mergedLevel, usedModes: mergedModes }));
    } catch {}
  } catch {
    // Falha silenciosa
  }
}

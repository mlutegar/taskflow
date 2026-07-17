/**
 * Tracking de ativações de modos.
 * Uma "ativação" é contada quando o usuário abre uma sessão de modo.
 * Também registrada quando o Modo Música atinge contagem = 100 ou ao trocar de modo.
 *
 * Estrutura no localStorage ("taskflow.modeActivations"):
 * [{ modeId: string, date: "YYYY-MM-DD" }, ...]
 *
 * Retenção: 365 dias.
 */

const KEY = "taskflow.modeActivations";
const RETENTION_DAYS = 365;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function cutoff() {
  const d = new Date();
  d.setDate(d.getDate() - RETENTION_DAYS);
  return d.toISOString().slice(0, 10);
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw);
    // Limpa entradas antigas
    const limit = cutoff();
    return entries.filter((e) => e.date >= limit);
  } catch {
    return [];
  }
}

function save(entries) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Sem espaço no localStorage — ignora
  }
}

/**
 * Registra uma ativação do modo.
 * @param {string} modeId
 */
export function logActivation(modeId) {
  if (!modeId) return;
  const entries = load();
  entries.push({ modeId, date: todayIso() });
  save(entries);
}

/**
 * Retorna o total histórico de ativações de um modo (últimos 365 dias).
 * @param {string} modeId
 * @returns {number}
 */
export function getActivationCount(modeId) {
  return load().filter((e) => e.modeId === modeId).length;
}

/**
 * Retorna o número de ativações hoje de um modo.
 * @param {string} modeId
 * @returns {number}
 */
export function getActivationsToday(modeId) {
  const today = todayIso();
  return load().filter((e) => e.modeId === modeId && e.date === today).length;
}

/**
 * Retorna todas as ativações agrupadas por modeId com contagem total.
 * @returns {{ modeId: string, count: number }[]}
 */
export function getAllActivations() {
  const entries = load();
  const counts = {};
  entries.forEach(({ modeId }) => {
    counts[modeId] = (counts[modeId] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([modeId, count]) => ({ modeId, count }))
    .sort((a, b) => b.count - a.count);
}

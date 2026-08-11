import { ESTADOS_DEFAULT } from "../components/daily-focus/stateToMode";
import { MODES } from "../data/modes";
import { getCheckinLog } from "./checkinLog";
import { getUsageLogs } from "./sessionUsageLog";

/**
 * Retorna correlações entre estado emocional no check-in e taxa de sucesso do modo usado.
 * Junta checkinLog (estadoId + modeId + date) com sessionUsageLog (modeId + date + worked).
 * Retorna: [{ estado, estadoLabel, estadoEmoji, modeId, modeName, modeEmoji, total, worked, successRate }]
 */
export function getMoodModeStats() {
  const estadoMap = Object.fromEntries(ESTADOS_DEFAULT.map((e) => [e.id, e]));
  const modeMap = Object.fromEntries(MODES.map((m) => [m.id, m]));

  const checkins = getCheckinLog(); // [{estadoId, modeId, date, hour}]
  const usageLogs = getUsageLogs(); // [{modeId, date, hour, worked, ...}]

  if (!checkins.length || !usageLogs.length) return [];

  // Mapa rápido: modeId|date → worked (usa o primeiro registro por dia)
  const usageMap = {};
  for (const e of usageLogs) {
    const key = `${e.modeId}|${e.date}`;
    if (!(key in usageMap)) usageMap[key] = e.worked;
  }

  // Agrega por estado × modo
  const agg = {}; // key: `${estadoId}::${modeId}`
  for (const c of checkins) {
    if (!c.estadoId || !c.modeId) continue;
    const usageKey = `${c.modeId}|${c.date}`;
    if (!(usageKey in usageMap)) continue; // sem log de uso neste dia

    const key = `${c.estadoId}::${c.modeId}`;
    if (!agg[key]) agg[key] = { total: 0, worked: 0 };
    agg[key].total++;
    if (usageMap[usageKey]) agg[key].worked++;
  }

  return Object.entries(agg)
    .filter(([, v]) => v.total >= 2)
    .map(([key, v]) => {
      const [estado, modeId] = key.split("::");
      return {
        estado,
        estadoLabel: estadoMap[estado]?.label || estado,
        estadoEmoji: estadoMap[estado]?.emoji || "",
        modeId,
        modeName: modeMap[modeId]?.name || modeId,
        modeEmoji: modeMap[modeId]?.emoji || "",
        total: v.total,
        worked: v.worked,
        successRate: Math.round((v.worked / v.total) * 100),
      };
    })
    .sort((a, b) => b.total - a.total);
}

import { getUsageLogs } from "./sessionUsageLog";
import { MODES } from "../data/modes";

const IDLE_REASON_LABELS = {
  distraction:  "📱 Distração",
  another_task: "📋 Outra tarefa",
  planned:      "☕ Pausa planejada",
  tiredness:    "😴 Cansaço",
  none:         "✅ Não ocioso",
};

const HOUR_BLOCKS = [
  { id: "dawn",      label: "Madrugada", emoji: "🌙", range: [0, 5] },
  { id: "morning",   label: "Manhã",     emoji: "🌅", range: [6, 11] },
  { id: "afternoon", label: "Tarde",     emoji: "☀️", range: [12, 17] },
  { id: "evening",   label: "Noite",     emoji: "🌆", range: [18, 23] },
];

export function getDistractionInsights() {
  const logs = getUsageLogs().filter((l) => l.idleMinutes > 0 && Array.isArray(l.idleReason) && l.idleReason.length > 0 && !l.idleReason.includes("none"));

  if (logs.length < 5) return null;

  // Top reasons
  const reasonCount = {};
  const reasonIdle = {};
  for (const log of logs) {
    for (const r of log.idleReason) {
      if (r === "none") continue;
      reasonCount[r] = (reasonCount[r] || 0) + 1;
      reasonIdle[r] = (reasonIdle[r] || 0) + (log.idleMinutes || 0);
    }
  }
  const topReasons = Object.entries(reasonCount)
    .map(([id, count]) => ({
      id,
      label: IDLE_REASON_LABELS[id] || id,
      count,
      avgIdleMin: Math.round((reasonIdle[id] || 0) / count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Worst hour (most idle minutes on average)
  const blockIdle = {};
  const blockCount = {};
  for (const log of logs) {
    const block = HOUR_BLOCKS.find((b) => log.hour >= b.range[0] && log.hour <= b.range[1]);
    if (!block) continue;
    blockIdle[block.id] = (blockIdle[block.id] || 0) + (log.idleMinutes || 0);
    blockCount[block.id] = (blockCount[block.id] || 0) + 1;
  }
  const worstHourBlock = Object.entries(blockIdle)
    .filter(([id]) => blockCount[id] >= 3)
    .map(([id, totalIdle]) => ({
      id,
      avgIdle: Math.round(totalIdle / blockCount[id]),
      block: HOUR_BLOCKS.find((b) => b.id === id),
    }))
    .sort((a, b) => b.avgIdle - a.avgIdle)[0] || null;

  // Mode with most idle time
  const modeIdle = {};
  const modeCount = {};
  for (const log of logs) {
    modeIdle[log.modeId] = (modeIdle[log.modeId] || 0) + (log.idleMinutes || 0);
    modeCount[log.modeId] = (modeCount[log.modeId] || 0) + 1;
  }
  const mostIdleModeEntry = Object.entries(modeIdle)
    .filter(([id]) => modeCount[id] >= 3)
    .map(([modeId, totalIdle]) => {
      const mode = MODES.find((m) => m.id === modeId);
      return {
        modeId,
        name: mode ? `${mode.emoji} ${mode.name}` : modeId,
        avgIdle: Math.round(totalIdle / modeCount[modeId]),
        total: modeCount[modeId],
      };
    })
    .sort((a, b) => b.avgIdle - a.avgIdle)[0] || null;

  return { topReasons, worstHourBlock, mostIdleModeEntry, total: logs.length };
}

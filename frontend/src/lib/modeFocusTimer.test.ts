import { describe, it, expect, beforeEach } from "vitest";
import {
  startModeFocusTimer,
  syncModeFocusTimer,
  stopModeFocusTimer,
  getModeFocusStats,
  getModeFocusMinutes,
  liveModeFocusMs,
  isModeFocusRunning,
  incrementModeTaskCount,
} from "./modeFocusTimer";
import { saveDailyFocusLive, clearDailyFocusLive, DailyFocusLive } from "./dailyFocusLive";
import { SK } from "./storageKeys";
import { storageRemove } from "./storage";

const MIN = 60_000;

/** Define o snapshot do Daily Focus (só `running`/`phase` importam para o acumulador). */
function setDailyFocus(running: boolean, phase = "work"): void {
  saveDailyFocusLive({
    taskTitle: "t", phase, running, remainingSecs: 600, anchorTs: 0, totalSecs: 1500,
    rushMode: false, tabMode: false, cycleCount: 0, nextTaskTitle: "", taskIndex: 0, taskCount: 1,
  } as DailyFocusLive);
}

/** Simula o heartbeat real (a cada 15s < 20s de grace) enquanto o tempo avança. */
function heartbeat(from: number, minutes: number): number {
  const end = from + minutes * MIN;
  let t = from;
  while (t < end) {
    t = Math.min(t + 15_000, end);
    syncModeFocusTimer(t);
  }
  return end;
}

beforeEach(() => {
  storageRemove(SK.MODE_FOCUS_TIMER);
  clearDailyFocusLive();
});

describe("modeFocusTimer", () => {
  it("não acumula quando o Daily Focus não está rodando", () => {
    setDailyFocus(false);
    const t0 = 1_000_000;
    startModeFocusTimer("s1", t0);
    // 30 min sem Daily Focus rodando
    const t1 = heartbeat(t0, 30);
    expect(getModeFocusMinutes(t1)).toBe(0);
    expect(isModeFocusRunning()).toBe(false);
  });

  it("registra o exemplo do usuário: 25 foco + 10 pausa + 20 foco = 45 min (não 55)", () => {
    setDailyFocus(true);
    const t0 = 2_000_000;
    startModeFocusTimer("s2", t0);

    // 25 min em foco
    let t = heartbeat(t0, 25);

    // pausa o Daily Focus por 10 min
    setDailyFocus(false);
    syncModeFocusTimer(t);
    t = t + 10 * MIN; // tempo passa pausado (sem contar)

    // retoma e foca +20 min
    setDailyFocus(true);
    syncModeFocusTimer(t);
    t = heartbeat(t, 20);

    const stats = stopModeFocusTimer(t);
    expect(stats.focusMinutes).toBe(45);
    expect(stats.pauseCount).toBe(1);
    expect(stats.pausedMinutes).toBe(10);
    expect(stats.focusBlocks).toBe(2); // dois blocos de foco (antes e depois da pausa)
  });

  it("descarta tempo de background além do grace (app dormiu com o timer 'rodando')", () => {
    setDailyFocus(true);
    const t0 = 3_000_000;
    startModeFocusTimer("s3", t0);
    // Sem heartbeat: pula 60 min e só então sincroniza (pausa).
    const t1 = t0 + 60 * MIN;
    setDailyFocus(false);
    syncModeFocusTimer(t1);
    // Só o grace (~20s) deveria ter sido contado, não 60 min.
    expect(getModeFocusMinutes(t1)).toBeLessThanOrEqual(1);
  });

  it("conta tarefas concluídas com o modo ativo", () => {
    setDailyFocus(true);
    const t0 = 4_000_000;
    startModeFocusTimer("s4", t0);
    incrementModeTaskCount();
    incrementModeTaskCount();
    const t1 = heartbeat(t0, 5);
    const stats = getModeFocusStats(t1);
    expect(stats.tasksCompleted).toBe(2);
    expect(stats.focusMinutes).toBe(5);
  });

  it("congela o tempo ao vivo enquanto o Daily Focus está pausado", () => {
    setDailyFocus(true);
    const t0 = 5_000_000;
    startModeFocusTimer("s5", t0);
    let t = heartbeat(t0, 10);
    setDailyFocus(false);
    syncModeFocusTimer(t);
    const frozen = liveModeFocusMs(t);
    // 5 min depois, ainda pausado → valor não muda
    expect(liveModeFocusMs(t + 5 * MIN)).toBe(frozen);
    expect(Math.round(frozen / MIN)).toBe(10);
  });

  it("stop limpa o estado (sessão encerrada não conta mais)", () => {
    setDailyFocus(true);
    const t0 = 6_000_000;
    startModeFocusTimer("s6", t0);
    heartbeat(t0, 10);
    stopModeFocusTimer(t0 + 10 * MIN);
    expect(getModeFocusMinutes(t0 + 20 * MIN)).toBe(0);
    expect(isModeFocusRunning()).toBe(false);
  });
});

/**
 * clockDrift.ts - Detecção de mudanças no relógio do sistema
 *
 * Compara timestamp local vs servidor para detectar:
 * - Mudanças manuais de data/hora
 * - Ajustes de fuso horário
 * - Drift significativo (>5s)
 */

interface ClockDriftState {
  lastServerTime: number | null;
  lastLocalTime: number | null;
  lastDrift: number;
}

const state: ClockDriftState = {
  lastServerTime: null,
  lastLocalTime: null,
  lastDrift: 0,
};

const DRIFT_THRESHOLD_MS = 5000; // 5 segundos

/**
 * Verifica drift entre relógio local e servidor
 * @returns drift em milissegundos (positivo = local está adiantado)
 */
export async function checkClockDrift(): Promise<number> {
  try {
    const localBefore = Date.now();
    const response = await fetch('/api/server-time');

    if (!response.ok) {
      console.warn('[ClockDrift] Server time endpoint failed:', response.status);
      return state.lastDrift;
    }

    const { serverTime } = await response.json();
    const localAfter = Date.now();

    // Estimar tempo do servidor compensando round-trip time
    const rtt = localAfter - localBefore;
    const estimatedServerTime = serverTime + (rtt / 2);
    const drift = localAfter - estimatedServerTime;

    // Detectar mudança significativa
    if (state.lastServerTime !== null && Math.abs(drift) > DRIFT_THRESHOLD_MS) {
      console.warn('[ClockDrift] Detected significant drift:', {
        drift: `${drift}ms`,
        previous: `${state.lastDrift}ms`,
        change: `${Math.abs(drift - state.lastDrift)}ms`,
      });

      // Disparar evento customizado
      window.dispatchEvent(new CustomEvent('clock-drift-detected', {
        detail: { drift, previousDrift: state.lastDrift }
      }));
    }

    state.lastServerTime = serverTime;
    state.lastLocalTime = localAfter;
    state.lastDrift = drift;

    return drift;
  } catch (error) {
    console.error('[ClockDrift] Failed to check:', error);
    return state.lastDrift;
  }
}

/**
 * Inicia verificação periódica de drift (a cada 5 minutos)
 */
export function startClockDriftMonitoring(): () => void {
  // Verifica imediatamente
  void checkClockDrift();

  // E depois a cada 5 minutos
  const interval = setInterval(() => {
    void checkClockDrift();
  }, 5 * 60 * 1000);

  // Retorna função de cleanup
  return () => clearInterval(interval);
}

/**
 * Obtém último drift conhecido
 */
export function getLastDrift(): number {
  return state.lastDrift;
}

/**
 * Verifica se há drift significativo
 */
export function hasSignificantDrift(): boolean {
  return Math.abs(state.lastDrift) > DRIFT_THRESHOLD_MS;
}

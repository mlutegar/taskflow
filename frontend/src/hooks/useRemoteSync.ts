import { useState, useEffect, useRef, useCallback } from "react";
import { loadRemoteSessions, flushUnsyncedSessions } from "../lib/dailyFocusHistory.js";
import { loadRemoteTodayState }      from "../lib/dailyFocusDay.js";
import { loadRemoteContinuousActivity } from "../lib/continuousActivity.js";
import { loadRemoteAchievements }    from "../lib/dailyFocusAchievements.js";
import { loadRemoteCheckins }        from "../lib/checkinLog.js";
import { loadRemoteEmotions }        from "../lib/emotionLog.js";
import { loadRemotePreferences }     from "../lib/userPreferences.js";
import { loadRemoteModeActivations } from "../lib/modeActivations.js";
import { loadRemoteUsageLogs }       from "../lib/sessionUsageLog.js";
import { loadRemoteModeComboLog }    from "../lib/modeComboLog.js";
import { loadRemoteActiveSession }   from "../lib/dailyFocusLive.js";

interface Loader {
  name: string;
  fn: () => Promise<unknown>;
}

const LOADERS: Loader[] = [
  { name: "sessions",        fn: loadRemoteSessions },
  { name: "todayState",      fn: loadRemoteTodayState },
  { name: "continuousActivity", fn: loadRemoteContinuousActivity },
  { name: "achievements",    fn: loadRemoteAchievements },
  { name: "checkins",        fn: loadRemoteCheckins },
  { name: "emotions",        fn: loadRemoteEmotions },
  { name: "preferences",     fn: loadRemotePreferences },
  { name: "modeActivations", fn: loadRemoteModeActivations },
  { name: "usageLogs",       fn: loadRemoteUsageLogs },
  { name: "modeComboLog",    fn: loadRemoteModeComboLog },
  { name: "activeSession",   fn: loadRemoteActiveSession },
];

export interface RemoteSyncState {
  syncing: boolean;
  errors: string[];   // names of loaders that failed
  resync: () => void; // trigger a manual re-sync
}

/**
 * Runs all remote data loaders once after the user logs in.
 * Exposes syncing state, failed loader names, and a resync() trigger
 * for reconnection or manual retry scenarios.
 */
export function useRemoteSync(user: unknown): RemoteSyncState {
  const syncedRef = useRef<boolean>(false);
  const [syncing, setSyncing]   = useState<boolean>(false);
  const [errors,  setErrors]    = useState<string[]>([]);

  const run = useCallback(async (): Promise<void> => {
    setSyncing(true);
    setErrors([]);

    // Empurra sessões pendentes (offline / falhas anteriores) ANTES de recarregar
    // o histórico remoto, para não perder registros ainda não sincronizados.
    await flushUnsyncedSessions().catch(() => {});

    const results = await Promise.allSettled(LOADERS.map(({ fn }) => fn()));

    const failed: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.warn(`[useRemoteSync] Falha ao carregar "${LOADERS[i].name}":`, result.reason);
        failed.push(LOADERS[i].name);
      }
    });

    setErrors(failed);
    setSyncing(false);
  }, []);

  // Run automatically once when the user first logs in
  useEffect(() => {
    if (!user || syncedRef.current) return;
    syncedRef.current = true;
    void run();
  }, [user, run]);

  // Mantém o outbox de sessões drenando: ao recuperar a conexão, ao voltar o
  // foco à aba e periodicamente. flushUnsyncedSessions() tem guard interno de
  // concorrência, então esses gatilhos podem coexistir sem reprocessar.
  useEffect(() => {
    if (!user) return;

    const flushThenReload = (): void => {
      void flushUnsyncedSessions()
        .catch(() => {})
        .then(() => loadRemoteSessions())
        .catch(() => {});
    };

    const onOnline = (): void => flushThenReload();
    const onVisible = (): void => {
      if (document.visibilityState === "visible") void flushUnsyncedSessions().catch(() => {});
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => {
      if (navigator.onLine !== false) void flushUnsyncedSessions().catch(() => {});
    }, 5 * 60_000); // a cada 5 min enquanto a aba estiver aberta

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [user]);

  // resync() resets the guard so a forced re-run is possible
  const resync = useCallback((): void => {
    syncedRef.current = false;
    if (user) {
      syncedRef.current = true;
      void run();
    }
  }, [user, run]);

  return { syncing, errors, resync };
}

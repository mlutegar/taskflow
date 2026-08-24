import { useState, useEffect, useRef, useCallback } from "react";
import { loadRemoteSessions }        from "../lib/dailyFocusHistory.js";
import { loadRemoteTodayState }      from "../lib/dailyFocusDay.js";
import { loadRemoteAchievements }    from "../lib/dailyFocusAchievements.js";
import { loadRemoteCheckins }        from "../lib/checkinLog.js";
import { loadRemotePreferences }     from "../lib/userPreferences.js";
import { loadRemoteModeActivations } from "../lib/modeActivations.js";
import { loadRemoteUsageLogs }       from "../lib/sessionUsageLog.js";
import { loadRemoteModeLog }         from "../lib/modeLog.js";
import { loadRemoteModeComboLog }    from "../lib/modeComboLog.js";

interface Loader {
  name: string;
  fn: () => Promise<unknown>;
}

const LOADERS: Loader[] = [
  { name: "sessions",        fn: loadRemoteSessions },
  { name: "todayState",      fn: loadRemoteTodayState },
  { name: "achievements",    fn: loadRemoteAchievements },
  { name: "checkins",        fn: loadRemoteCheckins },
  { name: "preferences",     fn: loadRemotePreferences },
  { name: "modeActivations", fn: loadRemoteModeActivations },
  { name: "usageLogs",       fn: loadRemoteUsageLogs },
  { name: "modeLog",         fn: loadRemoteModeLog },
  { name: "modeComboLog",    fn: loadRemoteModeComboLog },
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

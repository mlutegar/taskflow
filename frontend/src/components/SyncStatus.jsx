/**
 * SyncStatus — indicador discreto de estado de sincronização.
 * Mostra um ícone no canto da tela quando há itens pendentes na fila offline.
 *
 * Estados:
 *   • online  + fila vazia  → nada exibido
 *   • online  + flushing   → 🔄 sincronizando
 *   • offline + fila > 0   → ⚠️ offline, X pendentes
 */

import { useState, useEffect } from "react";
import { queueSize, flushQueue } from "../lib/syncQueue";

// Escuta o mesmo canal do syncQueue para atualização imediata
const _bc = typeof BroadcastChannel !== "undefined"
  ? new BroadcastChannel("taskflow.sync")
  : null;

export default function SyncStatus() {
  const [online, setOnline]    = useState(() => navigator.onLine);
  const [pending, setPending]  = useState(() => queueSize());
  const [syncing, setSyncing]  = useState(false);

  useEffect(() => {
    function update() {
      setOnline(navigator.onLine);
      setPending(queueSize());
    }

    const onOnline = async () => {
      setOnline(true);
      if (queueSize() > 0) {
        setSyncing(true);
        await flushQueue();
        setSyncing(false);
        setPending(queueSize());
      }
    };

    const onOffline = () => {
      setOnline(false);
      update();
    };

    // Reage imediatamente quando algo é enfileirado (cross-tab ou mesma aba)
    if (_bc) _bc.onmessage = () => setPending(queueSize());

    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);

    // Atualiza a contagem periodicamente (fila pode crescer enquanto offline)
    const interval = setInterval(update, 5_000);

    return () => {
      if (_bc) _bc.onmessage = null;
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, []);

  // Nada para mostrar
  if (online && pending === 0 && !syncing) return null;

  return (
    <div
      title={
        syncing
          ? "Sincronizando dados pendentes…"
          : online
          ? `${pending} alteração(ões) sincronizando`
          : `Offline — ${pending} alteração(ões) pendente(s)`
      }
      style={{
        position:   "fixed",
        bottom:     "env(safe-area-inset-bottom, 12px)",
        right:      12,
        zIndex:     9999,
        display:    "flex",
        alignItems: "center",
        gap:        4,
        background: online ? "var(--surface-2, #2a2a2a)" : "rgba(230,90,60,0.15)",
        border:     `1px solid ${online ? "var(--border, #333)" : "rgba(230,90,60,0.4)"}`,
        borderRadius: 20,
        padding:    "4px 10px",
        fontSize:   11,
        color:      online ? "var(--text-muted, #aaa)" : "#e65a3c",
        userSelect: "none",
        pointerEvents: "none",
        backdropFilter: "blur(8px)",
      }}
    >
      <span style={{ fontSize: 13, animation: syncing ? "spin 1s linear infinite" : "none" }}>
        {syncing ? "🔄" : online ? "☁️" : "⚠️"}
      </span>
      <span>
        {syncing
          ? "sincronizando…"
          : online
          ? `${pending} pendente${pending !== 1 ? "s" : ""}`
          : `offline · ${pending} pendente${pending !== 1 ? "s" : ""}`}
      </span>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

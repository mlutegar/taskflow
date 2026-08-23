import { useState } from "react";
import { getEstados, saveEstados, resetEstados, ESTADOS_DEFAULT } from "./stateToMode";
import styles from "./CheckInConfigPanel.module.css";
import ModalOverlay from "../shared/ModalOverlay";
import type { Mode } from "../../types/index";

interface Estado {
  id: string;
  emoji: string;
  label: string;
  modeId: string | null;
  motivo: string;
  modeIdAlt: string;
  motivoAlt: string;
  custom?: boolean;
  [key: string]: unknown;
}

interface CheckInConfigPanelProps {
  allModes?: Mode[];
  onClose: () => void;
}

export default function CheckInConfigPanel({ allModes = [], onClose }: CheckInConfigPanelProps) {
  const [estados, setEstados] = useState<Estado[]>(() => getEstados());

  function updateEstado(id: string, field: string, value: string): void {
    setEstados((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  }

  function handleSave(): void {
    saveEstados(estados);
    onClose();
  }

  function handleReset(): void {
    if (!window.confirm("Restaurar mapeamentos padrão?")) return;
    resetEstados();
    setEstados([...ESTADOS_DEFAULT]);
  }

  function handleAdd(): void {
    const id = `custom_${Date.now()}`;
    setEstados((prev) => [...prev, {
      id,
      emoji: "⭐",
      label: "Novo estado",
      modeId: allModes[0]?.id ?? "",
      motivo: "",
      modeIdAlt: allModes[0]?.id ?? "",
      motivoAlt: "",
      custom: true,
    }]);
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>⚙️ Editar mapeamento estado → modo</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.body}>
          {estados.filter((e) => e.modeId !== null).map((estado) => (
            <div key={estado.id} className={styles.estadoRow}>
              <div className={styles.estadoRowLabel}>
                {estado.custom ? (
                  <>
                    <input
                      value={estado.emoji}
                      onChange={(e) => updateEstado(estado.id, "emoji", e.target.value)}
                      style={{ width: "40px", textAlign: "center", fontSize: "18px", border: "none", background: "transparent" }}
                    />
                    <input
                      value={estado.label}
                      onChange={(e) => updateEstado(estado.id, "label", e.target.value)}
                      style={{ fontSize: "14px", fontWeight: "bold", border: "none", background: "transparent", flex: 1 }}
                    />
                    <button
                      onClick={() => setEstados((prev) => prev.filter((e) => e.id !== estado.id))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger, #ef4444)", fontSize: "14px" }}
                    >✕</button>
                  </>
                ) : (
                  <>
                    <span>{estado.emoji}</span>
                    <strong>{estado.label}</strong>
                  </>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Modo principal</label>
                <select
                  className={styles.fieldSelect}
                  value={estado.modeId ?? ""}
                  onChange={(e) => updateEstado(estado.id, "modeId", e.target.value)}
                >
                  {allModes.map((m) => (
                    <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Por que usar agora</label>
                <textarea
                  className={styles.fieldTextarea}
                  value={estado.motivo}
                  onChange={(e) => updateEstado(estado.id, "motivo", e.target.value)}
                  rows={2}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Modo alternativo</label>
                <select
                  className={styles.fieldSelect}
                  value={estado.modeIdAlt}
                  onChange={(e) => updateEstado(estado.id, "modeIdAlt", e.target.value)}
                >
                  {allModes.map((m) => (
                    <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Motivo alternativo</label>
                <textarea
                  className={styles.fieldTextarea}
                  value={estado.motivoAlt}
                  onChange={(e) => updateEstado(estado.id, "motivoAlt", e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          ))}
        </div>
        <div className={styles.footer}>
          <button className={styles.resetBtn} onClick={handleReset}>↺ Restaurar padrão</button>
          <button className={styles.addBtn} onClick={handleAdd}>+ Novo estado</button>
          <button className={styles.saveBtn} onClick={handleSave}>✓ Salvar</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

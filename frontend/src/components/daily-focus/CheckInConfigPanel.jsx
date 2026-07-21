import { useState } from "react";
import { getEstados, saveEstados, resetEstados, ESTADOS_DEFAULT } from "./stateToMode";
import styles from "./CheckInConfigPanel.module.css";
import ModalOverlay from "../shared/ModalOverlay";

export default function CheckInConfigPanel({ allModes = [], onClose }) {
  const [estados, setEstados] = useState(() => getEstados());

  function updateEstado(id, field, value) {
    setEstados((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  }

  function handleSave() {
    saveEstados(estados);
    onClose();
  }

  function handleReset() {
    if (!window.confirm("Restaurar mapeamentos padrão?")) return;
    resetEstados();
    setEstados([...ESTADOS_DEFAULT]);
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>⚙️ Editar mapeamento estado → modo</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.body}>
          {estados.map((estado) => (
            <div key={estado.id} className={styles.estadoRow}>
              <div className={styles.estadoRowLabel}>
                <span>{estado.emoji}</span>
                <strong>{estado.label}</strong>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Modo principal</label>
                <select
                  className={styles.fieldSelect}
                  value={estado.modeId}
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
          <button className={styles.saveBtn} onClick={handleSave}>✓ Salvar</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

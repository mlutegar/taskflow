import { useState, memo } from "react";
import { usageStats } from "../../../lib/modeLog";
import { MODES, HELPER_GROUPS } from "../../../data/modes";
import ModalOverlay from "../../shared/ModalOverlay";
import styles from "../DailyFocus.module.css";

function getGroupsWithCustom(usageMap = {}) {
  const customModes = JSON.parse(localStorage.getItem("customModes") || "[]")
    .filter((m) => m.prerequisite?.trim() && m.whyItWorks?.trim() && m.whenToUse?.trim());
  const sortByUsage = (modes) =>
    [...modes].sort((a, b) => (usageMap[b.id] || 0) - (usageMap[a.id] || 0));
  return [
    ...HELPER_GROUPS.map((g) => ({
      label: g.label,
      modes: sortByUsage(g.ids.map((id) => MODES.find((m) => m.id === id)).filter(Boolean)),
    })),
    ...(customModes.length > 0 ? [{ label: "Personalizados", modes: sortByUsage(customModes) }] : []),
  ];
}

function HelperPickerModal({ current, currentIds, usedModes = {}, suggestedModeId = null, onSelect, onClose, onRemove }) {
  // Suporta tanto o formato antigo (current: string) quanto o novo (currentIds: string[])
  const selectedIds = currentIds ?? (current ? [current] : []);
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState("");
  // "forward" = lista→preview (slide da direita), "back" = preview→lista (slide da esquerda)
  const [animDir, setAnimDir] = useState("forward");

  const usageMap = Object.fromEntries(usageStats(30).map(({ modeId, count }) => [modeId, count]));
  const allGroups = getGroupsWithCustom(usageMap);

  // Filtro de busca aplicado sobre todos os grupos
  const groups = search.trim()
    ? [{
        label: "Resultados",
        modes: allGroups.flatMap((g) => g.modes).filter(
          (m) => m.name.toLowerCase().includes(search.toLowerCase()) ||
                 m.tagline.toLowerCase().includes(search.toLowerCase())
        ),
      }]
    : allGroups;

  const openPreview = (m) => {
    setAnimDir("forward");
    setPreview(m);
  };

  const closePreview = () => {
    setAnimDir("back");
    setPreview(null);
  };

  const handlePickItem = (m) => {
    openPreview(m);
  };

  const previewAnimClass = animDir === "forward"
    ? styles.modePreviewForward
    : styles.modePreviewBack;

  return (
    <ModalOverlay onClose={onClose}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {preview ? `${preview.emoji} ${preview.name}` : "🎯 Adicionar Modo de Apoio"}
          </span>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          {preview ? (
            <div
              key={preview.id}
              className={`${styles.modePreview} ${previewAnimClass}`}
              style={{ "--preview-color": preview.color || "var(--accent)" }}
            >
              <button className={styles.previewBack} onClick={closePreview}>
                ← Voltar à lista
              </button>
              <p className={styles.previewTagline}>{preview.tagline}</p>
              <div className={styles.previewField}>
                <span className={styles.previewFieldLabel}>✅ Pré-requisito</span>
                <p className={styles.previewFieldText}>{preview.prerequisite}</p>
              </div>
              <div className={styles.previewField}>
                <span className={styles.previewFieldLabel}>🧠 Por que funciona</span>
                <p className={styles.previewFieldText}>{preview.whyItWorks}</p>
              </div>
              <div className={styles.previewField}>
                <span className={styles.previewFieldLabel}>🕐 Quando usar</span>
                <p className={styles.previewFieldText}>{preview.whenToUse}</p>
              </div>
              {selectedIds.includes(preview.id) ? (
                <div className={styles.previewActiveNote}>
                  ✓ Este modo já está adicionado nesta tarefa
                </div>
              ) : (
                <button
                  className={styles.previewStartBtn}
                  onClick={() => { onSelect(preview.id); onClose(); }}
                >
                  ▶ Adicionar {preview.name}
                </button>
              )}
            </div>
          ) : (
            <div key="list" className={`${styles.pickerList} ${previewAnimClass}`}>
              {/* Busca */}
              <div className={styles.pickerSearch}>
                <input
                  className={styles.pickerSearchInput}
                  type="text"
                  placeholder="🔍 Buscar modo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
                {search && (
                  <button className={styles.pickerSearchClear} onClick={() => setSearch("")}>×</button>
                )}
              </div>

              {selectedIds.length > 0 && (
                <div style={{ padding: "6px 18px 10px", borderBottom: "1px solid var(--border)", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                  {selectedIds.map((id) => {
                    const m = allGroups.flatMap((g) => g.modes).find((x) => x.id === id);
                    return m ? (
                      <span key={id} style={{
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        fontSize: "11px", fontWeight: 600,
                        padding: "2px 10px 2px 10px", borderRadius: "20px",
                        background: "rgba(124,110,245,0.1)", border: "1px solid var(--accent)", color: "var(--accent)",
                      }}>
                        {m.emoji} {m.name}
                      </span>
                    ) : null;
                  })}
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>ativos</span>
                </div>
              )}

              {groups.map((g) => (
                <div key={g.label} className={styles.pickerGroup}>
                  <div className={styles.pickerGroupLabel}>{g.label}</div>
                  {g.modes.length === 0 && (
                    <div className={styles.pickerEmpty}>Nenhum modo encontrado</div>
                  )}
                  {g.modes.map((m) => {
                    const count = usedModes[m.id] ?? 0;
                    const isUsed = count > 0;
                    const isActive = selectedIds.includes(m.id);
                    const isSuggested = !isUsed && m.id === suggestedModeId;
                    const usedLabel = count === 1 ? "✓ usado 1x hoje" : `✓ usado ${count}x hoje`;
                    return (
                      <div
                        key={m.id}
                        className={`${styles.pickerItem} ${isActive ? styles.pickerItemActive : ""} ${isUsed ? styles.pickerItemUsed : ""}`}
                        onClick={() => handlePickItem(m)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Selecionar modo ${m.name}${isUsed ? ` (${usedLabel})` : ""}`}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePickItem(m); } }}
                      >
                        <span className={styles.pickerEmoji}>{m.emoji}</span>
                        <div className={styles.pickerInfo}>
                          <div className={styles.pickerName}>
                            {m.name}
                            {isSuggested && <span className={styles.pickerRecommended}>✨ recomendado</span>}
                          </div>
                          <div className={styles.pickerTagline}>
                            {isUsed ? usedLabel : m.tagline}
                          </div>
                        </div>
                        {isActive
                          ? <span className={styles.pickerCheck}>✓</span>
                          : isUsed
                            ? <span className={styles.pickerLock}>{count}×</span>
                            : <span className={styles.pickerChevron}>›</span>
                        }
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

export default memo(HelperPickerModal);

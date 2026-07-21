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

function HelperPickerModal({ current, usedModes = [], suggestedModeId = null, onSelect, onClose, onRemove }) {
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

  const handlePickItem = (m, isUsed) => {
    if (isUsed) return;
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
            {preview ? `${preview.emoji} ${preview.name}` : "🎯 Escolher Modo de Apoio"}
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
              {current === preview.id ? (
                <div className={styles.previewActiveNote}>
                  ✓ Este modo já está selecionado para esta tarefa
                </div>
              ) : (
                <button
                  className={styles.previewStartBtn}
                  onClick={() => { onSelect(preview.id); onClose(); }}
                >
                  ▶ Iniciar {preview.name}
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

              {onRemove && current && (
                <div style={{ padding: "6px 18px 10px", borderBottom: "1px solid var(--border)" }}>
                  <button
                    className={styles.changeHelperBtn}
                    style={{ width: "100%", padding: "8px" }}
                    onClick={() => { onRemove(); onClose(); }}
                  >
                    × Remover modo de apoio desta tarefa
                  </button>
                </div>
              )}

              {groups.map((g) => (
                <div key={g.label} className={styles.pickerGroup}>
                  <div className={styles.pickerGroupLabel}>{g.label}</div>
                  {g.modes.length === 0 && (
                    <div className={styles.pickerEmpty}>Nenhum modo encontrado</div>
                  )}
                  {g.modes.map((m) => {
                    const isUsed = usedModes.includes(m.id);
                    const isActive = current === m.id;
                    const isSuggested = !isUsed && m.id === suggestedModeId;
                    return (
                      <div
                        key={m.id}
                        className={`${styles.pickerItem} ${isActive ? styles.pickerItemActive : ""} ${isUsed ? styles.pickerItemUsed : ""}`}
                        onClick={() => handlePickItem(m, isUsed)}
                        role="button"
                        tabIndex={isUsed ? -1 : 0}
                        aria-label={`Selecionar modo ${m.name}${isUsed ? " (já usado hoje)" : ""}`}
                        aria-disabled={isUsed}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePickItem(m, isUsed); } }}
                      >
                        <span className={styles.pickerEmoji}>{m.emoji}</span>
                        <div className={styles.pickerInfo}>
                          <div className={styles.pickerName}>
                            {m.name}
                            {isSuggested && <span className={styles.pickerRecommended}>✨ recomendado</span>}
                          </div>
                          <div className={styles.pickerTagline}>
                            {isUsed ? "✓ já testado hoje" : m.tagline}
                          </div>
                        </div>
                        {isUsed
                          ? <span className={styles.pickerLock}>🔒</span>
                          : isActive
                            ? <span className={styles.pickerCheck}>✓</span>
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

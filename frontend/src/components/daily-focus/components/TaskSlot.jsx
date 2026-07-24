import { useState, useEffect, useRef, memo, useCallback } from "react";
import { tasksApi } from "../../../api/tasks";
import { MODES } from "../../../data/modes";
import HelperPickerModal from "./HelperPickerModal";
import styles from "../DailyFocus.module.css";

const PRESETS_KEY = "modeComboPresets";
const MAX_PRESETS = 6;

function loadPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]"); } catch { return []; }
}
function savePresets(list) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); } catch {}
}

function getModeById(id) {
  if (!id) return null;
  const custom = JSON.parse(localStorage.getItem("customModes") || "[]");
  return [...MODES, ...custom].find((m) => m.id === id) || null;
}

function TaskSlot({ slot, index, level, onChange, onMoveUp, onMoveDown, canMoveUp, canMoveDown, allModes: _allModes, usedModes = [], suggestedModeId = null }) {
  const [query, setQuery] = useState(slot.title);
  const [results, setResults] = useState([]);
  const [todayTasks, setTodayTasks] = useState([]);
  const debounce = useRef(null);
  const [showHelperPicker, setShowHelperPicker] = useState(false); // "durante" | "entre" | false
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationInput, setDurationInput] = useState(String(slot.durationMin));

  useEffect(() => { setQuery(slot.title); }, [slot.title]);
  useEffect(() => { setDurationInput(String(slot.durationMin)); }, [slot.durationMin]);

  // Carrega tarefas com vencimento hoje ao montar
  useEffect(() => {
    tasksApi.listDueToday().then(setTodayTasks).catch(() => {});
  }, []);

  const search = (val) => {
    setQuery(val);
    clearTimeout(debounce.current);
    if (!val.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const tasks = await tasksApi.list({ status: "active" });
        setResults(tasks.filter((t) => t.title.toLowerCase().includes(val.toLowerCase())).slice(0, 6));
      } catch { setResults([]); }
    }, 300);
  };

  const select = (task) => {
    onChange({ ...slot, title: task.title, supabaseId: task.id });
    setResults([]);
    setTodayTasks([]);
    setQuery(task.title);
  };

  const clear = () => {
    onChange({ ...slot, title: "", supabaseId: null });
    setQuery("");
    setResults([]);
  };

  const saveDuration = () => {
    const val = parseInt(durationInput, 10);
    if (!isNaN(val) && val >= 1 && val <= 240) {
      onChange({ ...slot, durationMin: val });
    } else {
      setDurationInput(String(slot.durationMin));
    }
    setEditingDuration(false);
  };

  const helperModeIds = slot.helperModeIds ?? [];
  const interModeIds = slot.interModeIds ?? [];
  const showTodaySuggestions = !query.trim() && todayTasks.length > 0;

  // ── Combo Presets ──
  const [presets, setPresets] = useState(loadPresets);
  const [savedFlash, setSavedFlash] = useState(false);

  const saveCurrentCombo = useCallback(() => {
    if (helperModeIds.length < 2) return;
    const label = helperModeIds.map((id) => getModeById(id)?.emoji ?? "").join("") + " " +
      helperModeIds.map((id) => getModeById(id)?.name ?? id).join(" + ");
    const next = [{ ids: helperModeIds, label }, ...presets.filter((p) => p.ids.join() !== helperModeIds.join())].slice(0, MAX_PRESETS);
    savePresets(next);
    setPresets(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }, [helperModeIds, presets]);

  const applyPreset = (preset) => {
    onChange({ ...slot, helperModeIds: preset.ids });
  };

  const deletePreset = (e, idx) => {
    e.stopPropagation();
    const next = presets.filter((_, i) => i !== idx);
    savePresets(next);
    setPresets(next);
  };

  return (
    <div className={styles.taskSlot}>
      <div className={styles.slotHeader}>
        <span className={styles.slotLabel}>Tarefa {index + 1}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {editingDuration ? (
            <input
              className={styles.durationInput}
              type="number"
              min={1}
              max={240}
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              onBlur={saveDuration}
              onKeyDown={(e) => { if (e.key === "Enter") saveDuration(); if (e.key === "Escape") setEditingDuration(false); }}
              autoFocus
            />
          ) : (
            <span
              className={styles.slotTime}
              onClick={() => setEditingDuration(true)}
              title="Clique para editar duração"
              role="button"
              tabIndex={0}
              aria-label="Editar tempo"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingDuration(true); } }}
            >{slot.durationMin} min ✏️</span>
          )}
          {level > 1 && (
            <>
              <button className={styles.slotMoveBtn} onClick={onMoveUp} disabled={!canMoveUp} title="Subir">↑</button>
              <button className={styles.slotMoveBtn} onClick={onMoveDown} disabled={!canMoveDown} title="Descer">↓</button>
            </>
          )}
        </div>
      </div>

      <input
        className={styles.slotInput}
        placeholder="Digite qualquer nome ou pesquise nas suas tarefas…"
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => { if (!query.trim() && todayTasks.length) setResults([]); }}
        onBlur={() => {
          if (query.trim() && query !== slot.title) {
            onChange({ ...slot, title: query.trim(), supabaseId: null });
          }
          setTimeout(() => setResults([]), 200);
        }}
      />

      {showTodaySuggestions && results.length === 0 && (
        <div className={styles.slotResults}>
          <div className={styles.slotResultsLabel}>📅 vence hoje</div>
          {todayTasks.map((t) => (
            <div key={t.id} className={styles.slotResultItem} onMouseDown={() => select(t)}>
              <span className={styles.slotResultIcon}>⚡</span>
              {t.title}
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className={styles.slotResults}>
          {results.map((t) => (
            <div key={t.id} className={styles.slotResultItem} onMouseDown={() => select(t)}>
              <span className={styles.slotResultIcon}>↳</span>
              {t.title}
            </div>
          ))}
        </div>
      )}

      <div className={styles.slotFooter}>
        {slot.title && (
          <span
            className={styles.slotClear}
            onClick={clear}
            role="button"
            tabIndex={0}
            aria-label="Remover tarefa"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clear(); } }}
          >× limpar</span>
        )}

        {/* ── Modos DURANTE a tarefa ── */}
        <div className={styles.slotHelperArea}>
          <span className={styles.slotHelperLabel}>🎯 Durante</span>
          {helperModeIds.map((modeId) => {
            const m = getModeById(modeId);
            if (!m) return null;
            return (
              <span key={modeId} className={styles.modeChip}>
                {m.emoji} {m.name}
                <button
                  className={styles.modeChipRemove}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange({ ...slot, helperModeIds: helperModeIds.filter((id) => id !== modeId) });
                  }}
                  title={`Remover ${m.name}`}
                  aria-label={`Remover ${m.name}`}
                >×</button>
              </span>
            );
          })}
          <button
            className={`${styles.slotHelperBtn} ${helperModeIds.length > 0 ? styles.slotHelperBtnActive : ""}`}
            onClick={() => setShowHelperPicker("durante")}
            title="Adicionar modo durante a tarefa"
          >
            {helperModeIds.length > 0 ? "+" : "+ Adicionar"}
          </button>
        </div>

        {/* ── Combo Presets ── */}
        {(helperModeIds.length >= 2 || presets.length > 0) && (
          <div className={styles.comboPresetsRow}>
            {helperModeIds.length >= 2 && (
              <button
                className={`${styles.comboPresetSaveBtn} ${savedFlash ? styles.comboPresetSaveBtnFlash : ""}`}
                onClick={saveCurrentCombo}
                title="Salvar este combo como preset"
              >
                {savedFlash ? "✓ Salvo!" : "💾 Salvar combo"}
              </button>
            )}
            {presets.map((p, i) => (
              <span
                key={i}
                className={`${styles.comboPresetChip} ${p.ids.join() === helperModeIds.join() ? styles.comboPresetChipActive : ""}`}
                onClick={() => applyPreset(p)}
                title={`Aplicar: ${p.label}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") applyPreset(p); }}
              >
                {p.ids.map((id) => getModeById(id)?.emoji ?? "").join("")}
                <button className={styles.comboPresetChipDelete} onClick={(e) => deletePreset(e, i)} title="Remover preset">×</button>
              </span>
            ))}
          </div>
        )}

        {/* ── Modos ENTRE tarefas ── apenas quando há mais de 1 tarefa (level > 1) */}
        {level > 1 && <div className={styles.slotHelperArea}>
          <span className={styles.slotHelperLabel}>☕ Entre</span>
          {interModeIds.map((modeId) => {
            const m = getModeById(modeId);
            if (!m) return null;
            return (
              <span key={modeId} className={`${styles.modeChip} ${styles.modeChipInter}`}>
                {m.emoji} {m.name}
                <button
                  className={styles.modeChipRemove}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange({ ...slot, interModeIds: interModeIds.filter((id) => id !== modeId) });
                  }}
                  title={`Remover ${m.name}`}
                  aria-label={`Remover ${m.name}`}
                >×</button>
              </span>
            );
          })}
          <button
            className={`${styles.slotHelperBtn} ${styles.slotHelperBtnInter} ${interModeIds.length > 0 ? styles.slotHelperBtnActive : ""}`}
            onClick={() => setShowHelperPicker("entre")}
            title="Adicionar modo entre tarefas"
          >
            {interModeIds.length > 0 ? "+" : "+ Adicionar"}
          </button>
        </div>}
      </div>

      {showHelperPicker === "durante" && (
        <HelperPickerModal
          currentIds={helperModeIds}
          usedModes={usedModes}
          suggestedModeId={suggestedModeId}
          filterType="durante"
          onSelect={(id) => {
            if (!helperModeIds.includes(id)) {
              onChange({ ...slot, helperModeIds: [...helperModeIds, id] });
            }
            setShowHelperPicker(false);
          }}
          onClose={() => setShowHelperPicker(false)}
        />
      )}

      {showHelperPicker === "entre" && (
        <HelperPickerModal
          currentIds={interModeIds}
          usedModes={usedModes}
          filterType="entre"
          onSelect={(id) => {
            if (!interModeIds.includes(id)) {
              onChange({ ...slot, interModeIds: [...interModeIds, id] });
            }
            setShowHelperPicker(false);
          }}
          onClose={() => setShowHelperPicker(false)}
        />
      )}
    </div>
  );
}

export default memo(TaskSlot);

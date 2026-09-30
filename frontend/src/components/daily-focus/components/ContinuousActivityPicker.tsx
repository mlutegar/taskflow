import styles from "../DailyFocus.module.css";
import {
  CONTINUOUS_PRESETS,
  type ContinuousActivity,
  type CompletedEntry,
} from "../../../lib/continuousActivity";

interface Props {
  /** Atividade contínua atual (ou null). */
  activity: ContinuousActivity | null;
  /** Última configuração usada (para "repetir"). */
  last: ContinuousActivity | null;
  /** Concluídas hoje — vira chips clicáveis para repetir. */
  completedToday?: CompletedEntry[];
  /** Grava um patch parcial na atividade atual (edição incremental de campos). */
  onSave: (patch: Partial<ContinuousActivity>) => void;
  /**
   * Escolha de um preset/repetição/concluída. Se fornecido, substitui a atividade
   * (zerando ticks/progress); caso contrário usa `onSave`. Usado na troca durante a sessão.
   */
  onPick?: (patch: Partial<ContinuousActivity>) => void;
  /** Limpa a atividade atual. */
  onClear: () => void;
  /** Chamado após escolher/definir uma atividade (ex.: fechar o picker). */
  afterPick?: () => void;
}

/**
 * Seletor reutilizável de atividade contínua (presets + repetir + concluídas de
 * hoje + campos de título/link/meta). Usado tanto na fase `select` quanto no
 * picker inline da fase `work` (concluir/trocar).
 */
export default function ContinuousActivityPicker({
  activity,
  last,
  completedToday = [],
  onSave,
  onPick,
  onClear,
  afterPick,
}: Props): JSX.Element {
  const hasTitle = Boolean(activity?.title);
  const pick = (patch: Partial<ContinuousActivity>): void => {
    (onPick ?? onSave)(patch);
    afterPick?.();
  };

  return (
    <>
      {/* Concluídas hoje — repetir com um clique */}
      {completedToday.length > 0 && (
        <div className={styles.contActPickerDone}>
          <span className={styles.contActPickerDoneLabel}>✓ Concluídas hoje:</span>
          {completedToday.map((c, i) => (
            <button
              key={`${c.title}-${i}`}
              type="button"
              className={styles.contActDoneChip}
              title={`Repetir: ${c.title}`}
              onClick={() => pick({ title: c.title, icon: c.icon, link: c.link, goalTarget: c.goalTarget, goalUnit: c.goalUnit })}
            >
              {c.icon || "🔄"} {c.title}
            </button>
          ))}
        </div>
      )}

      {/* Presets rápidos + repetir de ontem */}
      {!hasTitle && (
        <div className={styles.contActPresets}>
          {CONTINUOUS_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={styles.contActPreset}
              onClick={() => pick({ title: p.title, icon: p.icon, goalUnit: p.goalUnit, link: "", goalTarget: null })}
            >
              {p.icon} {p.title}
            </button>
          ))}
          {last && (
            <button
              type="button"
              className={`${styles.contActPreset} ${styles.contActPresetRepeat}`}
              onClick={() => pick({
                title: last.title, link: last.link, note: last.note,
                icon: last.icon, goalTarget: last.goalTarget, goalUnit: last.goalUnit,
              })}
              title="Repetir a última atividade contínua"
            >
              ↩ Repetir: {last.icon} {last.title}
            </button>
          )}
        </div>
      )}

      <input
        className={styles.contActFieldInput}
        type="text"
        placeholder="Ex.: revisar flashcards no Anki"
        value={activity?.title ?? ""}
        onChange={(e) => onSave({ title: e.target.value })}
      />

      {(activity?.title || activity?.link) && (
        <>
          <input
            className={styles.contActFieldInput}
            type="url"
            inputMode="url"
            placeholder="Link (opcional) — abre no celular também"
            value={activity?.link ?? ""}
            onChange={(e) => onSave({ link: e.target.value })}
          />
          <div className={styles.contActGoalRow}>
            <span className={styles.contActGoalLabel}>🎯 Meta (opcional):</span>
            <input
              className={styles.contActGoalInput}
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="20"
              value={activity?.goalTarget ?? ""}
              onChange={(e) => onSave({ goalTarget: e.target.value ? Number(e.target.value) : null })}
            />
            <input
              className={styles.contActGoalUnit}
              type="text"
              placeholder="cards"
              value={activity?.goalUnit ?? ""}
              onChange={(e) => onSave({ goalUnit: e.target.value })}
            />
            <button type="button" className={styles.contActClearBtn} onClick={onClear} title="Remover atividade contínua">
              ✕
            </button>
          </div>
        </>
      )}
    </>
  );
}

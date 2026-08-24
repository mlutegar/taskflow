import { useState, useEffect } from "react";
import { routinesApi } from "../api/routines";
import { useRoutines } from "../hooks/useRoutines";
import { useUndoDelete } from "../hooks/useUndoDelete";
import RoutineList from "../components/RoutineList";
import RoutineHeatmap from "../components/RoutineHeatmap";
import AddRoutineForm from "../components/AddRoutineForm";
import RoutineTemplates from "../components/RoutineTemplates";
import styles from "../App.module.css";

const ROUTINE_FILTERS: { label: string; value: string }[] = [
  { label: "Todas", value: "" },
  { label: "Pendentes", value: "pending" },
  { label: "Feitas hoje", value: "done" },
];

export default function RoutinesPage(): JSX.Element {
  const [routineFilter, setRoutineFilter]   = useState<string>("");
  const [showRoutineForm, setShowRoutineForm] = useState<boolean>(false);
  const [routineView, setRoutineView]       = useState<string>("list");

  const routinesHook = useRoutines(routineFilter);
  const {
    routines, routinesLoading, routinesError,
    removeRoutine, restoreRoutine,
    handleCompleteRoutine, handleUncompleteRoutine, handleDeleteRoutine,
    handleUpdateRoutine, handleCompleteRoutineForDate,
    handleAddProgress, handleAddRoutineChecklist,
    handleToggleRoutineChecklist, handleDeleteRoutineChecklist,
  } = routinesHook;

  const undoRoutineHook = useUndoDelete((id: unknown) => routinesApi.delete(id).catch(() => {}));
  const { undoTask: undoRoutine, handleDismiss: handleDismissRoutine } = undoRoutineHook;

  const handleCreateRoutine = async (data: unknown): Promise<void> => {
    await routinesHook.handleCreateRoutine(data);
    setShowRoutineForm(false);
  };

  const handleDeleteRoutineWithUndo = (id: unknown): void => {
    const routine = routines.find((r: any) => r.id === id);
    if (!routine) return;
    removeRoutine(id);
    undoRoutineHook.handleDeleteTask(routine);
  };

  const handleUndoDeleteRoutine = (): void => {
    const routine = undoRoutineHook.handleUndoDelete();
    if (routine) restoreRoutine(routine);
  };

  const doneTodayCnt   = routines.filter((r: any) => r.is_completed_today).length;
  const totalRoutineCnt = routines.length;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner} style={{ gridTemplateColumns: "1fr auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
            <span style={{ fontSize: 18 }}>🔄</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              Rotinas
              {totalRoutineCnt > 0 && (
                <span
                  className={`${styles.tabBadge} ${doneTodayCnt === totalRoutineCnt ? styles.tabBadgeDone : ""}`}
                  style={{ marginLeft: 8 }}
                >
                  {doneTodayCnt}/{totalRoutineCnt}
                </span>
              )}
            </span>
          </div>

          <div className={styles.addBtnWrap} style={{ borderLeft: "1px solid var(--border)" }}>
            <button
              className={styles.reloadBtn}
              onClick={() => window.location.reload()}
              title="Recarregar"
            >
              <span>🔄</span>
              <span className={styles.reloadText}>Atualizar</span>
            </button>
            <button
              className={`${styles.addBtn} ${showRoutineForm ? styles.addBtnCancel : styles.addBtnRoutine}`}
              onClick={() => setShowRoutineForm((v) => !v)}
            >
              {showRoutineForm ? "✕ Cancelar" : <><span>+</span> Nova rotina</>}
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <RoutineTemplates onCreateRoutine={handleCreateRoutine} />

        {showRoutineForm && (
          <div className={styles.formWrapper}>
            <AddRoutineForm onSubmit={handleCreateRoutine} onCancel={() => setShowRoutineForm(false)} />
          </div>
        )}

        <div className={styles.controls}>
          <div className={styles.filters}>
            {routineView === "list" && ROUTINE_FILTERS.map((f) => (
              <button
                key={f.value}
                className={`${styles.filterBtn} ${routineFilter === f.value ? styles.filterActive : ""}`}
                onClick={() => setRoutineFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className={styles.filters}>
            <button
              className={`${styles.filterBtn} ${routineView === "list" ? styles.filterActive : ""}`}
              onClick={() => setRoutineView("list")}
            >
              Lista
            </button>
            <button
              className={`${styles.filterBtn} ${routineView === "heatmap" ? styles.filterActive : ""}`}
              onClick={() => setRoutineView("heatmap")}
            >
              Heatmap
            </button>
          </div>
          {routineView === "list" && doneTodayCnt > 0 && (
            <span className={styles.routineProgress}>
              {doneTodayCnt} de {totalRoutineCnt} concluídas hoje
            </span>
          )}
        </div>

        {routinesLoading && <div className={styles.loading}>Carregando...</div>}
        {routinesError && <div className={styles.error}>Erro: {routinesError}</div>}
        {!routinesLoading && !routinesError && routineView === "list" && (
          <RoutineList
            routines={routines}
            onComplete={handleCompleteRoutine}
            onUncomplete={handleUncompleteRoutine}
            onCompleteForDate={handleCompleteRoutineForDate}
            onDelete={handleDeleteRoutineWithUndo}
            onUpdate={handleUpdateRoutine}
            onAddProgress={handleAddProgress}
            onAddChecklist={handleAddRoutineChecklist}
            onToggleChecklist={handleToggleRoutineChecklist}
            onDeleteChecklist={handleDeleteRoutineChecklist}
          />
        )}
        {!routinesLoading && !routinesError && routineView === "heatmap" && (
          <RoutineHeatmap routines={routines} />
        )}
      </main>

      {undoRoutine && (
        <UndoToast
          task={undoRoutine.task}
          expiresAt={undoRoutine.expiresAt}
          onUndo={handleUndoDeleteRoutine}
          onDismiss={handleDismissRoutine}
        />
      )}
    </div>
  );
}

interface UndoToastProps {
  task: any;
  expiresAt: number;
  onUndo: () => void;
  onDismiss: () => void;
}

function UndoToast({ task, expiresAt, onUndo, onDismiss }: UndoToastProps): JSX.Element {
  const [pct, setPct] = useState<number>(100);
  useEffect(() => {
    const total = expiresAt - Date.now();
    const interval = setInterval(() => {
      const remaining = expiresAt - Date.now();
      setPct(Math.max(0, (remaining / total) * 100));
      if (remaining <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return (
    <div className={styles.undoToast}>
      <div className={styles.undoBar} style={{ width: `${pct}%` }} />
      <div className={styles.undoContent}>
        <span className={styles.undoText}>🗑 <strong>{task.title}</strong> excluída (Rotina)</span>
        <div className={styles.undoActions}>
          <button className={styles.undoBtn} onClick={onUndo}>↩ Desfazer</button>
          <button className={styles.undoDismiss} onClick={onDismiss}>✕</button>
        </div>
      </div>
    </div>
  );
}

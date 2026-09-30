import { useTasks } from "../hooks/useTasks";
import { useRoutines } from "../hooks/useRoutines";
import ModesPanel from "../components/ModesPanel";
import styles from "../App.module.css";
import { SK } from "../lib/storageKeys";
import { storageGet } from "../lib/storage";
import { useActiveMode } from "../contexts/ActiveModeContext";

export default function ModesPage(): JSX.Element {
  // Dot reflete qualquer sessão ativa (modo único OU multi-card), reativo via contexto.
  const { hasActiveSession } = useActiveMode();

  const { tasks, handleCompleteTask, handleCreateTask, handleAddTaskChecklist, handleToggleTaskChecklist } = useTasks("", "due_date_asc");
  const { routines, handleCompleteRoutine, handleAddRoutineChecklist, handleToggleRoutineChecklist } = useRoutines("");

  const favCount = storageGet<string[]>(SK.MODES_FAVORITE, []).length;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner} style={{ gridTemplateColumns: "1fr auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
            <span style={{ fontSize: 18, position: "relative" }}>
              🎮
              {hasActiveSession && (
                <span
                  className={styles.activeSessionDot}
                  title="Sessão ativa"
                  style={{ position: "absolute", top: -2, right: -4 }}
                />
              )}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              Modos
              {favCount > 0 && (
                <span className={styles.tabBadge} style={{ marginLeft: 8 }}>{favCount}</span>
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
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <ModesPanel
          tasks={tasks}
          routines={routines}
          onCompleteTask={handleCompleteTask}
          onCompleteRoutine={handleCompleteRoutine}
          onAddTask={handleCreateTask}
          onAddChecklist={handleAddTaskChecklist}
          onToggleChecklist={handleToggleTaskChecklist}
          onAddRoutineChecklist={handleAddRoutineChecklist}
          onToggleRoutineChecklist={handleToggleRoutineChecklist}
        />
      </main>
    </div>
  );
}

import { useState } from "react";
import TaskSelector from "../TaskSelector";
import styles from "./session.module.css";

export default function MusicSession({ tasks, onCompleteTask, onClose }) {
  const [step, setStep] = useState("intro");
  const [selectedTask, setSelectedTask] = useState(null);
  const [completed, setCompleted] = useState(0);
  const [doneIds, setDoneIds] = useState(new Set());

  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  const completeTask = async () => {
    await onCompleteTask(selectedTask.id);
    setDoneIds((p) => new Set([...p, selectedTask.id]));
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    setStep(available.length - 1 === 0 ? "summary" : "post_task");
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerEmoji}>🎵</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>Music Mode</span>
          <span className={styles.headerSub}>{completed} tarefa(s) concluída(s)</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
        {step === "intro" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>Como funciona</div>
              <ol className={styles.stepList}>
                {["Abra o Spotify e passe por ~100 músicas", "Quando encontrar UMA que ressoa, volte aqui", "Selecione uma tarefa para fazer enquanto ouve", "Repita para a próxima música/tarefa"].map((s, i) => (
                  <li key={i} className={styles.stepItem}>
                    <span className={styles.stepNum}>{i + 1}</span>{s}
                  </li>
                ))}
              </ol>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("finding")}>
              🎧 Começar
            </button>
          </>
        )}

        {step === "finding" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎧 Encontre sua música</div>
              <div className={styles.promptText}>
                Abra o Spotify e passe por ~100 músicas. Quando encontrar UMA que realmente ressoa, volte aqui e clique abaixo.
              </div>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => available.length === 0 ? setStep("summary") : setStep("select_task")}
            >
              🎵 Encontrei minha música!
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>
              Encerrar sessão
            </button>
          </>
        )}

        {step === "select_task" && (
          <TaskSelector tasks={available} onSelect={(t) => { setSelectedTask(t); setStep("working"); }} onCancel={() => setStep("finding")} />
        )}

        {step === "working" && selectedTask && (
          <>
            <div className={styles.infoPill}>🎵 Música tocando — foco total!</div>
            <div className={styles.taskDisplay}>
              <span className={styles.taskName}>{selectedTask.title}</span>
              {selectedTask.description && <span className={styles.taskMeta}>{selectedTask.description}</span>}
            </div>
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={completeTask}>✅ Tarefa concluída!</button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("select_task")}>Trocar tarefa</button>
            </div>
          </>
        )}

        {step === "post_task" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>✓ Tarefa concluída!</div>
              <div className={styles.promptText}>Quer continuar com outra música e tarefa?</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("finding")}>🎵 Buscar próxima música</button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>Encerrar sessão</button>
          </>
        )}

        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>🎵</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>{completed > 0 ? `${completed} tarefa(s) concluída(s).` : "Nenhuma tarefa concluída."}</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}

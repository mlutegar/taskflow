import { useEffect, useRef, useState } from "react";
import ModalOverlay from "../../shared/ModalOverlay";
import { getEmotions, getEmotionById, type EmotionIntensity } from "../../../data/emotions";
import { getLastEmotionId } from "../../../lib/emotionLog";
import type { EmotionMoment } from "../../../types";
import styles from "./EmotionCheckModal.module.css";

interface Props {
  moment: EmotionMoment;
  onSelect: (emotionId: string, intensity?: EmotionIntensity) => void;
  onSkip: () => void;
  /** Fecha sozinho como "Pular" após N ms (0 = desativado). */
  autoDismissMs?: number;
}

const TITLES: Record<EmotionMoment, string> = {
  start: "Como você está se sentindo agora?",
  resume: "E agora, como você está se sentindo?",
  end: "Como você terminou esta tarefa?",
};

/**
 * Checkpoint emocional rápido, visual e opcional.
 * - Atalhos 1–7 selecionam a emoção; Esc/Pular fecham.
 * - Realça a última emoção usada (memória).
 * - Passo opcional de intensidade (leve/forte) após escolher.
 * - Auto-dismiss opcional para nunca dar sensação de bloqueio.
 */
export default function EmotionCheckModal({ moment, onSelect, onSkip, autoDismissMs = 12000 }: Props): React.ReactElement {
  const emotions = getEmotions();
  const lastId = getLastEmotionId();
  const [chosen, setChosen] = useState<string | null>(null);   // emoção escolhida (aguardando intensidade)
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);

  // Foco inicial no primeiro botão (acessibilidade)
  useEffect(() => {
    firstBtnRef.current?.focus();
  }, []);

  // Auto-dismiss (só enquanto ainda não escolheu — depois de escolher, o passo de intensidade é curto)
  useEffect(() => {
    if (!autoDismissMs || chosen) return;
    const t = setTimeout(onSkip, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, chosen, onSkip]);

  // Atalhos de teclado 1–7 (só na etapa de escolha da emoção)
  useEffect(() => {
    if (chosen) return;
    const handler = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && n <= emotions.length) {
        e.preventDefault();
        pick(emotions[n - 1].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, emotions]);

  const pick = (id: string): void => setChosen(id);

  const confirm = (intensity?: EmotionIntensity): void => {
    if (!chosen) return;
    onSelect(chosen, intensity);
  };

  const chosenEmotion = chosen ? getEmotionById(chosen) : null;

  return (
    <ModalOverlay onClose={onSkip}>
      <div
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[moment]}
      >
        <h3 className={styles.title}>{TITLES[moment]}</h3>

        {!chosen && (
          <>
            <div className={styles.grid}>
              {emotions.map((em, i) => (
                <button
                  key={em.id}
                  ref={i === 0 ? firstBtnRef : undefined}
                  type="button"
                  className={`${styles.btn} ${em.id === lastId ? styles.btnLast : ""}`}
                  style={em.color ? ({ ["--em-color"]: em.color } as React.CSSProperties) : undefined}
                  onClick={() => pick(em.id)}
                  aria-label={`${em.label}${em.id === lastId ? " (última escolha)" : ""} — atalho ${i + 1}`}
                >
                  <span className={styles.kbd} aria-hidden="true">{i + 1}</span>
                  <span className={styles.emoji}>{em.emoji}</span>
                  <span className={styles.label}>{em.label}</span>
                </button>
              ))}
            </div>
            <div className={styles.footer}>
              <button type="button" className={styles.skipBtn} onClick={onSkip}>
                Pular
              </button>
            </div>
          </>
        )}

        {chosen && chosenEmotion && (
          <div className={styles.intensityStep}>
            <div className={styles.chosenBadge} aria-live="polite">
              <span className={styles.chosenCheck}>✓</span>
              <span className={styles.emoji}>{chosenEmotion.emoji}</span>
              <span>{chosenEmotion.label}</span>
            </div>
            <p className={styles.intensityHint}>Com que intensidade? <span>(opcional)</span></p>
            <div className={styles.intensityBtns}>
              <button type="button" className={styles.intensityBtn} onClick={() => confirm("leve")}>Leve</button>
              <button type="button" className={styles.intensityBtn} onClick={() => confirm("forte")}>Forte</button>
            </div>
            <div className={styles.footer}>
              <button type="button" className={styles.skipBtn} onClick={() => confirm()}>
                Registrar sem intensidade
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

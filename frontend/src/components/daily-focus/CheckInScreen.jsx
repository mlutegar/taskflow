import { useState, useRef } from "react";
import { getEstados } from "./stateToMode";
import { getTopModesForEstado, getCheckinStreak, getCheckinLog } from "../../lib/checkinLog";
import CheckInConfigPanel from "./CheckInConfigPanel";
import styles from "./CheckInScreen.module.css";

/**
 * Tela de check-in de estado emocional/energético.
 * Props:
 *   allModes  — array de { id, emoji, name, tagline }
 *   onSelect  — (modeId, estadoId) → void  — usuário confirmou um modo
 *   onSkip    — () → void                  — usuário pulou o check-in
 */

function getBestHourHint() {
  try {
    const log = getCheckinLog();
    if (log.length < 5) return null;
    const hourCounts = {};
    for (const e of log) {
      if (!e.date) continue;
      const h = e.hour;
      if (h == null) continue;
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
    const entries = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;
    const bestHour = parseInt(entries[0][0]);
    return bestHour;
  } catch { return null; }
}

function getSuggestedEstadoByTime() {
  const hour = new Date().getHours();
  if (hour >= 5  && hour < 10) return "energizado"; // manhã cedo
  if (hour >= 10 && hour < 13) return "sem_foco";   // meio da manhã
  if (hour >= 13 && hour < 15) return "cansado";    // pós-almoço
  if (hour >= 15 && hour < 18) return "ansioso";    // tarde
  if (hour >= 18 && hour < 22) return "travado";    // noite
  return null; // madrugada — sem sugestão
}

export default function CheckInScreen({ allModes = [], onSelect, onSkip }) {
  const estados = getEstados();

  const [selectedEstado, setSelectedEstado] = useState(() => {
    try {
      const lastId = localStorage.getItem("taskflow.checkin.lastEstado");
      return lastId ? (estados.find((e) => e.id === lastId) ?? null) : null;
    } catch { return null; }
  });
  const [showAlt, setShowAlt]       = useState(false);
  const [leaving, setLeaving]       = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem("taskflow.checkin.onboarded"); } catch { return false; }
  });

  // Captura se o componente montou com um estado pré-selecionado (último estado salvo)
  const wasPreSelected = useRef(!!selectedEstado);

  const timeSuggestedId = getSuggestedEstadoByTime();
  const timeSuggested   = timeSuggestedId ? estados.find((e) => e.id === timeSuggestedId) : null;

  function getModeInfo(modeId) {
    return allModes.find((m) => m.id === modeId) || null;
  }

  function handleEstadoClick(estado) {
    if (estado.modeId === null) {
      // Estado neutro: pula direto para a seleção de tarefas
      try { localStorage.setItem("taskflow.checkin.lastEstado", estado.id); } catch {}
      setLeaving(true);
      setTimeout(() => onSkip(), 220);
      return;
    }
    if (selectedEstado?.id === estado.id) {
      setSelectedEstado(null);
      setShowAlt(false);
    } else {
      setSelectedEstado(estado);
      setShowAlt(false);
      try { localStorage.setItem("taskflow.checkin.lastEstado", estado.id); } catch {}
    }
  }

  // Animação de saída antes de chamar onSelect
  function handleSelect(modeId) {
    setLeaving(true);
    setTimeout(() => onSelect(modeId, selectedEstado?.id), 220);
  }

  // Recomendação personalizada: usa histórico se disponível
  const personalTop = selectedEstado ? getTopModesForEstado(selectedEstado.id) : [];
  const personalModeId = personalTop.length >= 2 ? personalTop[0].modeId : null; // só personaliza se tiver histórico suficiente
  const effectiveModeId = personalModeId ?? selectedEstado?.modeId;
  const isPersonalized = !!personalModeId && personalModeId !== selectedEstado?.modeId;

  const mainMode = selectedEstado ? getModeInfo(effectiveModeId) : null;
  const altMode  = selectedEstado ? getModeInfo(selectedEstado.modeIdAlt) : null;

  const checkinStreak = getCheckinStreak();

  const bestHour = getBestHourHint();
  const currentHour = new Date().getHours();
  const isNearBestHour = bestHour != null && Math.abs(currentHour - bestHour) <= 1;

  return (
    <div className={`${styles.wrap} ${leaving ? styles.wrapLeaving : ""}`} data-estado={selectedEstado?.id ?? ""}>

      {/* Onboarding banner — primeira visita */}
      {showOnboarding && (
        <div className={styles.onboardingBanner}>
          <span className={styles.onboardingIcon}>💡</span>
          <div className={styles.onboardingText}>
            <strong>Como você está agora?</strong>
            <span>Isso nos ajuda a sugerir o melhor modo de foco para você. Leva 2 segundos!</span>
          </div>
          <button
            className={styles.onboardingClose}
            onClick={() => {
              setShowOnboarding(false);
              try { localStorage.setItem("taskflow.checkin.onboarded", "1"); } catch {}
            }}
          >✕</button>
        </div>
      )}

      {/* Título + botão de configuração */}
      <div>
        <div className={styles.titleRow}>
          <div className={styles.title}>Como você está agora?</div>
          <button
            className={styles.configBtn}
            onClick={() => setShowConfig(true)}
            title="Configurar mapeamentos estado → modo"
          >⚙️</button>
        </div>
        <div className={styles.sub}>
          Escolha seu estado atual e veja o modo de apoio mais adequado para o momento.
        </div>
        {wasPreSelected.current && selectedEstado && (
          <div className={styles.lastStateBadge}>↩ último estado salvo</div>
        )}
        {checkinStreak >= 2 && (
          <div className={styles.checkinStreak}>🧠 {checkinStreak} dias seguidos de check-in</div>
        )}
      </div>

      {/* Sugestão contextual por horário (só aparece se nenhum estado selecionado) */}
      {timeSuggested && !selectedEstado && (
        <div className={styles.timeTip}>
          🕐 Comum agora:{" "}
          <button className={styles.timeTipBtn} onClick={() => handleEstadoClick(timeSuggested)}>
            {timeSuggested.emoji} {timeSuggested.label}
          </button>
        </div>
      )}
      {isNearBestHour && (
        <div className={styles.hourHint}>
          ⏰ Você costuma ser mais produtivo por volta das {bestHour}h — hora certa!
        </div>
      )}

      {/* Grade de estados */}
      <div className={styles.grid}>
        {estados.map((estado) => (
          <button
            key={estado.id}
            className={`${styles.estadoBtn} ${selectedEstado?.id === estado.id ? styles.estadoBtnActive : ""}`}
            onClick={() => handleEstadoClick(estado)}
          >
            <span className={styles.estadoEmoji}>{estado.emoji}</span>
            <span className={styles.estadoLabel}>{estado.label}</span>
          </button>
        ))}
      </div>

      {/* Card de recomendação */}
      {selectedEstado && mainMode && (
        <div className={styles.recoCard}>
          <div className={styles.recoHeader}>
            <div style={{ flex: 1 }}>
              <div className={styles.recoHeaderLabel}>Recomendado para você</div>
            </div>
            <span className={styles.recoBadge}>
              {isPersonalized ? "📊 seu histórico" : "✨ recomendado"}
            </span>
          </div>

          <div className={styles.recoBody}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className={styles.recoEmoji}>{mainMode.emoji}</span>
              <span className={styles.recoName}>{mainMode.name}</span>
            </div>

            <div className={styles.recoMotivo}>
              <div className={styles.recoMotivoLabel}>Por que usar agora</div>
              {selectedEstado.motivo}
            </div>

            <button
              className={styles.recoUseBtn}
              onClick={() => handleSelect(effectiveModeId)}
            >
              Usar {mainMode.emoji} {mainMode.name} →
            </button>
          </div>

          {/* Alternativa expansível */}
          {altMode && (
            <div className={styles.altSection}>
              <button
                className={styles.altToggle}
                onClick={() => setShowAlt((v) => !v)}
              >
                Ver alternativa
                <span className={`${styles.altArrow} ${showAlt ? styles.altArrowOpen : ""}`}>▼</span>
              </button>

              {showAlt && (
                <div className={styles.altCard}>
                  <span className={styles.altEmoji}>{altMode.emoji}</span>
                  <div className={styles.altInfo}>
                    <div className={styles.altName}>{altMode.name}</div>
                    <div className={styles.altMotivo}>{selectedEstado.motivoAlt}</div>
                  </div>
                  <button
                    className={styles.altUseBtn}
                    onClick={() => handleSelect(selectedEstado.modeIdAlt)}
                  >
                    Usar este
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pular */}
      <div className={styles.skipRow}>
        <button className={styles.skipBtn} onClick={onSkip}>
          Pular / já sei o que quero →
        </button>
      </div>

      {/* Painel de configuração de mapeamentos */}
      {showConfig && (
        <CheckInConfigPanel
          allModes={allModes}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}

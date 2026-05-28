import { useState, useEffect } from "react";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

const COLOR = "#2d9bf0";

export default function TabHopSession({ onClose }) {
  const { saved, persist, clearSaved } = useSessionPersist("tabhop");

  const [step,         setStep]         = useState(saved?.step         ?? "context");
  const [tabs,         setTabs]         = useState(saved?.tabs         ?? []);
  const [currentIdx,   setCurrentIdx]   = useState(saved?.currentIdx   ?? 0);
  const [cycle,        setCycle]        = useState(saved?.cycle        ?? 0);
  const [tabInput,     setTabInput]     = useState("");
  const [wasRestored,  setWasRestored]  = useState(!!saved);

  useEffect(() => {
    if (step === "summary") return;
    persist({ step, tabs, currentIdx, cycle });
  }, [step, tabs, currentIdx, cycle]); // eslint-disable-line

  const handleClose = () => { clearSaved(); onClose(); };

  const addTab = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setTabs((prev) => [...prev, { name: trimmed, visits: 0 }]);
    setTabInput("");
  };

  const startRotation = () => {
    setCurrentIdx(0);
    setStep("rotating");
  };

  const nextTab = () => {
    setTabs((prev) => prev.map((t, i) => i === currentIdx ? { ...t, visits: t.visits + 1 } : t));
    const next = currentIdx + 1;
    if (next >= tabs.length) {
      setCycle((c) => c + 1);
      setStep("cycle_done");
    } else {
      setCurrentIdx(next);
    }
  };

  const newCycle = () => {
    setCurrentIdx(0);
    setStep("rotating");
  };

  const confirmAddTab = () => {
    setStep("add_tab");
  };

  const finishAddTab = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newTab = { name: trimmed, visits: 0 };
    setTabs((prev) => [...prev, newTab]);
    setTabInput("");
    setCurrentIdx(tabs.length); // next index = new tab position
    setStep("rotating");
  };

  const currentTab = tabs[currentIdx];
  const totalVisits = tabs.reduce((s, t) => s + t.visits, 0);

  return (
    <div className={styles.root}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <span className={styles.headerEmoji}>📲</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>Tab Hop</span>
          <span className={styles.headerSub}>
            {cycle > 0 ? `Ciclo ${cycle + 1}` : "Configurando"} • {tabs.length} aba{tabs.length !== 1 ? "s" : ""} • {totalVisits} visita{totalVisits !== 1 ? "s" : ""}
          </span>
        </div>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>
      </div>

      <div className={styles.body}>

        {wasRestored && step !== "context" && step !== "summary" && (
          <div className={styles.resumeBanner}>
            ↩ Sessão restaurada — Ciclo {cycle + 1}, {tabs.length} abas
            <button className={styles.resumeDismiss} onClick={() => setWasRestored(false)}>✕</button>
          </div>
        )}

        {/* ── Confirmação de contexto ── */}
        {step === "context" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>📲 Modo criado para transporte</div>
              <div className={styles.promptText}>
                Este modo funciona melhor quando você está no celular em transporte — ônibus, metrô, esperas. A ideia é ter vários apps abertos e ir fazendo um pouco de cada, rotacionando entre eles.
              </div>
            </div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>Como funciona</div>
              <div className={styles.promptText}>
                1. Abra os apps no celular que você vai trabalhar hoje.<br />
                2. Adicione cada um aqui como uma "aba".<br />
                3. O modo mostra qual app focar agora.<br />
                4. Faz um pouco → toca em "Próxima aba →" → passa para o seguinte.<br />
                5. Quando terminar todos, pode adicionar um novo app ou reiniciar o ciclo.<br />
                6. Ao final, lembrete de git push.
              </div>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ background: COLOR, borderColor: COLOR }}
              onClick={() => setStep("setup")}
            >
              📲 Entendi — adicionar apps
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleClose}>
              Não agora
            </button>
          </>
        )}

        {/* ── Setup: adicionar abas ── */}
        {step === "setup" && (
          <>
            <div className={styles.infoPill} style={{ color: COLOR, borderColor: `${COLOR}44` }}>
              📲 Abra os apps no celular e adicione-os aqui
            </div>

            {tabs.length > 0 && (
              <div className={styles.savedTaskList}>
                <span className={styles.sectionLabel}>Apps adicionados</span>
                {tabs.map((t, i) => (
                  <div key={i} className={styles.savedTask}>
                    <span className={styles.savedTaskTitle}>📱 {i + 1}. {t.name}</span>
                    <button
                      className={styles.removeTabBtn}
                      onClick={() => setTabs((prev) => prev.filter((_, idx) => idx !== i))}
                      title="Remover"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.actions}>
              <input
                className={styles.input}
                value={tabInput}
                onChange={(e) => setTabInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTab(tabInput); }}
                placeholder="Nome do app (ex: Notion, Figma, GitHub…)"
                autoFocus
              />
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                disabled={!tabInput.trim()}
                onClick={() => addTab(tabInput)}
              >
                + Adicionar aba
              </button>
            </div>

            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ background: COLOR, borderColor: COLOR }}
              disabled={tabs.length < 2}
              onClick={startRotation}
            >
              {tabs.length < 2
                ? `Adicione pelo menos 2 abas (${tabs.length}/2)`
                : `▶ Iniciar rotação com ${tabs.length} aba${tabs.length !== 1 ? "s" : ""}`}
            </button>
          </>
        )}

        {/* ── Rotacionando ── */}
        {step === "rotating" && currentTab && (
          <>
            {/* Barra de progresso do ciclo */}
            <div className={tabHopStyles.cycleBar}>
              {tabs.map((t, i) => (
                <div
                  key={i}
                  className={`${tabHopStyles.cycleSlot} ${i === currentIdx ? tabHopStyles.cycleSlotActive : ""} ${i < currentIdx ? tabHopStyles.cycleSlotDone : ""}`}
                  style={i === currentIdx ? { background: COLOR } : {}}
                  title={t.name}
                />
              ))}
            </div>
            <div className={styles.infoPill} style={{ color: COLOR, borderColor: `${COLOR}44` }}>
              Aba {currentIdx + 1} de {tabs.length} — Ciclo {cycle + 1}
            </div>

            <div className={styles.taskDisplay}>
              <span className={styles.taskName} style={{ fontSize: "22px" }}>
                📱 {currentTab.name}
              </span>
              <span className={styles.taskMeta}>
                Faça um pouco aqui. Quando terminar, passe para a próxima aba.
              </span>
              {currentTab.visits > 0 && (
                <span className={styles.taskMeta} style={{ color: COLOR }}>
                  ↩ {currentTab.visits} visita{currentTab.visits !== 1 ? "s" : ""} anteriores
                </span>
              )}
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                style={{ background: COLOR, borderColor: COLOR }}
                onClick={nextTab}
              >
                {currentIdx + 1 < tabs.length
                  ? `→ Próxima aba: ${tabs[currentIdx + 1].name}`
                  : "✓ Última aba — concluir ciclo"}
              </button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("git_push")}>
                ⏹ Encerrar sessão
              </button>
            </div>
          </>
        )}

        {/* ── Ciclo concluído ── */}
        {step === "cycle_done" && (
          <>
            <div className={styles.summaryBox} style={{ borderColor: `${COLOR}44` }}>
              <span className={styles.summaryEmoji}>🔄</span>
              <div className={styles.summaryTitle}>Ciclo {cycle} completo!</div>
              <div className={styles.summaryText}>
                Você passou por todas as {tabs.length} abas.{" "}
                {totalVisits} visita{totalVisits !== 1 ? "s" : ""} no total.
              </div>
            </div>

            <div className={styles.savedTaskList}>
              <span className={styles.sectionLabel}>Abas neste ciclo</span>
              {tabs.map((t, i) => (
                <div key={i} className={styles.savedTask}>
                  <span className={styles.savedTaskTitle}>
                    📱 {t.name}
                    <span style={{ color: COLOR, marginLeft: 8, fontSize: "11px" }}>
                      {t.visits} visita{t.visits !== 1 ? "s" : ""}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ background: COLOR, borderColor: COLOR }}
              onClick={newCycle}
            >
              🔄 Novo ciclo — mesmas abas
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={confirmAddTab}>
              + Adicionar nova aba ao ciclo
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("git_push")}>
              ⏹ Encerrar e fazer git push
            </button>
          </>
        )}

        {/* ── Adicionar nova aba ── */}
        {step === "add_tab" && (
          <>
            <div className={styles.infoPill} style={{ color: COLOR, borderColor: `${COLOR}44` }}>
              + Nova aba para o próximo ciclo
            </div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>Qual app você quer adicionar?</div>
              <div className={styles.promptText}>
                Ele entra no final da fila e será o próximo na rotação.
              </div>
            </div>
            <div className={styles.actions}>
              <input
                className={styles.input}
                value={tabInput}
                onChange={(e) => setTabInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && tabInput.trim()) finishAddTab(tabInput); }}
                placeholder="Nome do app…"
                autoFocus
              />
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                style={{ background: COLOR, borderColor: COLOR }}
                disabled={!tabInput.trim()}
                onClick={() => finishAddTab(tabInput)}
              >
                + Adicionar e ir para esta aba
              </button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => { setStep("cycle_done"); setTabInput(""); }}>
                ← Voltar
              </button>
            </div>
          </>
        )}

        {/* ── Git push ── */}
        {step === "git_push" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>📤 Lembrete: git push</div>
              <div className={styles.promptText}>
                Você terminou a sessão. Antes de fechar os apps, faça o commit e push de tudo que trabalhou hoje.
              </div>
            </div>
            <div className={styles.savedTaskList}>
              <span className={styles.sectionLabel}>Sessão resumida</span>
              {tabs.map((t, i) => (
                <div key={i} className={styles.savedTask}>
                  <span className={styles.savedTaskTitle}>
                    📱 {t.name}
                    <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: "11px" }}>
                      {t.visits} visita{t.visits !== 1 ? "s" : ""}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <button
              className={`${styles.btn} ${styles.btnSuccess}`}
              onClick={() => setStep("summary")}
            >
              ✓ Git push feito — encerrar
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>
              Pular — encerrar assim mesmo
            </button>
          </>
        )}

        {/* ── Sumário ── */}
        {step === "summary" && (
          <>
            <div className={styles.summaryBox} style={{ borderColor: `${COLOR}44` }}>
              <span className={styles.summaryEmoji}>📲</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>
                {cycle} ciclo{cycle !== 1 ? "s" : ""} • {tabs.length} aba{tabs.length !== 1 ? "s" : ""} • {totalVisits} visita{totalVisits !== 1 ? "s" : ""} no total
              </div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClose}>
              Fechar
            </button>
          </>
        )}

      </div>
    </div>
  );
}

// Estilos inline para elementos específicos do Tab Hop
const tabHopStyles = {
  cycleBar: "cycleBar",
  cycleSlot: "cycleSlot",
  cycleSlotActive: "cycleSlotActive",
  cycleSlotDone: "cycleSlotDone",
};

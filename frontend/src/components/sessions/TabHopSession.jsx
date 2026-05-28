import { useState, useEffect } from "react";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

const COLOR = "#2d9bf0";
const COLOR_BG = "rgba(45,155,240,0.08)";

export default function TabHopSession({ onClose }) {
  const { saved, persist, clearSaved } = useSessionPersist("tabhop");

  const [step,        setStep]        = useState(saved?.step        ?? "context");
  const [tabs,        setTabs]        = useState(saved?.tabs        ?? []);
  const [currentIdx,  setCurrentIdx]  = useState(saved?.currentIdx  ?? 0);
  const [cycle,       setCycle]       = useState(saved?.cycle       ?? 0);
  const [tabInput,    setTabInput]    = useState("");
  const [wasRestored, setWasRestored] = useState(!!saved);

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

  const finishAddTab = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const insertIdx = tabs.length;
    setTabs((prev) => [...prev, { name: trimmed, visits: 0 }]);
    setTabInput("");
    setCurrentIdx(insertIdx);
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
            {cycle > 0 ? `Ciclo ${cycle + 1}` : "Configurando"} • {tabs.length} aba{tabs.length !== 1 ? "s" : ""}{totalVisits > 0 ? ` • ${totalVisits} visitas` : ""}
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

        {/* ── Contexto ── */}
        {step === "context" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>📲 Modo para transporte e celular</div>
              <div className={styles.promptText}>
                Este modo funciona melhor no celular durante deslocamentos — ônibus, metrô, esperas. Você tem vários apps abertos e vai fazendo um pouco de cada, rotacionando entre eles.
              </div>
            </div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>Como funciona</div>
              <div className={styles.promptText}>
                <strong>1.</strong> Abra os apps que vai usar hoje.<br />
                <strong>2.</strong> Adicione cada um aqui como uma "aba".<br />
                <strong>3.</strong> O modo indica qual app focar agora.<br />
                <strong>4.</strong> Faz um pouco → "Próxima aba →" → passa para o seguinte.<br />
                <strong>5.</strong> Ao completar todas: novo ciclo, ou adiciona uma aba nova.<br />
                <strong>6.</strong> No final: lembrete de git push.
              </div>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ background: COLOR }}
              onClick={() => setStep("setup")}
            >
              📲 Entendi — vamos configurar
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleClose}>
              Não agora
            </button>
          </>
        )}

        {/* ── Setup ── */}
        {step === "setup" && (
          <>
            <div className={styles.infoPill} style={{ color: COLOR, borderColor: `${COLOR}55` }}>
              📱 Abra os apps e adicione-os aqui
            </div>

            {tabs.length > 0 && (
              <div className={styles.savedTaskList}>
                <span className={styles.sectionLabel}>Apps na rotação</span>
                {tabs.map((t, i) => (
                  <div key={i} className={styles.savedTask}>
                    <span className={styles.savedTaskTitle}>📱 {i + 1}. {t.name}</span>
                    <button
                      onClick={() => setTabs((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "12px", padding: "2px 6px", borderRadius: "4px" }}
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
              style={{ background: COLOR }}
              disabled={tabs.length < 2}
              onClick={() => { setCurrentIdx(0); setStep("rotating"); }}
            >
              {tabs.length < 2
                ? `Adicione pelo menos 2 abas (${tabs.length}/2)`
                : `▶ Iniciar com ${tabs.length} aba${tabs.length !== 1 ? "s" : ""}`}
            </button>
          </>
        )}

        {/* ── Rotacionando ── */}
        {step === "rotating" && currentTab && (
          <>
            {/* Barra visual de progresso do ciclo */}
            <div style={{ display: "flex", gap: "4px", padding: "0 2px" }}>
              {tabs.map((t, i) => (
                <div
                  key={i}
                  title={t.name}
                  style={{
                    flex: 1,
                    height: "5px",
                    borderRadius: "3px",
                    background: i < currentIdx
                      ? `${COLOR}60`
                      : i === currentIdx
                      ? COLOR
                      : "var(--border)",
                    transition: "background 0.2s",
                  }}
                />
              ))}
            </div>

            <div className={styles.infoPill} style={{ color: COLOR, borderColor: `${COLOR}55` }}>
              Aba {currentIdx + 1} / {tabs.length} — Ciclo {cycle + 1}
            </div>

            <div className={styles.taskDisplay}>
              <span className={styles.taskName} style={{ fontSize: "20px" }}>
                📱 {currentTab.name}
              </span>
              <span className={styles.taskMeta}>
                Faça um pouco aqui. Quando terminar, passe para a próxima aba.
              </span>
              {currentTab.visits > 0 && (
                <span className={styles.taskMeta} style={{ color: COLOR, marginTop: "2px" }}>
                  ↩ {currentTab.visits} visita{currentTab.visits !== 1 ? "s" : ""} anteriores nesta aba
                </span>
              )}
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                style={{ background: COLOR }}
                onClick={nextTab}
              >
                {currentIdx + 1 < tabs.length
                  ? `→ Próxima: ${tabs[currentIdx + 1].name}`
                  : "✓ Última aba — fechar ciclo"}
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
            <div className={styles.summaryBox} style={{ borderColor: `${COLOR}44`, background: COLOR_BG }}>
              <span className={styles.summaryEmoji}>🔄</span>
              <div className={styles.summaryTitle}>Ciclo {cycle} completo!</div>
              <div className={styles.summaryText}>
                Você passou por todas as {tabs.length} abas. {totalVisits} visita{totalVisits !== 1 ? "s" : ""} acumuladas.
              </div>
            </div>

            <div className={styles.savedTaskList}>
              <span className={styles.sectionLabel}>Abas deste ciclo</span>
              {tabs.map((t, i) => (
                <div key={i} className={styles.savedTask}>
                  <span className={styles.savedTaskTitle}>
                    📱 {t.name}
                    <span style={{ color: COLOR, marginLeft: 8, fontSize: "11px", fontWeight: 600 }}>
                      {t.visits}×
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ background: COLOR }}
              onClick={() => { setCurrentIdx(0); setStep("rotating"); }}
            >
              🔄 Novo ciclo com as mesmas abas
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("add_tab")}>
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
            <div className={styles.infoPill} style={{ color: COLOR, borderColor: `${COLOR}55` }}>
              + Nova aba — ela entra em seguida na rotação
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
                style={{ background: COLOR }}
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
              <div className={styles.promptTitle}>📤 Hora do git push</div>
              <div className={styles.promptText}>
                Você terminou a sessão. Antes de fechar os apps, faça commit e push de tudo que trabalhou.
              </div>
            </div>

            <div className={styles.savedTaskList}>
              <span className={styles.sectionLabel}>Resumo da sessão</span>
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
              <div className={styles.savedTask}>
                <span className={styles.savedTaskTitle} style={{ color: "var(--text-muted)" }}>
                  🔄 {cycle} ciclo{cycle !== 1 ? "s" : ""} completo{cycle !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={() => setStep("summary")}>
              ✓ Git push feito — encerrar
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>
              Pular — encerrar mesmo assim
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

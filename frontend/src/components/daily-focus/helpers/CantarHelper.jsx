import { useState, useEffect, useRef } from "react";
import { getRandomSuggestion, addAlbum, removeAlbum, getList } from "../../../lib/singList";
import { logActivation } from "../../../lib/modeActivations";
import styles from "../DailyFocus.module.css";

export const DEFAULT_STATE = {
  suggestion: null,   // null = carrega no useEffect
  done: false,
  cantadas: [],       // histórico de músicas cantadas na sessão
  showManage: false,  // painel de gerenciar lista
};

/** Tenta ler o nome do personagem RPG (único "nome de usuário" disponível no app). */
function getUserName() {
  try {
    const char = JSON.parse(localStorage.getItem("taskflow_rpg_save"));
    return char?.name || null;
  } catch {
    return null;
  }
}

export default function CantarHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };

  const [inputVal, setInputVal] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false); // flash "✓ Salvo"
  const [animate, setAnimate] = useState(false);             // flash no card ao reroll
  const [albumList, setAlbumList] = useState(() => getList());
  const feedbackTimer = useRef(null);

  const userName = getUserName();

  // ── Inicialização: carrega sugestão apenas uma vez ──
  useEffect(() => {
    if (!s.suggestion) {
      onChange({ ...s, suggestion: getRandomSuggestion(null) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Atalho Enter → "Já cantei" (quando não está preenchendo inputs) ──
  useEffect(() => {
    if (s.done || showAdd) return;
    const handler = (e) => {
      if (
        e.key === "Enter" &&
        e.target.tagName !== "INPUT" &&
        e.target.tagName !== "TEXTAREA"
      ) {
        handleMarkDone();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const triggerAnimate = () => {
    setAnimate(false);
    // força re-trigger da animação
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
  };

  const reroll = () => {
    const next = getRandomSuggestion(s.suggestion);
    triggerAnimate();
    onChange({ ...s, suggestion: next, done: false });
  };

  const handleMarkDone = () => {
    if (!s.suggestion) return;
    logActivation("cantar");
    const cantadas = [...(s.cantadas || []), s.suggestion];
    onChange({ ...s, done: true, cantadas });
  };

  const handleCantarOutra = () => {
    const next = getRandomSuggestion(s.suggestion);
    triggerAnimate();
    onChange({ ...s, suggestion: next, done: false });
  };

  // ── Adicionar álbum ──
  const handleAddAlbum = () => {
    const clean = inputVal.trim();
    if (!clean) return;
    addAlbum(clean);
    const updated = getList();
    setAlbumList(updated);
    setInputVal("");
    setShowAdd(false);
    // feedback visual
    clearTimeout(feedbackTimer.current);
    setSavedFeedback(true);
    feedbackTimer.current = setTimeout(() => setSavedFeedback(false), 2000);
    // atualiza sugestão se ainda não tem uma
    if (!s.suggestion) onChange({ ...s, suggestion: clean });
  };

  // ── Remover álbum ──
  const handleRemoveAlbum = (name) => {
    removeAlbum(name);
    const updated = getList();
    setAlbumList(updated);
    // Se a sugestão atual foi removida, troca
    if (s.suggestion === name) {
      onChange({ ...s, suggestion: getRandomSuggestion(null) });
    }
  };

  const suggestion = s.suggestion || "—";
  const headline = userName
    ? `${userName}, tá difícil focar? Canta essa 🎤`
    : "Tá difícil focar? Canta essa 🎤";

  return (
    <div className={styles.helperPanelBody}>

      {/* ── Card de sugestão ── */}
      <div
        style={{
          background: "rgba(224,103,155,0.10)",
          border: "1px solid rgba(224,103,155,0.30)",
          borderRadius: "var(--radius)",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          transition: "opacity 0.15s",
          animation: animate ? "cantarFlash 0.3s ease" : "none",
        }}
      >
        <div style={{ fontSize: "11px", color: "#e0679b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {headline}
        </div>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
          {suggestion}
        </div>
      </div>

      {/* ── Ações ── */}
      {!s.done ? (
        <div className={styles.helperRow}>
          <button className={styles.helperSmallBtn} onClick={reroll} style={{ flex: 1 }}>
            🔀 Outra
          </button>
          <button
            className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`}
            onClick={handleMarkDone}
            style={{ flex: 1 }}
            title="Atalho: Enter"
          >
            ✅ Já cantei
          </button>
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            fontSize: "13px",
            color: "var(--text-muted)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: "20px", marginBottom: "4px" }}>🎉</div>
          Boa! Agora de volta ao foco.
          <div style={{ marginTop: "8px" }}>
            <button className={styles.helperSmallBtn} onClick={handleCantarOutra}>
              🔀 Cantar outra
            </button>
          </div>
        </div>
      )}

      {/* ── Histórico da sessão ── */}
      {(s.cantadas || []).length > 0 && (
        <div>
          <div className={styles.helperInputLabel}>
            🎵 Cantadas nesta sessão ({s.cantadas.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {s.cantadas.map((item, i) => (
              <div
                key={i}
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "5px 10px",
                }}
              >
                ✓ {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Gerenciar lista ── */}
      <div>
        <div className={styles.helperRow}>
          <button
            className={styles.helperSmallBtn}
            onClick={() => { setShowAdd(false); onChange({ ...s, showManage: !s.showManage }); }}
            style={{ flex: 1, fontSize: "11px" }}
          >
            {s.showManage ? "✕ Fechar lista" : `📋 Minha lista (${albumList.length})`}
          </button>
          {!s.showManage && (
            <button
              className={styles.helperSmallBtn}
              onClick={() => { onChange({ ...s, showManage: false }); setShowAdd(!showAdd); }}
              style={{ flex: 1, fontSize: "11px" }}
            >
              {showAdd ? "✕ Cancelar" : "➕ Adicionar"}
            </button>
          )}
        </div>

        {/* Input de adicionar */}
        {showAdd && !s.showManage && (
          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div className={styles.helperRow}>
              <input
                className={styles.helperInput}
                placeholder='Ex: Álbum "Híbrido" - Projota'
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddAlbum()}
                autoFocus
              />
              <button
                className={`${styles.helperSmallBtn} ${inputVal.trim() ? styles.helperSmallBtnActive : ""}`}
                onClick={handleAddAlbum}
                disabled={!inputVal.trim()}
              >
                Salvar
              </button>
            </div>
            {savedFeedback && (
              <div style={{ fontSize: "11px", color: "#4ecca3", fontWeight: 600 }}>
                ✓ Álbum salvo na lista!
              </div>
            )}
          </div>
        )}

        {/* Flash de confirmação quando salvo com a lista fechada */}
        {savedFeedback && !showAdd && (
          <div style={{ marginTop: "6px", fontSize: "11px", color: "#4ecca3", fontWeight: 600 }}>
            ✓ Álbum salvo na lista!
          </div>
        )}

        {/* Lista com remoção */}
        {s.showManage && (
          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {albumList.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "8px" }}>
                Lista vazia — adicione seu primeiro álbum.
              </div>
            ) : (
              albumList.map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "6px 10px",
                  }}
                >
                  <span style={{ flex: 1, fontSize: "12px", color: "var(--text)" }}>{item}</span>
                  <button
                    onClick={() => handleRemoveAlbum(item)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "14px",
                      padding: "0 2px",
                      lineHeight: 1,
                    }}
                    title="Remover da lista"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
            <button
              className={styles.helperSmallBtn}
              onClick={() => setShowAdd(true)}
              style={{ marginTop: "4px", fontSize: "11px" }}
            >
              ➕ Adicionar novo
            </button>
            {showAdd && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div className={styles.helperRow}>
                  <input
                    className={styles.helperInput}
                    placeholder='Ex: Álbum "Híbrido" - Projota'
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddAlbum()}
                    autoFocus
                  />
                  <button
                    className={`${styles.helperSmallBtn} ${inputVal.trim() ? styles.helperSmallBtnActive : ""}`}
                    onClick={handleAddAlbum}
                    disabled={!inputVal.trim()}
                  >
                    Salvar
                  </button>
                </div>
                {savedFeedback && (
                  <div style={{ fontSize: "11px", color: "#4ecca3", fontWeight: 600 }}>
                    ✓ Álbum salvo!
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Keyframe da animação de reroll (injetado inline) ── */}
      <style>{`
        @keyframes cantarFlash {
          0%   { opacity: 0.3; transform: scale(0.98); }
          100% { opacity: 1;   transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

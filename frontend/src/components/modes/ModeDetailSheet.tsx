import { useEffect, useState } from "react";
import ModalOverlay from "../shared/ModalOverlay";
import { modeCategory, categoryColor, TYPE_LABEL } from "../../lib/modeUtils";
import { useDialog } from "../../lib/useDialog";
import { getModeSuccessRate, getBestHourForMode } from "../../lib/sessionUsageLog";
import styles from "./ModeDetailSheet.module.css";

interface ModeClass {
  emoji?: string;
  name?: string;
  desc?: string;
  color?: string;
}

interface ModeLike {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  color?: string;
  colorBg?: string;
  category?: string;
  type?: string;
  context?: string[];
  prerequisite?: string;
  whyItWorks?: string;
  whenToUse?: string;
  steps?: string[];
  tips?: string;
  classes?: ModeClass[];
  [key: string]: unknown;
}

interface TodayUsage {
  count: number;
  lastHour: number;
}

interface ModeDetailSheetProps {
  mode: ModeLike;
  todayUsage?: TodayUsage;
  weekCount?: number;
  isFavorite?: boolean;
  isHidden?: boolean;
  similarModes?: ModeLike[];
  onClose: () => void;
  onUse: (mode: ModeLike) => void;
  onToggleFavorite?: (id: string) => void;
  onToggleHidden?: (id: string) => void;
  onFilterCategory?: (cat: string) => void;
  onOpenSimilar?: (mode: ModeLike) => void;
}

export default function ModeDetailSheet({
  mode,
  todayUsage,
  weekCount = 0,
  isFavorite = false,
  isHidden = false,
  similarModes = [],
  onClose,
  onUse,
  onToggleFavorite,
  onToggleHidden,
  onFilterCategory,
  onOpenSimilar,
}: ModeDetailSheetProps): JSX.Element {
  const cat = modeCategory(mode);
  const catColor = categoryColor(cat);
  const typeLabel = mode.type ? TYPE_LABEL[mode.type] : undefined;
  const [copied, setCopied] = useState(false);

  const dialogRef = useDialog(onClose);

  // Trava a rolagem da página de trás enquanto o painel está aberto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const success = getModeSuccessRate(mode.id, 1);
  const bestHour = getBestHourForMode(mode.id, 3);

  const copySteps = (): void => {
    if (!mode.steps || mode.steps.length === 0) return;
    const text = `${mode.name}\n` + mode.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
    navigator.clipboard?.writeText(text).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
      () => {}
    );
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div
        ref={dialogRef as React.RefObject<HTMLDivElement>}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes do modo ${mode.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className={styles.header}>
          <span
            className={styles.emoji}
            style={{ background: mode.colorBg || "rgba(255,255,255,0.05)" }}
          >
            {mode.emoji}
          </span>
          <div className={styles.headMeta}>
            <div className={styles.name}>{mode.name}</div>
            <div className={styles.tagline}>{mode.tagline}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {/* Chips de categoria / tipo */}
        <div className={styles.chips}>
          <button
            className={styles.chip}
            style={{ color: catColor, background: `${catColor}22`, cursor: onFilterCategory ? "pointer" : "default" }}
            onClick={() => onFilterCategory?.(cat)}
            title={onFilterCategory ? `Filtrar por ${cat}` : undefined}
          >
            {cat}
          </button>
          {typeLabel && <span className={styles.chip}>{typeLabel}</span>}
        </div>

        {/* Uso / estatísticas */}
        {(todayUsage || weekCount > 0 || success || bestHour) && (
          <div className={styles.usageRow}>
            {todayUsage && (
              <span className={`${styles.usageBadge} ${styles.usageToday}`}>
                Feito hoje{todayUsage.count > 1 ? ` ×${todayUsage.count}` : ""} ({todayUsage.lastHour}h)
              </span>
            )}
            {weekCount > 0 && (
              <span className={`${styles.usageBadge} ${styles.usageWeek}`}>
                {weekCount}× nos últimos 7 dias
              </span>
            )}
            {success && (
              <span className={`${styles.usageBadge} ${styles.usageWeek}`} title={`${success.worked}/${success.total} sessões deram certo`}>
                {success.successRate}% de sucesso
              </span>
            )}
            {bestHour && (
              <span className={`${styles.usageBadge} ${styles.usageWeek}`}>
                Melhor horário: {bestHour.block.label}
              </span>
            )}
          </div>
        )}

        {/* Ações rápidas */}
        <div className={styles.actionsRow}>
          {onToggleFavorite && (
            <button
              className={`${styles.actionBtn} ${isFavorite ? styles.actionActive : ""}`}
              onClick={() => onToggleFavorite(mode.id)}
              aria-pressed={isFavorite}
            >
              {isFavorite ? "★ Favoritado" : "☆ Favoritar"}
            </button>
          )}
          {onToggleHidden && (
            <button
              className={styles.actionBtn}
              onClick={() => onToggleHidden(mode.id)}
              aria-pressed={isHidden}
            >
              {isHidden ? "↩ Reexibir" : "🚫 Ocultar"}
            </button>
          )}
          {mode.steps && mode.steps.length > 0 && (
            <button className={styles.actionBtn} onClick={copySteps}>
              {copied ? "✓ Copiado" : "📋 Copiar passos"}
            </button>
          )}
        </div>

        {/* Corpo com seções condicionais */}
        <div className={styles.body}>
          {mode.prerequisite && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>✅ Pré-requisito</div>
              <div className={styles.sectionText}>{mode.prerequisite}</div>
            </div>
          )}
          {mode.whyItWorks && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>🧠 Por que funciona</div>
              <div className={styles.sectionText}>{mode.whyItWorks}</div>
            </div>
          )}
          {mode.whenToUse && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>🕐 Quando usar</div>
              <div className={styles.sectionText}>{mode.whenToUse}</div>
            </div>
          )}

          {mode.steps && mode.steps.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>🪜 O que fazer</div>
              <ol className={styles.steps}>
                {mode.steps.map((step, i) => (
                  <li key={i} className={styles.step}>
                    <span className={styles.stepNum} style={{ background: mode.color || "#4ecca3" }}>
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {mode.classes && mode.classes.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>🎭 Classes disponíveis</div>
              {mode.classes.map((c, i) => (
                <div key={i} className={styles.classItem}>
                  <span style={{ fontSize: 20 }}>{c.emoji}</span>
                  <div>
                    <div className={styles.className} style={{ color: c.color }}>{c.name}</div>
                    {c.desc && <div className={styles.classDesc}>{c.desc}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {mode.context && mode.context.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>🏷️ Contexto</div>
              <div className={styles.chips} style={{ padding: 0 }}>
                {mode.context.map((c) => (
                  <span key={c} className={styles.chip}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {mode.tips && <div className={styles.tip}>💡 {mode.tips}</div>}

          {similarModes.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>🔗 Modos parecidos</div>
              <div className={styles.similarRow}>
                {similarModes.map((m) => (
                  <button
                    key={m.id}
                    className={styles.similarChip}
                    onClick={() => onOpenSimilar?.(m)}
                    title={m.tagline}
                  >
                    <span>{m.emoji}</span> {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className={styles.footer}>
          <button className={styles.useBtn} onClick={() => onUse(mode)}>
            Usar este modo
          </button>
          <button className={styles.secondaryBtn} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

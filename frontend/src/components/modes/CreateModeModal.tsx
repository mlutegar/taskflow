import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/apiClient";
import { useDialog } from "../../lib/useDialog";
import ModalOverlay from "../shared/ModalOverlay";
import styles from "../ModesPanel.module.css";
import type { ModeConfig } from "./types";

// ── Helpers ────────────────────────────────────────────────────────────────────
export const EMOJI_PRESETS: string[] = ["🚀", "🔥", "💎", "🧠", "🎯", "⭐", "🌊", "🏆", "💪", "🎲", "🌙", "⚙️", "🦁", "🐉", "🧩"];
export const COLOR_PRESETS: string[] = [
  "#7c6ef5", "#e05252", "#f0a540", "#4ecca3", "#c8874a",
  "#b06ef5", "#4ea8cc", "#e07c52", "#52b0e0", "#a0c840",
];

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Component ──────────────────────────────────────────────────────────────────
interface CreateModeModalProps {
  onSave: (mode: ModeConfig) => void;
  onClose: () => void;
}

export default function CreateModeModal({ onSave, onClose }: CreateModeModalProps) {
  const [emoji, setEmoji] = useState<string>("🚀");
  const [name, setName] = useState<string>("");
  const [tagline, setTagline] = useState<string>("");
  const [color, setColor] = useState<string>("#7c6ef5");
  const [steps, setSteps] = useState<string[]>(["", "", ""]);
  const [tips, setTips] = useState<string>("");
  const [prerequisite, setPrerequisite] = useState<string>("");
  const [whyItWorks, setWhyItWorks] = useState<string>("");
  const [whenToUse, setWhenToUse] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");
  const [aiProgress, setAiProgress] = useState<string>("");
  // Categoria/tipo sugeridos pela IA (sem UI de edição; anexados ao modo salvo).
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [modeType, setModeType] = useState<string | undefined>(undefined);
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);
  // Snapshot para "Desfazer IA" — guarda o estado anterior à última aplicação.
  const undoRef = useRef<AiSnapshot | null>(null);
  const [canUndo, setCanUndo] = useState<boolean>(false);

  interface AiModeResult {
    emoji?: string;
    name?: string;
    tagline?: string;
    steps?: string[];
    prerequisite?: string;
    whyItWorks?: string;
    whenToUse?: string;
    tips?: string;
    category?: string;
    type?: string;
  }

  interface AiSnapshot {
    emoji: string;
    name: string;
    tagline: string;
    steps: string[];
    prerequisite: string;
    whyItWorks: string;
    whenToUse: string;
    tips: string;
  }

  // Mensagens rotativas de progresso enquanto a IA trabalha (até ~60s).
  useEffect(() => {
    if (!aiLoading) { setAiProgress(""); return; }
    const msgs = [
      "Pensando no conceito do modo…",
      "Escrevendo a tagline…",
      "Montando os passos…",
      "Definindo pré-requisitos…",
      "Ajustando os detalhes…",
    ];
    let i = 0;
    setAiProgress(msgs[0]);
    const id = setInterval(() => { i = (i + 1) % msgs.length; setAiProgress(msgs[i]); }, 3500);
    return () => clearInterval(id);
  }, [aiLoading]);

  const snapshot = (): AiSnapshot => ({
    emoji, name, tagline, steps: [...steps], prerequisite, whyItWorks, whenToUse, tips,
  });

  const applyResult = (res: AiModeResult, opts: { force: boolean; only?: keyof AiModeResult }): void => {
    const wants = (field: keyof AiModeResult): boolean => !opts.only || opts.only === field;

    // O emoji só é trocado se force, ou se o usuário ainda estiver no default ("🚀").
    if (wants("emoji") && res.emoji?.trim() && (opts.force || emoji === "🚀")) setEmoji(res.emoji.trim());
    if (wants("name") && res.name?.trim() && (opts.force || !name.trim())) setName(res.name.trim());
    if (wants("tagline") && res.tagline?.trim() && (opts.force || !tagline.trim())) setTagline(res.tagline.trim());
    if (wants("steps") && res.steps?.length && (opts.force || steps.filter((s) => s.trim()).length === 0)) {
      setSteps(res.steps.map((s) => s.trim()).filter(Boolean));
    }
    if (wants("prerequisite") && res.prerequisite?.trim() && (opts.force || !prerequisite.trim())) setPrerequisite(res.prerequisite.trim());
    if (wants("whyItWorks") && res.whyItWorks?.trim() && (opts.force || !whyItWorks.trim())) setWhyItWorks(res.whyItWorks.trim());
    if (wants("whenToUse") && res.whenToUse?.trim() && (opts.force || !whenToUse.trim())) setWhenToUse(res.whenToUse.trim());
    if (wants("tips") && res.tips?.trim() && (opts.force || !tips.trim())) setTips(res.tips.trim());
    // Categoria/tipo: só preenche quando não é regeneração de um campo específico.
    if (!opts.only) {
      if (res.category?.trim() && (opts.force || !category)) setCategory(res.category.trim());
      if (res.type?.trim() && (opts.force || !modeType)) setModeType(res.type.trim());
    }
    setErrors({});
  };

  const runAi = async (opts: { force: boolean; only?: keyof AiModeResult }): Promise<void> => {
    if (!name.trim() && !tagline.trim()) {
      setAiError("Preencha ao menos o nome ou a tagline antes de usar a IA.");
      return;
    }
    setAiError("");
    setAiLoading(true);
    undoRef.current = snapshot();
    try {
      const res = (await api.post(
        "/ai/generate-mode",
        {
          emoji,
          name: name.trim(),
          tagline: tagline.trim(),
          steps: steps.filter((s) => s.trim()),
          prerequisite: prerequisite.trim(),
          whyItWorks: whyItWorks.trim(),
          whenToUse: whenToUse.trim(),
          tips: tips.trim(),
        },
        70_000,
      )) as AiModeResult;
      applyResult(res, opts);
      setHasGenerated(true);
      setCanUndo(true);
    } catch (err: unknown) {
      setAiError((err as { message?: string })?.message || "Falha ao preencher com IA.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiFill = (): Promise<void> => runAi({ force: false });
  const handleAiRegenerate = (): Promise<void> => runAi({ force: true });
  const regenerateField = (field: keyof AiModeResult): Promise<void> => runAi({ force: true, only: field });

  const undoAi = (): void => {
    const snap = undoRef.current;
    if (!snap) return;
    setEmoji(snap.emoji); setName(snap.name); setTagline(snap.tagline); setSteps(snap.steps);
    setPrerequisite(snap.prerequisite); setWhyItWorks(snap.whyItWorks); setWhenToUse(snap.whenToUse); setTips(snap.tips);
    undoRef.current = null;
    setCanUndo(false);
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nome é obrigatório";
    if (!tagline.trim()) e.tagline = "Tagline é obrigatória";
    if (steps.filter((s) => s.trim()).length === 0) e.steps = "Adicione pelo menos um passo";
    if (!prerequisite.trim()) e.prerequisite = "Pré-requisito é obrigatório";
    if (!whyItWorks.trim()) e.whyItWorks = "\"Por que funciona\" é obrigatório";
    if (!whenToUse.trim()) e.whenToUse = "\"Quando usar\" é obrigatório";
    return e;
  };

  const handleSave = (): void => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    const id = "custom_" + Date.now();
    onSave({
      id,
      emoji,
      name: name.trim(),
      tagline: tagline.trim(),
      color,
      colorBg: hexToRgba(color, 0.08),
      steps: steps.filter((s) => s.trim()),
      tips: tips.trim() || undefined,
      prerequisite: prerequisite.trim(),
      whyItWorks: whyItWorks.trim(),
      whenToUse: whenToUse.trim(),
      category: category || undefined,
      type: modeType || undefined,
      isCustom: true,
    });
  };

  const updateStep = (i: number, val: string): void => setSteps((prev) => prev.map((s, idx) => idx === i ? val : s));
  const addStep = (): void => setSteps((prev) => [...prev, ""]);
  const removeStep = (i: number): void => setSteps((prev) => prev.filter((_, idx) => idx !== i));

  const fieldAiBtn = (field: keyof AiModeResult, label: string) => (
    <button
      type="button"
      className={styles.fieldAiBtn}
      onClick={() => regenerateField(field)}
      disabled={aiLoading}
      title={`Gerar "${label}" com IA`}
      aria-label={`Gerar ${label} com IA`}
    >
      ✨
    </button>
  );

  const dialogRef = useDialog(onClose);

  return (
    <ModalOverlay onClose={onClose}>
      <div className={styles.modal} ref={dialogRef} role="dialog" aria-modal="true" aria-label="Criar modo personalizado" tabIndex={-1}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>✨ Criar Modo Personalizado</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className={styles.modalBody}>
          {/* AI fill */}
          <div className={styles.aiFillBar}>
            <button
              type="button"
              className={styles.aiFillBtn}
              onClick={handleAiFill}
              disabled={aiLoading}
              title="Preencher os campos vazios usando IA a partir do que você já digitou"
            >
              {aiLoading ? "✨ Gerando…" : "✨ Preencher com IA"}
            </button>
            {hasGenerated && (
              <button
                type="button"
                className={styles.aiFillBtn}
                onClick={handleAiRegenerate}
                disabled={aiLoading}
                title="Gerar novamente, sobrescrevendo todos os campos"
              >
                🔄 Gerar novamente
              </button>
            )}
            {canUndo && !aiLoading && (
              <button
                type="button"
                className={styles.aiUndoBtn}
                onClick={undoAi}
                title="Desfazer o preenchimento da IA"
              >
                ↩ Desfazer
              </button>
            )}
            {aiLoading && aiProgress && <span className={styles.aiFillProgress}>{aiProgress}</span>}
            {aiError && <span className={styles.aiFillError}>{aiError}</span>}
          </div>

          {/* Emoji + Name row */}
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: "0 0 auto" }}>
              <label className={styles.formLabel}>Emoji</label>
              <div className={styles.emojiPicker}>
                <span className={styles.emojiPreview}>{emoji}</span>
                <div className={styles.emojiGrid}>
                  {EMOJI_PRESETS.map((e) => (
                    <button
                      key={e}
                      className={`${styles.emojiOption} ${emoji === e ? styles.emojiSelected : ""}`}
                      onClick={() => setEmoji(e)}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>Nome do Modo *</label>
              <input
                className={`${styles.formInput} ${errors.name ? styles.inputError : ""}`}
                placeholder="Ex: Deep Work Mode"
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
              />
              {errors.name && <span className={styles.errorText}>{errors.name}</span>}
            </div>
          </div>

          {/* Tagline */}
          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label className={styles.formLabel}>Tagline *</label>
              {fieldAiBtn("tagline", "Tagline")}
            </div>
            <input
              className={`${styles.formInput} ${errors.tagline ? styles.inputError : ""}`}
              placeholder="Ex: Blocos de foco sem interrupção"
              value={tagline}
              onChange={(e) => { setTagline(e.target.value); setErrors((p) => ({ ...p, tagline: "" })); }}
            />
            {errors.tagline && <span className={styles.errorText}>{errors.tagline}</span>}
          </div>

          {/* Color */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Cor do Modo</label>
            <div className={styles.colorRow}>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  className={`${styles.colorSwatch} ${color === c ? styles.colorSelected : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <input
                type="color"
                className={styles.colorCustom}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Cor personalizada"
              />
            </div>
            <div className={styles.colorPreview} style={{ background: hexToRgba(color, 0.12), borderColor: hexToRgba(color, 0.35), color }}>
              {emoji} Prévia do modo
            </div>
          </div>

          {/* Steps */}
          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label className={styles.formLabel}>Passos do Modo *</label>
              {fieldAiBtn("steps", "Passos")}
            </div>
            {errors.steps && <span className={styles.errorText}>{errors.steps}</span>}
            <div className={styles.stepsList}>
              {steps.map((step, i) => (
                <div key={i} className={styles.stepRow}>
                  <span className={styles.stepBadge} style={{ background: color }}>{i + 1}</span>
                  <input
                    className={styles.formInput}
                    placeholder={`Passo ${i + 1}…`}
                    value={step}
                    onChange={(e) => { updateStep(i, e.target.value); setErrors((p) => ({ ...p, steps: "" })); }}
                  />
                  {steps.length > 1 && (
                    <button className={styles.removeStepBtn} onClick={() => removeStep(i)} title="Remover passo" aria-label={`Remover passo ${i + 1}`}>×</button>
                  )}
                </div>
              ))}
              <button className={styles.addStepBtn} onClick={addStep}>+ Adicionar passo</button>
            </div>
          </div>

          {/* Prerequisite */}
          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label className={styles.formLabel}>✅ Pré-requisito *</label>
              {fieldAiBtn("prerequisite", "Pré-requisito")}
            </div>
            <textarea
              className={`${styles.formTextarea} ${errors.prerequisite ? styles.inputError : ""}`}
              placeholder="O que o usuário precisa ter/fazer antes de iniciar este modo?"
              value={prerequisite}
              onChange={(e) => { setPrerequisite(e.target.value); setErrors((p) => ({ ...p, prerequisite: "" })); }}
              rows={2}
            />
            {errors.prerequisite && <span className={styles.errorText}>{errors.prerequisite}</span>}
          </div>

          {/* Why it works */}
          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label className={styles.formLabel}>🧠 Por que funciona *</label>
              {fieldAiBtn("whyItWorks", "Por que funciona")}
            </div>
            <textarea
              className={`${styles.formTextarea} ${errors.whyItWorks ? styles.inputError : ""}`}
              placeholder="A lógica por trás deste modo — por que ele é eficaz?"
              value={whyItWorks}
              onChange={(e) => { setWhyItWorks(e.target.value); setErrors((p) => ({ ...p, whyItWorks: "" })); }}
              rows={2}
            />
            {errors.whyItWorks && <span className={styles.errorText}>{errors.whyItWorks}</span>}
          </div>

          {/* When to use */}
          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label className={styles.formLabel}>🕐 Quando usar *</label>
              {fieldAiBtn("whenToUse", "Quando usar")}
            </div>
            <textarea
              className={`${styles.formTextarea} ${errors.whenToUse ? styles.inputError : ""}`}
              placeholder="Em que situação ou estado mental este modo é mais indicado?"
              value={whenToUse}
              onChange={(e) => { setWhenToUse(e.target.value); setErrors((p) => ({ ...p, whenToUse: "" })); }}
              rows={2}
            />
            {errors.whenToUse && <span className={styles.errorText}>{errors.whenToUse}</span>}
          </div>

          {/* Tips */}
          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label className={styles.formLabel}>Dica (opcional)</label>
              {fieldAiBtn("tips", "Dica")}
            </div>
            <textarea
              className={styles.formTextarea}
              placeholder="Explique a lógica por trás do modo, dicas de uso…"
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.saveBtn} style={{ background: color }} onClick={handleSave}>
            ✓ Criar Modo
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

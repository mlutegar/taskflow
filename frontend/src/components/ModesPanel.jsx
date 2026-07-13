import { useState, useEffect } from "react";
import ModeSession from "./ModeSession";
import styles from "./ModesPanel.module.css";
import { modeStatsApi } from "../api/modeStats";

const MODES = [
  {
    id: "music",
    emoji: "🎵",
    name: "Music Mode",
    tagline: "Encontre a música certa, faça a tarefa certa",
    color: "#7c6ef5",
    colorBg: "rgba(124,110,245,0.08)",
    context: ["🖥️ Desktop", "🎧 Música"],
    steps: [
      "Abra o Spotify e passe por ~100 músicas",
      "Quando encontrar UMA que ressoa, volte aqui",
      "Selecione uma tarefa para fazer enquanto ouve",
      "Repita para a próxima música/tarefa",
    ],
    tips: "O ato de procurar a música já cria estado mental de foco. A música escolhida vira uma âncora de concentração.",
  },
  {
    id: "tiktok",
    emoji: "📱",
    name: "TikTok Mode",
    tagline: "Ciclos progressivos: videos → tarefas",
    color: "#e05252",
    colorBg: "rgba(224,82,82,0.08)",
    context: ["📱 Mobile", "🔄 Ciclos"],
    steps: [
      "Ciclo 1: Assista 5 vídeos → Faça 1 tarefa",
      "Ciclo 2: Assista 10 vídeos → Faça 2 tarefas",
      "Ciclo 3: Assista 15 vídeos → Faça 3 tarefas",
      "Continue: n × 5 vídeos → n tarefas",
    ],
    tips: "Usa o TikTok como recompensa controlada. Cada ciclo aumenta a dose de trabalho, criando momentum progressivo.",
  },
  {
    id: "splite",
    emoji: "🔪",
    name: "Splite Mode",
    tagline: "Ciclos progressivos com atividade personalizada",
    color: "#f0a540",
    colorBg: "rgba(240,165,64,0.08)",
    context: ["🖥️ Desktop", "🔄 Ciclos"],
    steps: [
      "Escolha uma atividade da sua lista personalizada",
      "Ciclo 1: Atividade 1× → 1 tarefa",
      "Ciclo 2: Atividade 2× → 2 tarefas",
      "Continue aumentando progressivamente",
    ],
    tips: "Igual ao TikTok Mode, mas você escolhe a atividade de recompensa: ler o diário, beber água, meditar, jogar…",
  },
  {
    id: "momentum",
    emoji: "⚡",
    name: "Momentum Mode",
    tagline: "Quebre a inércia com sessões de 5 minutos",
    color: "#4ecca3",
    colorBg: "rgba(78,204,163,0.08)",
    context: ["🖥️ Desktop", "⏱️ Timer"],
    steps: [
      "Confirme que o celular está longe",
      "Selecione uma tarefa para trabalhar",
      "Foque por 5 minutos (com timer visual)",
      "Após o timer: continue ou pare — você escolhe",
    ],
    tips: "O objetivo não é perfeição — é COMEÇAR. 5 minutos de trabalho mínimo. A inércia é o maior inimigo.",
  },
  {
    id: "espresso",
    emoji: "☕",
    name: "Espresso Sprint",
    tagline: "Sprints de 25 minutos com rastreamento de café",
    color: "#c8874a",
    colorBg: "rgba(200,135,74,0.08)",
    context: ["🖥️ Desktop", "☕ Café", "⏱️ Timer"],
    steps: [
      "Confirme que tomou café (sessão registrada)",
      "Selecione uma tarefa para o sprint",
      "Sprint de 25 minutos com foco total",
      "Após o sprint: continue com/sem café, ou pare",
    ],
    tips: "Máximo recomendado: 4–6 sprints por sessão. Rastreia cafés e avisa quando está ficando excessivo.",
  },
  {
    id: "rpg",
    emoji: "🎮",
    name: "RPG Class Mode",
    tagline: "Produtividade gamificada com classes de personagem",
    color: "#b06ef5",
    colorBg: "rgba(176,110,245,0.08)",
    context: ["🖥️ Desktop", "🎮 Gamificação"],
    classes: [
      { emoji: "⚔️", name: "Warrior", desc: "30 min, bônus de stamina", color: "#e05252" },
      { emoji: "🧙‍♂️", name: "Mage", desc: "25 min, +25% XP em estudo", color: "#7c6ef5" },
      { emoji: "🗡️", name: "Rogue", desc: "15 min, combo em tarefas rápidas", color: "#4ecca3" },
    ],
    steps: [
      "Crie seu personagem (nome + classe)",
      "Selecione uma tarefa como Quest",
      "Classifique a dificuldade (Easy → Very Hard)",
      "Complete o timer da sua classe e ganhe XP",
    ],
    tips: "Personagem salvo no navegador. Soba de nível completando quests e desbloqueie novas conquistas.",
  },
  {
    id: "lazyfal",
    emoji: "🦅",
    name: "Lazy Falcon Mode",
    tagline: "Ciclos progressivos com tarefas salvas para depois",
    color: "#4ea8cc",
    colorBg: "rgba(78,168,204,0.08)",
    context: ["🖥️ Desktop", "🔄 Ciclos"],
    steps: [
      "Escolha uma atividade da lista",
      "Faça ciclos progressivos (n atividades → n tarefas)",
      "Ao trabalhar: finalizar OU salvar para depois",
      "Tarefas salvas ficam no dashboard da sessão",
    ],
    tips: "Diferente do Splite: você pode guardar tarefas em andamento com notas de progresso. Ideal para projetos longos.",
  },
  {
    id: "caferitual",
    emoji: "🫖",
    name: "Café Ritual",
    tagline: "Shot de café + a música certa = estado de pico",
    color: "#d4960a",
    colorBg: "rgba(212,150,10,0.08)",
    context: ["🖥️ Desktop", "☕ Café", "🎧 Música"],
    steps: [
      "Prepare e tome um shot de café quente (âncora física)",
      "Abra o Spotify e passe por ~100 músicas",
      "Quando UMA fizer você sentir que pode tudo, volte aqui",
      "Escolha qualquer tarefa e execute com o estado de pico",
    ],
    tips: "O café cria a âncora física. A música cria a âncora mental. Juntos, ativam um estado de confiança e foco onde qualquer tarefa parece possível.",
  },
  {
    id: "tabhop",
    emoji: "📲",
    name: "Tab Hop",
    tagline: "Rotação entre apps abertos — feito para transporte",
    color: "#2d9bf0",
    colorBg: "rgba(45,155,240,0.08)",
    context: ["📱 Mobile", "🚇 Transporte"],
    steps: [
      "Abra os apps que vai usar hoje no celular",
      "Adicione cada um como uma 'aba' aqui",
      "O modo mostra qual app focar agora",
      "Faz um pouco → 'Próxima aba →' → passa para o seguinte",
      "Ao fechar: commit + git push",
    ],
    tips: "Criado para deslocamentos onde você não consegue manter foco longo. Cada aba exige apenas um pequeno avanço — a rotação cria progresso distribuído.",
  },

  // ── Modos de cantar (variantes da SingSession) ──
  {
    id: "sing_one",
    emoji: "🎙️",
    name: "Cantar 1 Música",
    tagline: "Cante uma música inteira, depois faça uma tarefa",
    color: "#e0679b",
    colorBg: "rgba(224,103,155,0.08)",
    category: "Música",
    session: "sing",
    preset: { variant: "one" },
    context: ["🖥️ Desktop", "🎤 Voz"],
    steps: [
      "Escolha uma música que você ama",
      "Cante junto do começo ao fim",
      "Selecione uma tarefa e conclua",
      "Repita com a próxima música",
    ],
    tips: "Cantar libera tensão e ativa a respiração — um reset rápido de energia antes de cada tarefa.",
  },
  {
    id: "sing_ten",
    emoji: "🎤",
    name: "10 Músicas Cantáveis",
    tagline: "Monte uma fila de 10 músicas para cantar junto",
    color: "#d14a86",
    colorBg: "rgba(209,74,134,0.08)",
    category: "Música",
    session: "sing",
    preset: { variant: "ten" },
    context: ["🖥️ Desktop", "🎤 Voz", "🔄 Ciclos"],
    steps: [
      "Encontre uma música que dá vontade de cantar",
      "Registre na fila e faça uma tarefa cantando junto",
      "Repita até completar 10 músicas cantáveis",
      "Feche com sua fila curada de karaokê",
    ],
    tips: "A curadoria da fila mantém a sessão leve e divertida enquanto o trabalho acontece em segundo plano.",
  },
];

// ── Cards do Splite separados por atividade (reutilizam a SpliteSession com preset) ──
const SPLITE_ACTIVITY_MODES = [
  { id: "splite_agua",       emoji: "💧", name: "Beber Água",        activity: "Beber água",              color: "#4ea8cc", tagline: "Ciclos progressivos hidratando entre tarefas" },
  { id: "splite_meditar",    emoji: "🧘", name: "Meditar",           activity: "Meditar",                 color: "#7c6ef5", tagline: "Ciclos progressivos meditando entre tarefas" },
  { id: "splite_diario",     emoji: "📖", name: "Ler Diário",        activity: "Ler diário",              color: "#c8874a", tagline: "Ciclos progressivos relendo o diário entre tarefas" },
  { id: "splite_esticar",    emoji: "🤸", name: "Esticar 5 min",     activity: "Esticar 5 minutos",       color: "#4ecca3", tagline: "Ciclos progressivos alongando entre tarefas" },
  { id: "splite_livro",      emoji: "📚", name: "Ler um Capítulo",   activity: "Ler um capítulo de livro", color: "#f0a540", tagline: "Ciclos progressivos lendo entre tarefas" },
  { id: "splite_exercicio",  emoji: "🏃", name: "Exercícios Rápidos", activity: "Fazer exercícios rápidos", color: "#e05252", tagline: "Ciclos progressivos exercitando entre tarefas" },
].map((m) => ({
  id: m.id,
  emoji: m.emoji,
  name: m.name,
  tagline: m.tagline,
  color: m.color,
  colorBg: hexToRgba(m.color, 0.08),
  category: "Ciclos",
  session: "splite",
  preset: { activity: m.activity },
  context: ["🖥️ Desktop", "🔄 Ciclos"],
  steps: [
    `Ciclo 1: "${m.activity}" 1× → 1 tarefa`,
    `Ciclo 2: "${m.activity}" 2× → 2 tarefas`,
    "Continue aumentando progressivamente",
    "A atividade de recompensa já vem escolhida",
  ],
  tips: `Variante do Splite Mode com "${m.activity}" fixa como recompensa entre as tarefas.`,
}));

// Categoria de cada modo embutido (fallback quando o objeto não traz `category`)
const CATEGORY_BY_ID = {
  music: "Música", sing_one: "Música", sing_ten: "Música",
  tiktok: "Ciclos", splite: "Ciclos", lazyfal: "Ciclos",
  momentum: "Foco", espresso: "Foco", rpg: "Foco",
  caferitual: "Ritual", tabhop: "Mobile",
};

const CATEGORY_ORDER = ["Música", "Ciclos", "Foco", "Ritual", "Mobile", "Personalizados"];

const categoryOf = (m) =>
  m.isCustom ? "Personalizados" : (m.category || CATEGORY_BY_ID[m.id] || "Outros");

const EMOJI_PRESETS = ["🚀", "🔥", "💎", "🧠", "🎯", "⭐", "🌊", "🏆", "💪", "🎲", "🌙", "⚙️", "🦁", "🐉", "🧩"];
const COLOR_PRESETS = [
  "#7c6ef5", "#e05252", "#f0a540", "#4ecca3", "#c8874a",
  "#b06ef5", "#4ea8cc", "#e07c52", "#52b0e0", "#a0c840",
];

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function CreateModeModal({ onSave, onClose }) {
  const [emoji, setEmoji] = useState("🚀");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [color, setColor] = useState("#7c6ef5");
  const [steps, setSteps] = useState(["", "", ""]);
  const [tips, setTips] = useState("");
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Nome é obrigatório";
    if (!tagline.trim()) e.tagline = "Tagline é obrigatória";
    if (steps.filter((s) => s.trim()).length === 0) e.steps = "Adicione pelo menos um passo";
    return e;
  };

  const handleSave = () => {
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
      isCustom: true,
    });
  };

  const updateStep = (i, val) => setSteps((prev) => prev.map((s, idx) => idx === i ? val : s));
  const addStep = () => setSteps((prev) => [...prev, ""]);
  const removeStep = (i) => setSteps((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>✨ Criar Modo Personalizado</h2>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
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
            <label className={styles.formLabel}>Tagline *</label>
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
            <label className={styles.formLabel}>Passos do Modo *</label>
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
                    <button className={styles.removeStepBtn} onClick={() => removeStep(i)} title="Remover passo">×</button>
                  )}
                </div>
              ))}
              <button className={styles.addStepBtn} onClick={addStep}>+ Adicionar passo</button>
            </div>
          </div>

          {/* Tips */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Dica (opcional)</label>
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
    </div>
  );
}

export default function ModesPanel({ tasks, routines = [], onCompleteTask, onCompleteRoutine, onAddTask, onAddChecklist, onToggleChecklist, onAddRoutineChecklist, onToggleRoutineChecklist }) {
  const [expanded, setExpanded] = useState(null);
  const [activeSession, setActiveSession] = useState(null); // objeto completo do modo
  const [showCreate, setShowCreate] = useState(false);
  const [sortBy, setSortBy] = useState("default"); // "default" | "tasks"
  const [category, setCategory] = useState(""); // "" = todas

  const [customModes, setCustomModes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("customModes") || "[]"); }
    catch { return []; }
  });

  // Stats: { [modeId]: number }
  // Início: carrega do localStorage como cache otimista, depois sincroniza com o banco
  const [modeStats, setModeStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem("modeStats") || "{}"); }
    catch { return {}; }
  });

  // Carrega stats do banco ao montar
  useEffect(() => {
    modeStatsApi.list()
      .then((stats) => {
        setModeStats(stats);
        localStorage.setItem("modeStats", JSON.stringify(stats));
      })
      .catch(() => {
        // Mantém localStorage como fallback se o banco falhar
      });
  }, []);

  const handleModeTaskComplete = async (modeId) => {
    // Update otimista imediato na UI e no cache local
    setModeStats((prev) => {
      const updated = { ...prev, [modeId]: (prev[modeId] || 0) + 1 };
      localStorage.setItem("modeStats", JSON.stringify(updated));
      return updated;
    });
    // Persiste no banco (incremento atômico via RPC)
    try {
      const newCount = await modeStatsApi.increment(modeId);
      // Sincroniza o valor exato retornado pelo banco
      setModeStats((prev) => {
        const updated = { ...prev, [modeId]: newCount };
        localStorage.setItem("modeStats", JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      // Falhou no banco — localStorage já tem o valor otimista, ok por ora
      console.warn("Falha ao salvar stat no banco:", e.message);
    }
  };

  const toggle = (id) => setExpanded((p) => (p === id ? null : id));

  const handleSaveMode = (newMode) => {
    const updated = [...customModes, newMode];
    setCustomModes(updated);
    localStorage.setItem("customModes", JSON.stringify(updated));
    setShowCreate(false);
  };

  const handleDeleteMode = (id) => {
    const updated = customModes.filter((m) => m.id !== id);
    setCustomModes(updated);
    localStorage.setItem("customModes", JSON.stringify(updated));
  };

  const allModes = [...MODES, ...SPLITE_ACTIVITY_MODES, ...customModes];

  // Categorias presentes (na ordem canônica, só as que têm modos)
  const presentCategories = CATEGORY_ORDER.filter((c) => allModes.some((m) => categoryOf(m) === c));

  const applySort = (list) =>
    sortBy === "tasks"
      ? [...list].sort((a, b) => (modeStats[b.id] || 0) - (modeStats[a.id] || 0))
      : list;

  // Sem filtro → agrupa por categoria; com filtro → um único grupo
  const groups = category
    ? [{ name: category, modes: applySort(allModes.filter((m) => categoryOf(m) === category)) }]
    : presentCategories.map((c) => ({ name: c, modes: applySort(allModes.filter((m) => categoryOf(m) === c)) }));

  const renderCard = (mode) => {
    const open = expanded === mode.id;
    const taskCount = modeStats[mode.id] || 0;
    return (
      <div
        key={mode.id}
        className={`${styles.card} ${open ? styles.cardOpen : ""} ${mode.isCustom ? styles.cardCustom : ""}`}
        style={{ "--mode-color": mode.color, "--mode-bg": mode.colorBg }}
      >
        <div className={styles.cardHeader}>
          <button className={styles.cardToggle} onClick={() => toggle(mode.id)}>
            <span className={styles.cardEmoji}>{mode.emoji}</span>
            <div className={styles.cardMeta}>
              <div className={styles.cardNameRow}>
                <span className={styles.cardName}>{mode.name}</span>
                {mode.isCustom && <span className={styles.customBadge}>Personalizado</span>}
                {taskCount > 0 && (
                  <span className={styles.statBadge}>✓ {taskCount}</span>
                )}
              </div>
              <span className={styles.cardTagline}>{mode.tagline}</span>
              {mode.context?.length > 0 && (
                <div className={styles.contextTags}>
                  {mode.context.map((tag) => (
                    <span key={tag} className={styles.contextTag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>›</span>
          </button>

          <div className={styles.cardActions}>
            <button
              className={styles.startBtn}
              onClick={() => setActiveSession(mode)}
              title={`Iniciar ${mode.name}`}
            >
              ▶ Iniciar
            </button>
            {mode.isCustom && (
              <button
                className={styles.deleteBtn}
                onClick={() => handleDeleteMode(mode.id)}
                title="Excluir modo"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {open && (
          <div className={styles.cardBody}>
            {taskCount > 0 && (
              <div className={styles.statRow}>
                <span className={styles.statIcon}>🎯</span>
                <span className={styles.statText}>
                  {taskCount} tarefa{taskCount !== 1 ? "s" : ""} concluída{taskCount !== 1 ? "s" : ""} neste modo
                </span>
              </div>
            )}

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Como funciona</span>
              <ol className={styles.stepList}>
                {mode.steps.map((step, i) => (
                  <li key={i} className={styles.stepItem}>
                    <span className={styles.stepNum} style={{ background: mode.color }}>{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {mode.classes && (
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Classes disponíveis</span>
                <div className={styles.classesList}>
                  {mode.classes.map((cls) => (
                    <div key={cls.name} className={styles.classItem} style={{ "--cls-color": cls.color }}>
                      <span className={styles.classEmoji}>{cls.emoji}</span>
                      <div>
                        <span className={styles.className}>{cls.name}</span>
                        <span className={styles.classDesc}>{cls.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode.tips && (
              <div className={styles.tip}>
                <span className={styles.tipIcon}>💡</span>
                <span>{mode.tips}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.root}>
      <div className={styles.panelHeader}>
        <p className={styles.subtitle}>
          Modos de atividade guiam sua sessão de trabalho com mecânicas específicas para cada estado de produtividade.
        </p>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
          <span>+</span> Criar Modo
        </button>
      </div>

      {/* Filtro por categoria */}
      <div className={styles.sortBar}>
        <span className={styles.sortLabel}>Categoria:</span>
        <button
          className={`${styles.sortBtn} ${category === "" ? styles.sortBtnActive : ""}`}
          onClick={() => setCategory("")}
        >
          Todas
        </button>
        {presentCategories.map((c) => (
          <button
            key={c}
            className={`${styles.sortBtn} ${category === c ? styles.sortBtnActive : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Ordenação */}
      <div className={styles.sortBar}>
        <span className={styles.sortLabel}>Ordenar:</span>
        <button
          className={`${styles.sortBtn} ${sortBy === "default" ? styles.sortBtnActive : ""}`}
          onClick={() => setSortBy("default")}
        >
          Padrão
        </button>
        <button
          className={`${styles.sortBtn} ${sortBy === "tasks" ? styles.sortBtnActive : ""}`}
          onClick={() => setSortBy("tasks")}
        >
          ⚡ Mais usados
        </button>
      </div>

      {groups.map((group) => (
        <div key={group.name} className={styles.categoryGroup}>
          <div className={styles.categoryHeader}>
            <span className={styles.categoryTitle}>{group.name}</span>
            <span className={styles.categoryCount}>{group.modes.length}</span>
          </div>
          <div className={styles.grid}>
            {group.modes.map(renderCard)}
          </div>
        </div>
      ))}

      {showCreate && (
        <CreateModeModal onSave={handleSaveMode} onClose={() => setShowCreate(false)} />
      )}

      {activeSession && (
        <ModeSession
          modeId={activeSession.id}
          mode={activeSession}
          tasks={tasks}
          routines={routines}
          onCompleteTask={onCompleteTask}
          onCompleteRoutine={onCompleteRoutine}
          onAddTask={onAddTask}
          onAddChecklist={onAddChecklist}
          onToggleChecklist={onToggleChecklist}
          onAddRoutineChecklist={onAddRoutineChecklist}
          onToggleRoutineChecklist={onToggleRoutineChecklist}
          onTaskComplete={handleModeTaskComplete}
          onClose={() => setActiveSession(null)}
        />
      )}
    </div>
  );
}

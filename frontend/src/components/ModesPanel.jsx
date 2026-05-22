import { useState } from "react";
import ModeSession from "./ModeSession";
import styles from "./ModesPanel.module.css";

const MODES = [
  {
    id: "music",
    emoji: "🎵",
    name: "Music Mode",
    tagline: "Encontre a música certa, faça a tarefa certa",
    color: "#7c6ef5",
    colorBg: "rgba(124,110,245,0.08)",
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
    tips: "Personagem salvo no navegador. Suba de nível completando quests e desbloqueie novas conquistas.",
  },
  {
    id: "lazyfal",
    emoji: "🦅",
    name: "Lazy Falcon Mode",
    tagline: "Ciclos progressivos com tarefas salvas para depois",
    color: "#4ea8cc",
    colorBg: "rgba(78,168,204,0.08)",
    steps: [
      "Escolha uma atividade da lista",
      "Faça ciclos progressivos (n atividades → n tarefas)",
      "Ao trabalhar: finalizar OU salvar para depois",
      "Tarefas salvas ficam no dashboard da sessão",
    ],
    tips: "Diferente do Splite: você pode guardar tarefas em andamento com notas de progresso. Ideal para projetos longos.",
  },
];

export default function ModesPanel({ tasks, onCompleteTask, onAddTask, onAddChecklist }) {
  const [expanded, setExpanded] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  const toggle = (id) => setExpanded((p) => (p === id ? null : id));

  return (
    <div className={styles.root}>
      <p className={styles.subtitle}>
        Modos de atividade guiam sua sessão de trabalho com mecânicas específicas para cada estado de produtividade.
      </p>

      <div className={styles.grid}>
        {MODES.map((mode) => {
          const open = expanded === mode.id;
          return (
            <div
              key={mode.id}
              className={`${styles.card} ${open ? styles.cardOpen : ""}`}
              style={{ "--mode-color": mode.color, "--mode-bg": mode.colorBg }}
            >
              <div className={styles.cardHeader}>
                <button className={styles.cardToggle} onClick={() => toggle(mode.id)}>
                  <span className={styles.cardEmoji}>{mode.emoji}</span>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardName}>{mode.name}</span>
                    <span className={styles.cardTagline}>{mode.tagline}</span>
                  </div>
                  <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>›</span>
                </button>
                <button
                  className={styles.startBtn}
                  onClick={() => setActiveSession(mode.id)}
                  title={`Iniciar ${mode.name}`}
                >
                  ▶ Iniciar
                </button>
              </div>

              {open && (
                <div className={styles.cardBody}>
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

                  <div className={styles.tip}>
                    <span className={styles.tipIcon}>💡</span>
                    <span>{mode.tips}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeSession && (
        <ModeSession
          modeId={activeSession}
          tasks={tasks}
          onCompleteTask={onCompleteTask}
          onAddTask={onAddTask}
          onAddChecklist={onAddChecklist}
          onClose={() => setActiveSession(null)}
        />
      )}
    </div>
  );
}

import { useState } from "react";
import styles from "./RoutineTemplates.module.css";

interface RoutineItem {
  title: string;
  description: string;
  target_value: number | null;
  unit: string | null;
}

interface Template {
  id: string;
  emoji: string;
  name: string;
  description: string;
  color: string;
  routines: RoutineItem[];
}

const TEMPLATES: Template[] = [
  {
    id: "estudo",
    emoji: "📚",
    name: "Rotina de Estudo",
    description: "Hábitos essenciais para dias de estudo intenso",
    color: "#7c6ef5",
    routines: [
      { title: "Revisão diária (Anki / Órbita)", description: "Revisar flashcards e prompts do dia", target_value: null, unit: null },
      { title: "Leitura técnica", description: "Ler pelo menos 20 páginas de material técnico", target_value: 20, unit: "páginas" },
      { title: "Bloco de foco profundo", description: "Sessão sem distrações para estudar o assunto principal", target_value: 90, unit: "minutos" },
      { title: "Resumo do dia", description: "Anotar os pontos mais importantes aprendidos hoje", target_value: null, unit: null },
    ],
  },
  {
    id: "saude",
    emoji: "💪",
    name: "Rotina de Saúde",
    description: "Hábitos físicos e mentais para bem-estar diário",
    color: "#4ecca3",
    routines: [
      { title: "Beber água", description: "Manter hidratação ao longo do dia", target_value: 8, unit: "copos" },
      { title: "Exercício físico", description: "Qualquer atividade: caminhada, academia, alongamento", target_value: 30, unit: "minutos" },
      { title: "Meditação", description: "Respiração consciente ou mindfulness", target_value: 10, unit: "minutos" },
      { title: "Sono de qualidade", description: "Dormir no horário programado", target_value: null, unit: null },
    ],
  },
  {
    id: "produtividade",
    emoji: "⚡",
    name: "Rotina de Produtividade",
    description: "Sistema diário para máxima performance no trabalho",
    color: "#f0a540",
    routines: [
      { title: "Revisão da lista de tarefas", description: "Verificar e priorizar tarefas do dia", target_value: null, unit: null },
      { title: "Caixa de entrada zerada", description: "Processar e-mails e mensagens pendentes", target_value: null, unit: null },
      { title: "3 tarefas concluídas", description: "Mínimo de 3 tarefas finalizadas hoje", target_value: 3, unit: "tarefas" },
      { title: "Revisão noturna", description: "Checar o que foi feito e preparar o amanhã", target_value: null, unit: null },
    ],
  },
  {
    id: "manha",
    emoji: "🌅",
    name: "Rotina Matinal",
    description: "Começo de dia estruturado para entrar no modo foco",
    color: "#e07840",
    routines: [
      { title: "Não checar celular nos primeiros 30min", description: "Acordar sem distrações digitais", target_value: null, unit: null },
      { title: "Água em jejum", description: "Beber pelo menos 1 copo ao acordar", target_value: 1, unit: "copo" },
      { title: "Alongamento matinal", description: "Mobilidade e ativação do corpo", target_value: 10, unit: "minutos" },
      { title: "Planejamento do dia", description: "Definir as 3 tarefas mais importantes do dia", target_value: null, unit: null },
    ],
  },
  {
    id: "criativo",
    emoji: "🎨",
    name: "Rotina Criativa",
    description: "Hábitos para manter o fluxo criativo ativo",
    color: "#e1306c",
    routines: [
      { title: "Escrita livre (morning pages)", description: "Escrever 3 páginas sem censura ao acordar", target_value: 3, unit: "páginas" },
      { title: "Consumir uma referência", description: "Ler, assistir ou ouvir algo inspirador", target_value: null, unit: null },
      { title: "Sessão criativa", description: "Trabalhar no projeto criativo principal", target_value: 60, unit: "minutos" },
      { title: "Registrar ideias do dia", description: "Anotar qualquer ideia que surgiu hoje", target_value: null, unit: null },
    ],
  },
];

interface CreateRoutinePayload {
  title: string;
  description: string;
  target_value: number | null;
  unit: string | null;
  recurrence: string;
}

interface RoutineTemplatesProps {
  onCreateRoutine: (payload: CreateRoutinePayload) => Promise<unknown>;
}

export default function RoutineTemplates({ onCreateRoutine }: RoutineTemplatesProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const handleApply = async (template: Template): Promise<void> => {
    if (applying || applied.has(template.id)) return;
    setApplying(template.id);
    try {
      for (const routine of template.routines) {
        await onCreateRoutine({
          title: routine.title,
          description: routine.description,
          target_value: routine.target_value,
          unit: routine.unit,
          recurrence: "daily",
        });
      }
      setApplied((prev) => new Set([...prev, template.id]));
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className={styles.wrap}>
      <button className={styles.toggle} onClick={() => setOpen((v) => !v)}>
        <span>📋 Templates de rotina</span>
        <span className={styles.arrow}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className={styles.grid}>
          {TEMPLATES.map((t) => {
            const isApplied = applied.has(t.id);
            const isApplying = applying === t.id;
            return (
              <div key={t.id} className={styles.card} style={{ "--t-color": t.color } as React.CSSProperties}>
                <div className={styles.cardHeader}>
                  <span className={styles.emoji}>{t.emoji}</span>
                  <div className={styles.info}>
                    <strong className={styles.name}>{t.name}</strong>
                    <span className={styles.desc}>{t.description}</span>
                  </div>
                </div>
                <ul className={styles.list}>
                  {t.routines.map((r, i) => (
                    <li key={i} className={styles.item}>
                      <span className={styles.dot} />
                      <span>{r.title}</span>
                      {r.target_value && (
                        <span className={styles.target}>{r.target_value} {r.unit}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  className={`${styles.applyBtn} ${isApplied ? styles.applyBtnDone : ""}`}
                  onClick={() => handleApply(t)}
                  disabled={isApplied || isApplying}
                  style={{ "--t-color": t.color } as React.CSSProperties}
                >
                  {isApplying ? "Criando..." : isApplied ? "✓ Adicionado" : "＋ Usar template"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

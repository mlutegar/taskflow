import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useConfirm } from "./ConfirmDialog";
import { useToast } from './shared/Toast';
import { useFocusTrap } from "../hooks/useFocusTrap";
import ModeSession from "./ModeSession";
import ModeComboSession from "./ModeComboSession";
import ModalOverlay from "./shared/ModalOverlay";
import styles from "./ModesPanel.module.css";
import dfStyles from "./daily-focus/DailyFocus.module.css";
import { modeStatsApi } from "../api/modeStats";
import { getPinned, metaFor, pin, unpin } from "../lib/splitePinned";
import { logCompletion, usageStats } from "../lib/modeLog";
import { getAllActivations } from "../lib/modeActivations";
import { getCustomModes, saveCustomMode, deleteCustomMode } from "../lib/customModes";
import { useDialog } from "../lib/useDialog";
import { MODES, CATEGORY_BY_ID, CATEGORY_ORDER } from "../data/modes";
import { PRESET_COMBOS } from '../data/presetCombos';
import {
  getUsageLogs,
  getBestHourForMode,
  getModeSuccessRate,
  getPendingReminders,
  clearPendingReminder,
  getCurrentHourBlock,
} from "../lib/sessionUsageLog";
import { getComboStats } from "../lib/modeComboLog";
import { Task, Routine } from '../types/index';

// ── sessionStorage key para persistir seleção de combo ──────────────────────
const COMBO_SS_KEY = "modeComboSelected";

interface ModeClass {
  emoji: string;
  name: string;
  desc: string;
  color: string;
}

interface ModeConfig {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  color: string;
  colorBg: string;
  context?: string[];
  prerequisite?: string;
  whyItWorks?: string;
  whenToUse?: string;
  steps?: string[];
  tips?: string;
  category?: string;
  session?: string;
  preset?: Record<string, unknown>;
  isCustom?: boolean;
  classes?: ModeClass[];
  tags?: string[];
  type?: string;
}

interface SavedShuffle {
  id: number;
  name: string;
  seed: number;
}

interface ComboStat {
  key: string;
  modeIdA: string;
  modeIdB: string;
  total: number;
  successRate: number;
}

interface WeeklyEntry {
  modeId: string;
  count: number;
  mode?: ModeConfig;
}

interface Reminder {
  modeId: string;
  modeName: string;
}

interface DetoxSuggestion {
  platform: string;
  count: number;
  detoxId: string;
}

interface ComboSuggestion {
  modeA: ModeConfig;
  modeB: ModeConfig;
}

const MODES_INLINE_REMOVED: ModeConfig[] = [
  {
    id: "music",
    emoji: "🎵",
    name: "Music Mode",
    tagline: "Encontre a música certa, faça a tarefa certa",
    color: "#7c6ef5",
    colorBg: "rgba(124,110,245,0.08)",
    context: ["🖥️ Desktop", "🎧 Música"],
    prerequisite: "Spotify (ou qualquer player) aberto e fones de ouvido disponíveis.",
    whyItWorks: "A busca ativa pela música cria um ritual de transição mental — o ato de procurar já ativa o foco antes mesmo de começar a tarefa.",
    whenToUse: "Quando você está disperso e precisa de uma âncora sonora para entrar no ritmo.",
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
    prerequisite: "Celular com TikTok (ou Reels/Shorts) aberto e tarefas definidas.",
    whyItWorks: "Usa a dopamina dos vídeos como recompensa controlada, criando ciclos crescentes de trabalho com reforço positivo.",
    whenToUse: "Quando você está com vontade de procrastinar no TikTok — transforma o hábito em ferramenta.",
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
    prerequisite: "Uma atividade de recompensa definida (qualquer coisa que você goste e seja rápida).",
    whyItWorks: "Ciclos progressivos com recompensa personalizável — o controle sobre a recompensa aumenta a motivação intrínseca.",
    whenToUse: "Quando você quer ciclos de foco com uma recompensa que não seja redes sociais.",
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
    prerequisite: "Celular longe do alcance e uma tarefa qualquer selecionada.",
    whyItWorks: "5 minutos remove a barreira psicológica de começar — a inércia quebrada raramente volta, então você continua naturalmente.",
    whenToUse: "Quando você está travado e não consegue começar nada — é para vencer a resistência inicial.",
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
    prerequisite: "Café preparado (ou prestes a tomar).",
    whyItWorks: "Combina o efeito estimulante da cafeína com sprints cronometrados, maximizando o estado de alerta em blocos mensuráveis.",
    whenToUse: "Quando você tem energia de café disponível e quer extrair o máximo de cada dose.",
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
    prerequisite: "Sem pré-requisito externo — basta querer gamificar a sessão.",
    whyItWorks: "Transforma tarefas em quests com XP e classes, ativando a motivação por progressão e identidade do personagem.",
    whenToUse: "Quando as abordagens comuns parecem monótonas e você precisa de um elemento lúdico para se engajar.",
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
    prerequisite: "Uma atividade de recompensa definida e projetos com progresso parcial possível.",
    whyItWorks: "Ciclos progressivos com a opção de salvar progresso parcial — ideal para projetos longos que não cabem numa sessão.",
    whenToUse: "Quando você trabalha em projetos que levam múltiplas sessões e quer registrar progresso parcial.",
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
    prerequisite: "Café quente preparado + Spotify (ou player) aberto.",
    whyItWorks: "Âncora física (café) + âncora mental (música) juntas criam um estado de confiança e pico de energia mais forte do que cada uma separada.",
    whenToUse: "Quando você precisa de máxima energia e confiança para uma sessão importante.",
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
    prerequisite: "Apps que você vai usar abertos no celular antes de iniciar.",
    whyItWorks: "Distribui o foco entre múltiplas tarefas em rotação, evitando a fadiga de concentração única durante deslocamentos.",
    whenToUse: "Em transporte público ou momentos fragmentados onde foco longo não é possível.",
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
    prerequisite: "Uma música que você ama disponível para tocar.",
    whyItWorks: "Cantar libera tensão, ativa a respiração e cria um reset emocional — o estado pós-canto é naturalmente mais leve e focado.",
    whenToUse: "Quando você está tenso ou com energia represada antes de uma tarefa.",
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
    prerequisite: "Spotify ou app de música aberto para explorar e cantar junto.",
    whyItWorks: "A curadoria da fila de músicas mantém a sessão leve e divertida enquanto o trabalho acontece em segundo plano.",
    whenToUse: "Para sessões longas onde você quer tornar o trabalho mais prazeroso com música curada.",
    steps: [
      "Encontre uma música que dá vontade de cantar",
      "Registre na fila e faça uma tarefa cantando junto",
      "Repita até completar 10 músicas cantáveis",
      "Feche com sua fila curada de karaokê",
    ],
    tips: "A curadoria da fila mantém a sessão leve e divertida enquanto o trabalho acontece em segundo plano.",
  },

  // ── Modos de atividade independentes ──────────────────────────────────
  {
    id: "agua",
    emoji: "💧",
    name: "Beber Água",
    tagline: "Registre os copos de água ao longo do dia",
    color: "#4ea8cc",
    colorBg: "rgba(78,168,204,0.08)",
    category: "Ritual",
    session: "splite",
    preset: { activity: "Beber água", emoji: "💧", name: "Beber Água" },
    context: ["🖥️ Desktop", "💧 Saúde"],
    prerequisite: "Copo ou garrafa de água próximos ao computador.",
    whyItWorks: "Hidratação melhora concentração. Vincular água às tarefas cria um ritual simples de autocuidado fácil de manter.",
    whenToUse: "Durante qualquer sessão — especialmente em dias quentes ou sessões longas.",
    steps: [
      "Beba um copo de água antes de cada tarefa",
      "Marque o copo no contador",
      "Meta: 8 copos por dia",
      "A barra de progresso reseta automaticamente à meia-noite",
    ],
    tips: "Hidratação melhora concentração. Vincular a água às tarefas cria um ritual simples de autocuidado.",
  },
  {
    id: "meditar",
    emoji: "🧘",
    name: "Meditar",
    tagline: "Sessões de meditação entre as tarefas",
    color: "#7c6ef5",
    colorBg: "rgba(124,110,245,0.08)",
    category: "Ritual",
    session: "splite",
    preset: { activity: "Meditar", emoji: "🧘", name: "Meditar" },
    context: ["🖥️ Desktop", "🧘 Mindfulness"],
    prerequisite: "Local tranquilo por 5 a 20 minutos entre as tarefas.",
    whyItWorks: "Meditações curtas entre tarefas reduzem a fadiga de decisão, diminuem o cortisol e aumentam a clareza mental.",
    whenToUse: "Quando a cabeça está cheia e você precisa de um reset mental entre blocos de trabalho.",
    steps: [
      "Escolha a duração: 5, 10, 15 ou 20 minutos",
      "Feche os olhos e medite antes da tarefa",
      "Marque a sessão no contador",
      "Repita para cada tarefa do ciclo",
    ],
    tips: "Meditações curtas entre tarefas reduzem a fadiga de decisão e aumentam a clareza mental.",
  },
  {
    id: "ler_diario",
    emoji: "📖",
    name: "Ler Diário",
    tagline: "Releia entradas aleatórias do seu diário",
    color: "#c8874a",
    colorBg: "rgba(200,135,74,0.08)",
    category: "Ritual",
    session: "splite",
    preset: { activity: "Ler diário", emoji: "📖", name: "Ler Diário" },
    context: ["🖥️ Desktop", "📖 Reflexão"],
    prerequisite: "Diário pessoal (físico ou digital) acessível durante a sessão.",
    whyItWorks: "Reler o diário cria perspectiva sobre crescimento pessoal, reduzindo ansiedade e aumentando motivação pelo progresso já feito.",
    whenToUse: "Como ritual de abertura de sessão ou pausa reflexiva entre tarefas.",
    steps: [
      "Clique em 'Sortear data' para obter uma data aleatória",
      "Abra seu diário e leia a entrada daquela data",
      "Clique em '✅ Li!' — uma nova data é sorteada",
      "Faça uma tarefa e repita o ciclo",
    ],
    tips: "Reler o diário cria perspectiva sobre seu crescimento. Datas aleatórias trazem surpresas que o modo linear não traz.",
  },
  {
    id: "diario_falado",
    emoji: "🗣️",
    name: "Diário Falado",
    tagline: "Registre o diário falando em voz alta — sem escrever",
    color: "#a06bbf",
    colorBg: "rgba(160,107,191,0.08)",
    category: "Ritual",
    session: "diario_falado",
    context: ["🖥️ Desktop", "📖 Reflexão", "⚠️ Quando travado"],
    prerequisite: "Estar numa sessão de foco. A gravação é feita num app externo de sua escolha.",
    whyItWorks: "Falar em voz alta reduz a barreira de começar: pular o filtro de 'formular a frase certa por escrito' destrava quando a pessoa está paralisada.",
    whenToUse: "Quando você está travado, com a cabeça cheia, ou quando escrever parece pesado demais pra começar.",
    steps: [
      "Abra um app de gravação externo (Notas de voz, Otter, WhisperMemo...)",
      "Fale livremente — o que está sentindo, pensando, planejando",
      "Grave por 2–5 minutos sem filtrar",
      "Volte à tarefa com a cabeça mais leve",
    ],
    tips: "Falar em voz alta pula o filtro de 'formular a frase certa'. Serve para destravar quando escrever parece pesado demais.",
  },
  {
    id: "esticar",
    emoji: "🤸",
    name: "Esticar",
    tagline: "Pausas de alongamento entre as tarefas",
    color: "#4ecca3",
    colorBg: "rgba(78,204,163,0.08)",
    category: "Ritual",
    session: "splite",
    preset: { activity: "Esticar 5 minutos", emoji: "🤸", name: "Esticar" },
    context: ["🖥️ Desktop", "🤸 Movimento"],
    prerequisite: "Espaço físico para se levantar e movimentar (não precisa de equipamento).",
    whyItWorks: "Movimento libera tensão muscular acumulada e aumenta a circulação, melhorando o estado físico e cognitivo.",
    whenToUse: "Após períodos longos sentado — especialmente em sessões com mais de 1 hora de trabalho.",
    steps: [
      "Levante da cadeira e estique por 5 minutos",
      "Foque em pescoço, ombros e costas",
      "Marque a pausa no contador",
      "Volte para a tarefa renovado",
    ],
    tips: "Cada pausa de alongamento reduz tensão acumulada. Sessões longas sem movimento são o maior inimigo do foco.",
  },
  {
    id: "livro",
    emoji: "📚",
    name: "Ler Livro",
    tagline: "Leia capítulos entre as tarefas",
    color: "#f0a540",
    colorBg: "rgba(240,165,64,0.08)",
    category: "Ritual",
    session: "splite",
    preset: { activity: "Ler um capítulo de livro", emoji: "📚", name: "Ler Livro" },
    context: ["🖥️ Desktop", "📚 Leitura"],
    prerequisite: "Livro físico ou e-reader à mão durante a sessão.",
    whyItWorks: "Livros entre tarefas criam uma transição suave e reduzem o impulso de abrir redes sociais nos intervalos.",
    whenToUse: "Quando você quer avançar em leituras enquanto trabalha, usando as pausas de forma intencional.",
    steps: [
      "Registre o livro que está lendo",
      "Leia um capítulo antes de cada tarefa",
      "Marque o capítulo no contador",
      "Ao fim da sessão, veja seu progresso total",
    ],
    tips: "Livros entre tarefas criam uma transição suave. O contador de capítulos vira motivação extra para continuar lendo.",
  },
  {
    id: "exercicio",
    emoji: "🏃",
    name: "Exercício Rápido",
    tagline: "Rounds de exercício entre as tarefas",
    color: "#e05252",
    colorBg: "rgba(224,82,82,0.08)",
    category: "Ritual",
    session: "splite",
    preset: { activity: "Fazer exercícios rápidos", emoji: "🏃", name: "Exercício Rápido" },
    context: ["🖥️ Desktop", "🏃 Movimento"],
    prerequisite: "Espaço para se movimentar (burpees, agachamentos etc. — sem equipamento necessário).",
    whyItWorks: "Exercício aumenta dopamina e oxigenação cerebral, criando um estado de clareza e energia após cada round.",
    whenToUse: "Quando você está sobrecarregado e precisa de uma descarga de energia antes de cada tarefa.",
    steps: [
      "Faça um round de exercícios rápidos (burpees, agachamentos, etc.)",
      "Marque o round no contador",
      "Selecione uma tarefa e conclua",
      "Repita o ciclo",
    ],
    tips: "Exercício aumenta dopamina e oxigenação cerebral. Rounds curtos entre tarefas mantêm energia sem cansar demais.",
  },

  // ── Pomodoro Puro ───────────────────────────────────────
  {
    id: "pomodoro",
    emoji: "🍅",
    name: "Pomodoro",
    tagline: "Timer personalizado — você define a duração",
    color: "#e05252",
    colorBg: "rgba(224,82,82,0.08)",
    category: "Foco",
    session: "pomodoro",
    context: ["🖥️ Desktop", "⏱️ Timer"],
    prerequisite: "Sem pré-requisito — apenas escolha a duração ideal para você.",
    whyItWorks: "Blocos de tempo definidos criam urgência saudável e eliminam a paralisia de 'quanto tempo isso vai levar'.",
    whenToUse: "Para qualquer tipo de tarefa — especialmente quando você tem autonomia para definir o ritmo da sessão.",
    steps: [
      "Escolha a duração: 15, 25, 30, 45 ou 60 minutos",
      "Selecione uma tarefa para trabalhar",
      "Foque até o timer acabar",
      "Faça uma pausa e repita",
    ],
    tips: "Diferente do Momentum (5 min fixos) e Espresso (25 min), o Pomodoro deixa você definir o tempo ideal para cada sessão.",
  },
]; // <- array inline descontinuado; dados vêm de src/data/modes.js

// ── Cards do Splite separados por atividade (reutilizam a SpliteSession com preset) ──
// Gerados dinamicamente a partir das atividades "fixadas" (lib/splitePinned.js).
const slug = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function buildSpliteModes(pinnedActivities: string[]): ModeConfig[] {
  return pinnedActivities.map((activity, i) => {
    const { emoji, color } = metaFor(activity, i);
    return {
      id: `splite_${slug(activity)}`,
      emoji,
      name: activity,
      tagline: `Ciclos progressivos com "${activity}" entre tarefas`,
      color,
      colorBg: hexToRgba(color, 0.08),
      category: "Ciclos",
      session: "splite",
      preset: { activity },
      context: ["🖥️ Desktop", "🔄 Ciclos"],
      prerequisite: `"${activity}" disponível para usar como pausa entre as tarefas.`,
      whyItWorks: `Ciclos progressivos com "${activity}" como recompensa treinável — a atividade fixa cria um ritual previsível e motivador.`,
      whenToUse: `Quando você quer ciclos de foco com "${activity}" como recompensa consistente.`,
      steps: [
        `Ciclo 1: "${activity}" 1× → 1 tarefa`,
        `Ciclo 2: "${activity}" 2× → 2 tarefas`,
        "Continue aumentando progressivamente",
        "A atividade de recompensa já vem escolhida",
      ],
      tips: `Variante do Splite Mode com "${activity}" fixa como recompensa entre as tarefas.`,
    };
  });
}

const categoryOf = (m: ModeConfig): string =>
  m.isCustom ? "Personalizados" : (m.category || CATEGORY_BY_ID[m.id] || "Outros");

const EMOJI_PRESETS: string[] = ["🚀", "🔥", "💎", "🧠", "🎯", "⭐", "🌊", "🏆", "💪", "🎲", "🌙", "⚙️", "🦁", "🐉", "🧩"];
const COLOR_PRESETS: string[] = [
  "#7c6ef5", "#e05252", "#f0a540", "#4ecca3", "#c8874a",
  "#b06ef5", "#4ea8cc", "#e07c52", "#52b0e0", "#a0c840",
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface CreateModeModalProps {
  onSave: (mode: ModeConfig) => void;
  onClose: () => void;
}

function CreateModeModal({ onSave, onClose }: CreateModeModalProps) {
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
      isCustom: true,
    });
  };

  const updateStep = (i: number, val: string): void => setSteps((prev) => prev.map((s, idx) => idx === i ? val : s));
  const addStep = (): void => setSteps((prev) => [...prev, ""]);
  const removeStep = (i: number): void => setSteps((prev) => prev.filter((_, idx) => idx !== i));

  const dialogRef = useDialog(onClose);

  return (
    <ModalOverlay onClose={onClose}>
      <div className={styles.modal} ref={dialogRef} role="dialog" aria-modal="true" aria-label="Criar modo personalizado" tabIndex={-1}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>✨ Criar Modo Personalizado</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Fechar">×</button>
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
                    <button className={styles.removeStepBtn} onClick={() => removeStep(i)} title="Remover passo" aria-label={`Remover passo ${i + 1}`}>×</button>
                  )}
                </div>
              ))}
              <button className={styles.addStepBtn} onClick={addStep}>+ Adicionar passo</button>
            </div>
          </div>

          {/* Prerequisite */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>✅ Pré-requisito *</label>
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
            <label className={styles.formLabel}>🧠 Por que funciona *</label>
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
            <label className={styles.formLabel}>🕐 Quando usar *</label>
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
    </ModalOverlay>
  );
}

interface ModesPanelProps {
  tasks: Task[];
  routines?: Routine[];
  onCompleteTask: (id: string) => void;
  onCompleteRoutine: (id: string) => void;
  onAddTask: (task: unknown) => void;
  onAddChecklist: (taskId: string, item: unknown) => void;
  onToggleChecklist: (taskId: string, itemId: string) => void;
  onAddRoutineChecklist: (routineId: string, item: unknown) => void;
  onToggleRoutineChecklist: (routineId: string, itemId: string) => void;
}

export default function ModesPanel({ tasks, routines = [], onCompleteTask, onCompleteRoutine, onAddTask, onAddChecklist, onToggleChecklist, onAddRoutineChecklist, onToggleRoutineChecklist }: ModesPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ModeConfig | null>(null); // objeto completo do modo
  const [showCreate, setShowCreate] = useState<boolean>(false);
  // Combo de modos: array com até 2 ids selecionados; activeCombo = { modeA, modeB }
  // Persiste no sessionStorage por ~10 min para sobreviver troca de tabs
  const [comboSelected, setComboSelectedRaw] = useState<string[]>(() => {
    try {
      const raw = sessionStorage.getItem(COMBO_SS_KEY);
      if (!raw) return [];
      const { ids, ts } = JSON.parse(raw);
      if (Date.now() - ts < 10 * 60 * 1000) return ids;
    } catch {}
    return [];
  });
  const setComboSelected = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    setComboSelectedRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { sessionStorage.setItem(COMBO_SS_KEY, JSON.stringify({ ids: next, ts: Date.now() })); } catch {}
      return next;
    });
  }, []);

  const [activeCombo, setActiveCombo] = useState<{ modeA: ModeConfig; modeB: ModeConfig } | null>(null);
  // Estatísticas de combos já realizados
  const [comboStats, setComboStats] = useState<ComboStat[]>(() => getComboStats());
  const [sortBy, setSortBy] = useState<string>(() => localStorage.getItem('taskflow.modesSortBy') || 'default'); // "default" | "tasks" | "random" | "smart"
  const [category, setCategory] = useState<string>(() => localStorage.getItem('taskflow.modesCategory') || ''); // "" = todas
  const [pinnedSplite, setPinnedSplite] = useState<string[]>(() => getPinned());
  const [weekly, setWeekly] = useState<WeeklyEntry[]>(() => usageStats(7));
  const [activations, setActivations] = useState<Record<string, number>>(() => {
    const all = getAllActivations();
    return Object.fromEntries(all.map(({ modeId, count }: { modeId: string; count: number }) => [modeId, count]));
  });

  const [customModes, setCustomModes] = useState<ModeConfig[]>(() => getCustomModes());
  // ── Novas features ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showAddActivity, setShowAddActivity] = useState<boolean>(false);
  const [newActivity, setNewActivity] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [flashingCard, setFlashingCard] = useState<string | null>(null);
  const [shuffleAnim, setShuffleAnim] = useState<boolean>(false);
  const sessionRef = useRef<HTMLDivElement>(null);

  // ── Sequência aleatória ─────────────────────────────────────────────────────
  // #4 Progresso: IDs já iniciados na sequência atual
  const [startedInSequence, setStartedInSequence] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('taskflow.sequenceStarted') || '[]')); }
    catch { return new Set(); }
  });
  // #5 Ordens salvas (máx 3): [{id, name, seed}]
  const [savedShuffles, setSavedShuffles] = useState<SavedShuffle[]>(() => {
    try { return JSON.parse(localStorage.getItem('taskflow.savedShuffles') || '[]'); }
    catch { return []; }
  });
  const [showSaveShuffleInput, setShowSaveShuffleInput] = useState<boolean>(false);
  const [shuffleSaveName, setShuffleSaveName] = useState<string>('');
  // #7 Sequência guiada
  const [guidedMode, setGuidedMode] = useState<boolean>(() => localStorage.getItem('taskflow.guidedMode') === 'true');
  // #8 Smart shuffle (peso inversamente proporcional ao uso)
  const [smartShuffle, setSmartShuffle] = useState<boolean>(() => localStorage.getItem('taskflow.smartShuffle') === 'true');

  // ── Favorites ───────────────────────────────────────────────────────────────
  const [favoriteModes, setFavoriteModes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('taskflow.favoriteModes') || '[]'); }
    catch { return []; }
  });
  const toggleFavorite = (id: string): void => {
    setFavoriteModes(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('taskflow.favoriteModes', JSON.stringify(next));
      return next;
    });
  };

  // ── Auto-detox banner ────────────────────────────────────────────────────────
  const [detoxDismissed, setDetoxDismissed] = useState<boolean>(false);

  // ── Preset Combos collapse ───────────────────────────────────────────────────
  const [combosSectionCollapsed, setCombosSectionCollapsed] = useState<boolean>(false);

  // ── Compact view ─────────────────────────────────────────────────────────────
  const [compactView, setCompactView] = useState<boolean>(false);

  // Atualiza modos customizados quando o backend os hidrata no localStorage (ex: primeiro acesso no celular)
  useEffect(() => {
    const handler = () => setCustomModes(getCustomModes());
    window.addEventListener("customModesUpdated", handler);
    return () => window.removeEventListener("customModesUpdated", handler);
  }, []);

  const { confirm, ConfirmUI } = useConfirm();
  const { showToast } = useToast();

  // Focus trap for the active ModeSession modal (sessionRef is the container div)
  useFocusTrap(sessionRef, !!activeSession, () => (modeSessionRef as any).current?.triggerClose());

  // Registros de uso pós-sessão para insights nos cards
  const [usageLogs, setUsageLogs] = useState<any[]>(() => getUsageLogs());
  // Lembretes pendentes (sessões puladas sem registrar)
  const [reminders, setReminders] = useState<Reminder[]>(() => getPendingReminders());

  // Recarrega usage logs e lembretes quando a sessão fecha
  const refreshInsights = (): void => {
    setUsageLogs(getUsageLogs());
    setReminders(getPendingReminders());
  };

  // Stats: { [modeId]: number }
  // Início: carrega do localStorage como cache otimista, depois sincroniza com o banco
  const [modeStats, setModeStats] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("modeStats") || "{}"); }
    catch { return {}; }
  });

  // Carrega stats do banco ao montar
  useEffect(() => {
    modeStatsApi.list()
      .then((stats: Record<string, number>) => {
        setModeStats(stats);
        localStorage.setItem("modeStats", JSON.stringify(stats));
      })
      .catch(() => {
        // Mantém localStorage como fallback se o banco falhar
      });
  }, []);

  const handleModeTaskComplete = async (modeId: string): Promise<void> => {
    // #4/#7: marcar como concluído na sequência aleatória
    if (sortBy === "random") {
      setStartedInSequence((prev) => {
        const next = new Set(prev);
        next.add(modeId);
        localStorage.setItem('taskflow.sequenceStarted', JSON.stringify([...next]));
        return next;
      });
    }
    // Log local para o painel "mais usados na semana"
    logCompletion(modeId);
    setWeekly(usageStats(7));
    // Update otimista imediato na UI e no cache local
    setModeStats((prev) => {
      const updated = { ...prev, [modeId]: (prev[modeId] || 0) + 1 };
      localStorage.setItem("modeStats", JSON.stringify(updated));
      return updated;
    });
    // Persiste no banco (incremento atômico via RPC)
    try {
      const newCount: number = await modeStatsApi.increment(modeId);
      // Sincroniza o valor exato retornado pelo banco
      setModeStats((prev) => {
        const updated = { ...prev, [modeId]: newCount };
        localStorage.setItem("modeStats", JSON.stringify(updated));
        return updated;
      });
      showToast('Progresso salvo!', 'success');
    } catch (e: any) {
      // Falhou no banco — localStorage já tem o valor otimista, ok por ora
      console.warn("Falha ao salvar stat no banco:", e.message);
      showToast('Falha ao salvar — dados mantidos localmente', 'error');
    }
  };

  const toggle = (id: string): void => setExpanded((p) => (p === id ? null : id));

  const toggleCombo = (id: string): void => {
    setComboSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length < 2) return [...prev, id];
      // Substitui o mais antigo (índice 0) pelo novo
      return [prev[1], id];
    });
  };

  const handleStartCombo = (): void => {
    if (comboSelected.length !== 2) return;
    const modeA = modeById[comboSelected[0]];
    const modeB = modeById[comboSelected[1]];
    if (modeA && modeB) setActiveCombo({ modeA, modeB });
  };

  const handleSaveMode = (newMode: ModeConfig): void => {
    const updated = saveCustomMode(newMode);
    setCustomModes(updated ?? getCustomModes());
    setShowCreate(false);
    showToast('Modo criado!', 'success');
  };

  const toggleCategory = (name: string): void => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleAddActivity = (): void => {
    const activity = newActivity.trim();
    if (!activity) return;
    const updated = pin(activity);
    setPinnedSplite([...updated]);
    setNewActivity("");
    setShowAddActivity(false);
  };

  const handleUnpinActivity = (activity: string): void => {
    const updated = unpin(activity);
    setPinnedSplite([...updated]);
  };

  const handleDeleteMode = async (id: string): Promise<void> => {
    const mode = customModes.find((m) => m.id === id);
    const ok = await confirm({
      title: `Excluir modo "${mode?.name ?? ""}"?`,
      message: "Esse modo customizado será removido permanentemente.",
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const updated = deleteCustomMode(id);
    setCustomModes(updated ?? getCustomModes());
    showToast('Modo excluído.', 'info');
  };

  const hasRequiredFields = (m: ModeConfig): boolean =>
    !!(m.prerequisite?.trim() && m.whyItWorks?.trim() && m.whenToUse?.trim());

  const incompleteCustomModes = customModes.filter((m) => !hasRequiredFields(m));

  // Cards do Splite ordenados por frequência de uso (mais usado primeiro)
  const spliteCards = buildSpliteModes(pinnedSplite)
    .sort((a, b) => (activations[b.id] || 0) - (activations[a.id] || 0));

  const allModes: ModeConfig[] = [...MODES.filter((m: ModeConfig) => m.id !== "splite"), ...spliteCards, ...customModes]
    .filter(hasRequiredFields);
  const modeById: Record<string, ModeConfig> = Object.fromEntries(allModes.map((m) => [m.id, m]));

  // Filtra por busca de texto
  const sq = searchQuery.trim().toLowerCase();
  const displayModes: ModeConfig[] = sq
    ? allModes.filter(m =>
        m.name.toLowerCase().includes(sq) ||
        (m.tagline || '').toLowerCase().includes(sq) ||
        (m.context || []).some(c => c.toLowerCase().includes(sq)) ||
        (m.whenToUse || '').toLowerCase().includes(sq) ||
        (m.tags || []).some(t => t.toLowerCase().includes(sq))
      )
    : allModes;

  // Top modos da semana (com metadados conhecidos)
  const topWeekly: WeeklyEntry[] = weekly
    .map((w) => ({ ...w, mode: modeById[w.modeId] }))
    .filter((w) => w.mode)
    .slice(0, 5);
  const weeklyMax = topWeekly.reduce((mx, w) => Math.max(mx, w.count), 0);

  // Categorias presentes (na ordem canônica, só as que têm modos)
  const presentCategories: string[] = CATEGORY_ORDER.filter((c: string) => displayModes.some((m) => categoryOf(m) === c));

  // ── Scores inteligentes pré-computados (evita recalcular por comparação no sort) ──
  const smartScores: Record<string, number> = useMemo(() => {
    const currentBlock = getCurrentHourBlock();
    const lastLog = usageLogs[usageLogs.length - 1];
    const IDLE_BOOST_IDS = ["momentum", "espresso", "music", "cafe-ritual"];

    // Pré-calcula idle time uma vez
    let minutesIdle = 0;
    if (lastLog) {
      const lastDate = new Date(
        lastLog.date + "T" + String(lastLog.hour).padStart(2, "0") + ":00"
      );
      minutesIdle = (Date.now() - lastDate.getTime()) / 60000;
    }

    const scores: Record<string, number> = {};
    for (const mode of allModes) {
      let score = 0;

      // +3 se o melhor horário histórico coincide com o bloco atual
      const bestHour = getBestHourForMode(mode.id);
      if (bestHour && bestHour.block.id === currentBlock.id) score += 3;

      // +2 / +1 por taxa de sucesso
      const sr = getModeSuccessRate(mode.id);
      if (sr && sr.successRate >= 70) score += 2;
      else if (sr && sr.successRate >= 50) score += 1;

      // -2 se foi o último modo usado (evita repetição imediata)
      if (lastLog && lastLog.modeId === mode.id) score -= 2;

      // +1 se muito utilizado (tarefas concluídas)
      if ((modeStats[mode.id] || 0) >= 5) score += 1;

      // +2 para modos de entrada se usuário parado > 45 min
      if (IDLE_BOOST_IDS.includes(mode.id) && minutesIdle > 45) score += 2;

      scores[mode.id] = score;
    }
    return scores;
  }, [allModes, usageLogs, modeStats]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-detox suggestion ──────────────────────────────────────────────────
  const detoxSuggestion: DetoxSuggestion | null = useMemo(() => {
    if (detoxDismissed) return null;
    const recent = usageLogs.slice(-10);
    const platforms = ['youtube', 'tiktok', 'reels', 'twitter', 'reddit', 'whatsapp', 'netflix'];
    for (const p of platforms) {
      const count = recent.filter((l: any) => l.modeId && l.modeId.startsWith(p + '_')).length;
      if (count >= 3) {
        const detoxId = p + '_detox';
        if (modeById[detoxId]) return { platform: p, count, detoxId };
      }
    }
    return null;
  }, [usageLogs, detoxDismissed, modeById]);

  // ── Ordem aleatória estável: só reembaralha quando o usuário clica em "Aleatório" ──
  const [randomSeed, setRandomSeed] = useState<number>(() => parseInt(localStorage.getItem('taskflow.modesRandomSeed') || '0', 10));
  const randomOrder: string[] = useMemo(() => {
    // #6: se há categoria ativa, embaralha apenas os modos dela
    const pool = category ? allModes.filter((m) => categoryOf(m) === category) : allModes;
    const ids = pool.map((m) => m.id);
    let rng = randomSeed || 1;
    const next = (): number => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0x100000000; };

    if (smartShuffle) {
      // #8: peso inversamente proporcional ao uso — menos usado = aparece antes
      const scored = ids.map((id) => {
        const r = next();
        const usage = modeStats[id] || 0;
        return { id, score: r / (usage + 1) };
      });
      return scored.sort((a, b) => b.score - a.score).map((s) => s.id);
    }

    // Fisher-Yates puro com seed
    const arr = [...ids];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [allModes, randomSeed, smartShuffle, modeStats, category]);

  const handleSetRandom = (): void => {
    const newSeed = Math.floor(Math.random() * 0xffffffff) + 1;
    setRandomSeed(newSeed);
    localStorage.setItem('taskflow.modesRandomSeed', String(newSeed));
    localStorage.setItem('taskflow.modesSortBy', 'random');
    setSortBy("random");
    // #4: limpar progresso da sequência ao reembaralhar
    setStartedInSequence(new Set());
    localStorage.removeItem('taskflow.sequenceStarted');
    setShuffleAnim(true);
    setTimeout(() => setShuffleAnim(false), 550);
  };

  // #5: salvar ordem atual com nome
  const handleSaveShuffle = (): void => {
    const name = shuffleSaveName.trim() || `Ordem ${savedShuffles.length + 1}`;
    const entry: SavedShuffle = { id: randomSeed, name, seed: randomSeed };
    const updated = [...savedShuffles.filter((s) => s.seed !== randomSeed).slice(-2), entry];
    setSavedShuffles(updated);
    localStorage.setItem('taskflow.savedShuffles', JSON.stringify(updated));
    setShuffleSaveName('');
    setShowSaveShuffleInput(false);
  };

  // #5: carregar ordem salva
  const loadSavedShuffle = (shuffle: SavedShuffle): void => {
    setRandomSeed(shuffle.seed);
    localStorage.setItem('taskflow.modesRandomSeed', String(shuffle.seed));
    setSortBy('random');
    localStorage.setItem('taskflow.modesSortBy', 'random');
    setStartedInSequence(new Set());
    localStorage.removeItem('taskflow.sequenceStarted');
  };

  // #5: excluir ordem salva
  const deleteSavedShuffle = (id: number): void => {
    const updated = savedShuffles.filter((s) => s.id !== id);
    setSavedShuffles(updated);
    localStorage.setItem('taskflow.savedShuffles', JSON.stringify(updated));
  };

  // #7: alternar sequência guiada
  const toggleGuidedMode = (): void => {
    setGuidedMode((prev) => {
      localStorage.setItem('taskflow.guidedMode', String(!prev));
      return !prev;
    });
  };

  // #8: alternar smart shuffle
  const toggleSmartShuffle = (): void => {
    setSmartShuffle((prev) => {
      localStorage.setItem('taskflow.smartShuffle', String(!prev));
      return !prev;
    });
  };

  const applySort = (list: ModeConfig[]): ModeConfig[] => {
    if (sortBy === "tasks")
      return [...list].sort((a, b) => (modeStats[b.id] || 0) - (modeStats[a.id] || 0));
    if (sortBy === "random") {
      const pos = Object.fromEntries(randomOrder.map((id, i) => [id, i]));
      return [...list].sort((a, b) => (pos[a.id] ?? 999) - (pos[b.id] ?? 999));
    }
    if (sortBy === "smart")
      return [...list].sort((a, b) => (smartScores[b.id] ?? 0) - (smartScores[a.id] ?? 0));
    return list; // "default"
  };

  // Quando sort é smart/random → lista plana (sem agrupamento por categoria)
  const flatSortedModes: ModeConfig[] | null =
    sortBy === "random" || sortBy === "smart"
      ? applySort(category ? displayModes.filter((m) => categoryOf(m) === category) : displayModes)
      : null;

  // Sem filtro → agrupa por categoria; com filtro → um único grupo
  const groups: { name: string; modes: ModeConfig[] }[] = category
    ? [{ name: category, modes: applySort(displayModes.filter((m) => categoryOf(m) === category)) }]
    : presentCategories.map((c) => ({ name: c, modes: applySort(displayModes.filter((m) => categoryOf(m) === c)) }));

  // Pré-computa contagem de combos por modo (quantas vezes aparece em qualquer par)
  const comboCountByMode: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of comboStats) {
      map[s.modeIdA] = (map[s.modeIdA] || 0) + s.total;
      map[s.modeIdB] = (map[s.modeIdB] || 0) + s.total;
    }
    return map;
  }, [comboStats]);

  // Sugestão inteligente de combo: par com maior soma de smartScores ainda não tentado
  const comboSuggestion: ComboSuggestion | null = useMemo(() => {
    if (sortBy !== "smart") return null;
    const triedPairs = new Set(comboStats.map((s) => `${s.modeIdA}+${s.modeIdB}`));
    const topModes = allModes
      .filter((m) => (smartScores[m.id] ?? 0) >= 2)
      .sort((a, b) => (smartScores[b.id] ?? 0) - (smartScores[a.id] ?? 0))
      .slice(0, 6);
    let best: ComboSuggestion | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < topModes.length; i++) {
      for (let j = i + 1; j < topModes.length; j++) {
        const [a, b] = [topModes[i].id, topModes[j].id].sort();
        const key = `${a}+${b}`;
        const score = (smartScores[topModes[i].id] ?? 0) + (smartScores[topModes[j].id] ?? 0);
        if (!triedPairs.has(key) && score > bestScore) {
          bestScore = score;
          best = { modeA: topModes[i], modeB: topModes[j] };
        }
      }
    }
    return best;
  }, [sortBy, comboStats, allModes, smartScores]);

  const modeSessionRef = useRef<any>(null);

  const renderCard = (mode: ModeConfig, index: number) => {
    const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date()); // YYYY-MM-DD
    const usedToday = usageLogs.some((l: any) => l.modeId === mode.id && l.date === todayStr);

    if (compactView) {
      return (
        <div key={mode.id} className={styles.compactCard} style={{ borderLeft: '3px solid ' + mode.color }}
          onClick={() => setActiveSession(mode)}>
          <span className={styles.compactEmoji}>{mode.emoji}</span>
          <div className={styles.compactInfo}>
            <strong>{mode.name}</strong>
            <span className={styles.compactTagline}>{mode.tagline}</span>
          </div>
          {usedToday && <span className={styles.usedTodayBadge}>hoje</span>}
        </div>
      );
    }

    const open = expanded === mode.id;
    const taskCount = modeStats[mode.id] || 0;
    const activationCount = activations[mode.id] || 0;
    const successRate = getModeSuccessRate(mode.id);           // null se < 3 sessões
    const bestHour = getBestHourForMode(mode.id);              // null se < 3 sessões no bloco
    // Badge "ideal agora" para os top-3 no smart sort
    const score = smartScores[mode.id] ?? 0;
    const showSmartBadge = sortBy === "smart" && score >= 2 && index < 3;
    const isComboSelected = comboSelected.includes(mode.id);
    const comboCount = comboCountByMode[mode.id] || 0;
    const isActiveSession = activeSession?.id === mode.id;
    // #4/#7: estado na sequência aleatória
    const inRandomMode = sortBy === "random";
    const wasStartedInSeq = inRandomMode && startedInSequence.has(mode.id);
    const isNextGuided = guidedMode && inRandomMode && !wasStartedInSeq &&
      (flatSortedModes ? flatSortedModes.slice(0, index).every((m) => startedInSequence.has(m.id)) : false);
    return (
      <div
        key={mode.id}
        className={`${styles.card} ${open ? styles.cardOpen : ""} ${mode.isCustom ? styles.cardCustom : ""} ${isComboSelected ? styles.cardComboSelected : ""} ${isActiveSession ? styles.cardActive : ""} ${isNextGuided ? styles.guidedNext : ""} ${wasStartedInSeq ? styles.seqDone : ""}`}
        style={{ "--mode-color": mode.color, "--mode-bg": mode.colorBg } as React.CSSProperties}
      >
        <div className={styles.cardHeader}>
          <button className={styles.cardToggle} onClick={() => toggle(mode.id)}>
            <span className={styles.cardEmoji}>{mode.emoji}</span>
            <div className={styles.cardMeta}>
              <div className={styles.cardNameRow}>
                <span className={styles.cardName}>{mode.name}</span>
                {/* #4: badge de posição na sequência aleatória */}
                {inRandomMode && (
                  <span className={`${styles.seqBadge} ${wasStartedInSeq ? styles.seqBadgeDone : ""} ${isNextGuided ? styles.seqBadgeNext : ""}`}>
                    {wasStartedInSeq ? "✓" : isNextGuided ? `▶ #${index + 1}` : `#${index + 1}`}
                  </span>
                )}
                {isActiveSession && (
                  <span className={styles.cardActiveIndicator}>● Em sessão</span>
                )}
                {showSmartBadge && (
                  <span className={styles.smartBadge} title={`Pontuação smart: ${score}`}>
                    ✨ ideal agora
                  </span>
                )}
                {mode.isCustom && <span className={styles.customBadge}>Personalizado</span>}
                {taskCount > 0 && (
                  <span className={styles.statBadge}>✓ {taskCount}</span>
                )}
                {activationCount > 0 && (
                  <span className={styles.statBadge} style={{ opacity: 0.75 }} title="Ativações">
                    ▶ {activationCount}
                  </span>
                )}
                {comboCount > 0 && (
                  <span className={styles.statBadge} style={{ background: "rgba(124,110,245,0.12)", color: "var(--accent)", border: "1px solid rgba(124,110,245,0.25)" }} title={`${comboCount} sessão(ões) em combo`}>
                    🔀 {comboCount}
                  </span>
                )}
                {/* Badge "nunca usado" — só exibe no modo smart para encorajar exploração */}
                {taskCount === 0 && activationCount === 0 && sortBy === "smart" && (
                  <span className={styles.neverUsedBadge} title="Você ainda não usou este modo">Nunca usado</span>
                )}
                {/* Feature 8: taxa de sucesso baseada nos registros de uso */}
                {successRate && (
                  <span
                    className={styles.statBadge}
                    style={{
                      background: successRate.successRate >= 70 ? "rgba(78,204,163,0.15)" : successRate.successRate >= 40 ? "rgba(124,110,245,0.12)" : "rgba(224,82,82,0.12)",
                      color: successRate.successRate >= 70 ? "var(--success)" : successRate.successRate >= 40 ? "var(--accent)" : "#e05252",
                      border: "none",
                    }}
                    title={`${successRate.worked} de ${successRate.total} sessões funcionaram`}
                  >
                    ✅ {successRate.worked}/{successRate.total}
                  </span>
                )}
              </div>
              <div className={styles.cardTaglineRow}>
                <span className={styles.cardTagline}>{mode.tagline}</span>
                {usedToday && <span className={styles.usedTodayBadge}>usado hoje</span>}
              </div>
              {/* Feature 1: recomendação proativa de horário */}
              {bestHour && (
                <span className={styles.hourRecommendation} title="Baseado no seu histórico de uso">
                  💡 Melhor na {bestHour.block.emoji} {bestHour.block.label} — {bestHour.successRate}% de sucesso
                </span>
              )}
              {!open && mode.prerequisite && (
                <span className={styles.cardPrereqHint} title="Pré-requisito">
                  ✅ {mode.prerequisite}
                </span>
              )}
              {mode.context?.length > 0 && (
                <div className={styles.contextTags}>
                  {mode.context.map((tag) => (
                    <span
                      key={tag}
                      className={tag.startsWith("⚠️") ? styles.contextTagWarning : styles.contextTag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>›</span>
          </button>

          <div className={styles.cardActions}>
            <button
              className={styles.favBtn}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleFavorite(mode.id); }}
              title={favoriteModes.includes(mode.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              {favoriteModes.includes(mode.id) ? '⭐' : '☆'}
            </button>
            {isActiveSession ? (
              <button
                className={styles.viewSessionBtn}
                onClick={() => sessionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                title="Ir para a sessão ativa"
              >
                ● Ver sessão ↑
              </button>
            ) : (
              <>
                <button
                  className={`${styles.comboBtn} ${isComboSelected ? styles.comboBtnActive : ""}`}
                  onClick={() => toggleCombo(mode.id)}
                  title={isComboSelected ? "Remover do combo" : "Adicionar ao combo"}
                >
                  {isComboSelected ? "✓" : "+"}
                </button>
                <button
                  className={`${styles.startBtn} ${flashingCard === mode.id ? styles.startBtnFlash : ""}`}
                  onClick={() => {
                    setFlashingCard(mode.id);
                    setTimeout(() => setFlashingCard(null), 450);
                    // #4: registrar início na sequência aleatória
                    if (sortBy === "random") {
                      setStartedInSequence((prev) => {
                        const next = new Set(prev);
                        next.add(mode.id);
                        localStorage.setItem('taskflow.sequenceStarted', JSON.stringify([...next]));
                        return next;
                      });
                    }
                    setTimeout(() => setActiveSession(mode), 150);
                  }}
                  title={`Iniciar ${mode.name}`}
                >
                  ▶ Iniciar
                </button>
              </>
            )}
            {mode.isCustom && (
              <button
                className={styles.deleteBtn}
                onClick={() => handleDeleteMode(mode.id)}
                title="Excluir modo"
              >
                ×
              </button>
            )}
            {mode.id.startsWith("splite_") && (
              <button
                className={styles.deleteBtn}
                onClick={() => handleUnpinActivity(mode.preset?.activity as string)}
                title="Remover atividade"
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

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>✅ Pré-requisito</span>
                <p className={styles.infoText}>{mode.prerequisite}</p>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>🧠 Por que funciona</span>
                <p className={styles.infoText}>{mode.whyItWorks}</p>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>🕐 Quando usar</span>
                <p className={styles.infoText}>{mode.whenToUse}</p>
              </div>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Como funciona</span>
              <ol className={styles.stepList}>
                {mode.steps?.map((step, i) => (
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
                    <div key={cls.name} className={styles.classItem} style={{ "--cls-color": cls.color } as React.CSSProperties}>
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

  const openDailyFocus = (): void => {
    window.open(window.location.href.split("#")[0] + "#/daily-focus", "_blank");
  };

  return (
    <div className={styles.root}>
      {/* Feature 3: Lembretes de sessões não registradas */}
      {reminders.map((r) => (
        <div key={r.modeId} className={styles.reminderBanner}>
          <span className={styles.reminderIcon}>📝</span>
          <span className={styles.reminderText}>
            Você pulou o registro da sessão de <strong>{r.modeName}</strong>. Que tal registrar agora?
          </span>
          <button
            className={styles.reminderRegisterBtn}
            onClick={() => setActiveSession(null) || setReminders((prev) => {
              clearPendingReminder(r.modeId);
              return prev.filter((x) => x.modeId !== r.modeId);
            })}
          >
            Dispensar
          </button>
        </div>
      ))}

      {/* Daily Focus card */}
      <div className={dfStyles.dailyFocusCard} onClick={openDailyFocus} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && openDailyFocus()}>
        <span className={dfStyles.dailyFocusCardEmoji}>🎯</span>
        <div className={dfStyles.dailyFocusCardInfo}>
          <div className={dfStyles.dailyFocusCardName}>Daily Focus</div>
          <div className={dfStyles.dailyFocusCardSub}>
            Sessões progressivas por nível · Timer + Modo de Apoio · Persiste o estado
          </div>
        </div>
        <span className={dfStyles.dailyFocusCardArrow}>↗</span>
      </div>

      {incompleteCustomModes.length > 0 && (
        <div className={styles.incompleteWarning}>
          <span className={styles.incompleteIcon}>⚠️</span>
          <span>
            <strong>{incompleteCustomModes.length}</strong> modo{incompleteCustomModes.length > 1 ? "s" : ""} personalizado{incompleteCustomModes.length > 1 ? "s" : ""} oculto{incompleteCustomModes.length > 1 ? "s" : ""} por faltarem campos obrigatórios:{" "}
            {incompleteCustomModes.map((m) => m.name).join(", ")}.
          </span>
          <button className={styles.incompleteEditBtn} onClick={() => setShowCreate(true)}>
            Criar completo →
          </button>
        </div>
      )}

      <div className={styles.panelHeader}>
        <p className={styles.subtitle}>
          Modos de atividade guiam sua sessão de trabalho com mecânicas específicas para cada estado de produtividade.
        </p>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
          <span>+</span> Criar Modo
        </button>
      </div>

      {/* Mais usados na semana */}
      <div className={styles.weeklyPanel}>
        <div className={styles.weeklyHeader}>
          <span className={styles.weeklyTitle}>⚡ Mais usados na semana</span>
          <span className={styles.weeklyNote}>últimos 7 dias · por dispositivo</span>
        </div>
        {topWeekly.length > 0 ? (
          <div className={styles.weeklyList}>
            {topWeekly.map((w) => (
              <div key={w.modeId} className={styles.weeklyRow}>
                <span className={styles.weeklyEmoji}>{w.mode!.emoji}</span>
                <span className={styles.weeklyName}>{w.mode!.name}</span>
                <div className={styles.weeklyBarTrack}>
                  <div
                    className={styles.weeklyBarFill}
                    style={{ width: `${weeklyMax ? (w.count / weeklyMax) * 100 : 0}%`, background: w.mode!.color }}
                  />
                </div>
                <span className={styles.weeklyCount}>{w.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.weeklyEmpty}>
            <span className={styles.weeklyEmptyIcon}>📊</span>
            Use 3+ modos essa semana para ver seu padrão aqui.
          </div>
        )}
      </div>

      {/* Painel: combos já testados */}
      {comboStats.length > 0 && (
        <div className={styles.weeklyPanel}>
          <div className={styles.weeklyHeader}>
            <span className={styles.weeklyTitle}>🔀 Combos testados</span>
            <span className={styles.weeklyNote}>por taxa de sucesso</span>
          </div>
          <div className={styles.weeklyList}>
            {comboStats.slice(0, 5).map((s) => {
              const mA = modeById[s.modeIdA];
              const mB = modeById[s.modeIdB];
              if (!mA || !mB) return null;
              return (
                <div key={s.key} className={styles.weeklyRow}>
                  <span className={styles.weeklyEmoji}>{mA.emoji}</span>
                  <span className={styles.weeklyName} title={`${mA.name} + ${mB.name}`}>
                    {mA.name} + {mB.name}
                  </span>
                  <div className={styles.weeklyBarTrack}>
                    <div
                      className={styles.weeklyBarFill}
                      style={{
                        width: `${s.successRate}%`,
                        background: s.successRate >= 70 ? "var(--success)" : s.successRate >= 40 ? "var(--accent)" : "#e05252",
                      }}
                    />
                  </div>
                  <span className={styles.weeklyCount}>{s.successRate}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de busca + toggle filtros */}
      <div className={styles.searchRow}>
        <div className={styles.searchBar} style={{ flex: 1 }}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Buscar modos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button className={styles.searchClear} onClick={() => setSearchQuery("")}>×</button>
          )}
        </div>
        <button
          className={`${styles.filterToggleBtn} ${(showFilters || category !== "" || sortBy !== "default") ? styles.filterToggleBtnActive : ""}`}
          onClick={() => setShowFilters((v) => !v)}
          title="Filtrar e ordenar"
        >
          {(category !== "" || sortBy !== "default") && <span className={styles.filterDot} />}
          Filtrar {showFilters ? "▲" : "▼"}
        </button>
        <button
          className={styles.filterToggleBtn}
          onClick={() => setCompactView(c => !c)}
          title={compactView ? 'Grade' : 'Compacto'}
        >
          {compactView ? '⊞' : '≡'}
        </button>
      </div>

      {/* Painel de filtros colapsável */}
      {showFilters && (
        <div className={styles.filterPanel}>
          {/* Filtro por categoria */}
          <div className={styles.sortBar}>
            <span className={styles.sortLabel}>Categoria:</span>
            <button
              className={`${styles.sortBtn} ${category === "" ? styles.sortBtnActive : ""}`}
              onClick={() => { setCategory(""); localStorage.setItem('taskflow.modesCategory', ''); }}
            >
              Todas
            </button>
            {presentCategories.map((c) => (
              <button
                key={c}
                className={`${styles.sortBtn} ${category === c ? styles.sortBtnActive : ""}`}
                onClick={() => { setCategory(c); localStorage.setItem('taskflow.modesCategory', c); }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Ordenação */}
          <div className={styles.sortBar}>
            <span className={styles.sortLabelOrder}>↕ Ordem:</span>
            <button
              className={`${styles.sortBtnOrder} ${sortBy === "default" ? styles.sortBtnOrderActive : ""}`}
              onClick={() => { setSortBy("default"); localStorage.setItem('taskflow.modesSortBy', 'default'); }}
            >
              Padrão
            </button>
            <button
              className={`${styles.sortBtnOrder} ${sortBy === "tasks" ? styles.sortBtnOrderActive : ""}`}
              onClick={() => { setSortBy("tasks"); localStorage.setItem('taskflow.modesSortBy', 'tasks'); }}
            >
              ⚡ Mais usados
            </button>
            <button
              className={`${styles.sortBtnOrder} ${sortBy === "random" ? styles.sortBtnOrderActive : ""}`}
              onClick={handleSetRandom}
            >
              <span className={shuffleAnim ? styles.shuffleSpin : ""}>🎲</span> Aleatório
              {/* #3: indicador de fixado */}
              {sortBy === "random" && <span className={styles.randomLockIcon} title="Ordem fixada — persiste ao recarregar">🔒</span>}
            </button>
            <button
              className={`${styles.sortBtnOrder} ${sortBy === "smart" ? styles.sortBtnOrderActive : ""}`}
              onClick={() => { setSortBy("smart"); localStorage.setItem('taskflow.modesSortBy', 'smart'); }}
            >
              ✨ Para mim agora
            </button>
          </div>
        </div>
      )}

      {sortBy === "smart" && (
        <p className={styles.smartSortHint}>
          ✨ Ordenado por: horário ideal · taxa de sucesso · tempo parado · histórico
        </p>
      )}

      {/* ── Painel de ferramentas do modo aleatório ── */}
      {sortBy === "random" && (
        <div className={styles.randomToolbar}>
          {/* #1: Reembaralhar */}
          <button className={styles.randomToolbarBtn} onClick={handleSetRandom} title="Gerar nova ordem aleatória">
            <span className={shuffleAnim ? styles.shuffleSpin : ""}>🔀</span> Reembaralhar
          </button>

          {/* #8: Smart shuffle */}
          <button
            className={`${styles.randomToolbarBtn} ${smartShuffle ? styles.randomToolbarBtnActive : ""}`}
            onClick={toggleSmartShuffle}
            title={smartShuffle ? "Aleatório inteligente ativo — modos menos usados aparecem primeiro" : "Ativar aleatório inteligente"}
          >
            🧠 {smartShuffle ? "Inteligente ativo" : "Inteligente"}
          </button>

          {/* #7: Sequência guiada */}
          <button
            className={`${styles.randomToolbarBtn} ${guidedMode ? styles.randomToolbarBtnActive : ""}`}
            onClick={toggleGuidedMode}
            title={guidedMode ? "Sequência guiada ativa — próximo modo destacado" : "Ativar sequência guiada"}
          >
            {guidedMode ? "▶ Guiado ativo" : "▶ Sequência guiada"}
          </button>

          {/* #4: Progresso da sequência */}
          {startedInSequence.size > 0 && (
            <span className={styles.seqProgress}>
              {startedInSequence.size}/{flatSortedModes?.length ?? 0} feitos
            </span>
          )}

          {/* #5: Salvar ordem */}
          {!showSaveShuffleInput ? (
            <button className={styles.randomToolbarBtn} onClick={() => setShowSaveShuffleInput(true)} title="Salvar esta ordem aleatória">
              💾 Salvar ordem
            </button>
          ) : (
            <div className={styles.saveShuffleRow}>
              <input
                className={styles.saveShuffleInput}
                placeholder={`Ordem ${savedShuffles.length + 1}`}
                value={shuffleSaveName}
                onChange={(e) => setShuffleSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveShuffle(); if (e.key === 'Escape') setShowSaveShuffleInput(false); }}
                autoFocus
              />
              <button className={styles.saveShuffleConfirm} onClick={handleSaveShuffle}>✓</button>
              <button className={styles.saveShuffleCancel} onClick={() => setShowSaveShuffleInput(false)}>×</button>
            </div>
          )}

          {/* #5: Ordens salvas */}
          {savedShuffles.length > 0 && (
            <div className={styles.savedShufflesRow}>
              {savedShuffles.map((s) => (
                <div key={s.id} className={`${styles.savedShuffleChip} ${s.seed === randomSeed ? styles.savedShuffleChipActive : ""}`}>
                  <button onClick={() => loadSavedShuffle(s)} title={`Carregar "${s.name}"`}>
                    {s.name}
                  </button>
                  <button className={styles.savedShuffleDelete} onClick={() => deleteSavedShuffle(s.id)} title="Excluir">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sugestão automática de combo no modo smart */}
      {comboSuggestion && (
        <div className={styles.comboSuggestion}>
          <span className={styles.comboSuggestionIcon}>💡</span>
          <span className={styles.comboSuggestionText}>
            Combo sugerido:{" "}
            <strong>{comboSuggestion.modeA.emoji} {comboSuggestion.modeA.name}</strong>
            {" + "}
            <strong>{comboSuggestion.modeB.emoji} {comboSuggestion.modeB.name}</strong>
            {" "}— ambos têm boa pontuação agora e você ainda não testou juntos.
          </span>
          <button
            className={styles.comboSuggestionBtn}
            onClick={() => {
              setComboSelected([comboSuggestion.modeA.id, comboSuggestion.modeB.id]);
              setActiveCombo({ modeA: comboSuggestion.modeA, modeB: comboSuggestion.modeB });
            }}
          >
            Testar →
          </button>
        </div>
      )}

      {/* Auto-detox banner */}
      {detoxSuggestion && (
        <div className={styles.detoxBanner}>
          <span>
            💡 Você usou <strong>{detoxSuggestion.platform}</strong> {detoxSuggestion.count}x nas últimas sessões.
            Que tal tentar o <strong>{modeById[detoxSuggestion.detoxId]?.name}</strong>?
          </span>
          <button onClick={() => setExpanded(detoxSuggestion.detoxId)} className={styles.detoxBannerBtn}>Ver modo</button>
          <button onClick={() => setDetoxDismissed(true)} className={styles.detoxBannerClose}>×</button>
        </div>
      )}

      {/* Preset Combos */}
      {!searchQuery && !category && sortBy === 'default' && (
        <div className={styles.presetCombosSection}>
          <div className={styles.presetCombosHeader}>
            <span className={styles.presetCombosTitle}>🔗 Combos Prontos</span>
            <button className={styles.presetCombosToggle} onClick={() => setCombosSectionCollapsed(c => !c)}>
              {combosSectionCollapsed ? '▼ mostrar' : '▲ ocultar'}
            </button>
          </div>
          {!combosSectionCollapsed && (
            <div className={styles.presetCombosGrid}>
              {PRESET_COMBOS.map((combo: any) => (
                <button
                  key={combo.id}
                  className={styles.presetComboCard}
                  style={{ borderColor: combo.color, background: combo.colorBg }}
                  onClick={() => setComboSelected([combo.modeIds[0], combo.modeIds[1]])}
                  title={combo.description}
                >
                  <span className={styles.presetComboEmoji}>{combo.emoji}</span>
                  <div className={styles.presetComboInfo}>
                    <strong className={styles.presetComboName}>{combo.name}</strong>
                    <span className={styles.presetComboModes}>
                      {modeById[combo.modeIds[0]]?.emoji} + {modeById[combo.modeIds[1]]?.emoji}
                    </span>
                  </div>
                  <span className={styles.presetComboSituation}>{combo.situation}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Favorites section */}
      {favoriteModes.length > 0 && !searchQuery && !category && (
        <div className={styles.categorySection}>
          <h3 className={styles.categoryTitle}>⭐ Favoritos</h3>
          <div className={styles.grid}>
            {favoriteModes.map((id: string) => { const m = modeById[id]; return m ? renderCard(m, 0) : null; })}
          </div>
        </div>
      )}

      {flatSortedModes ? (
        <div className={styles.grid}>
          {flatSortedModes.map((mode, i) => renderCard(mode, i))}
        </div>
      ) : (
        groups.map((group) => {
          const collapsed = collapsedCategories.has(group.name);
          return (
            <div key={group.name} className={styles.categoryGroup}>
              <div className={styles.categoryHeader}>
                <button
                  className={styles.categoryToggleBtn}
                  onClick={() => toggleCategory(group.name)}
                  title={collapsed ? "Expandir" : "Recolher"}
                >
                  <span className={`${styles.categoryChevron} ${collapsed ? "" : styles.categoryChevronOpen}`}>›</span>
                  <span className={styles.categoryTitle}>{group.name}</span>
                  <span className={styles.categoryCount}>{group.modes.length}</span>
                </button>
                {group.name === "Ciclos" && (
                  <button
                    className={styles.addActivityBtn}
                    onClick={() => setShowAddActivity((v) => !v)}
                    title="Adicionar atividade ao Splite Mode"
                  >
                    + Atividade
                  </button>
                )}
              </div>

              {group.name === "Ciclos" && showAddActivity && (
                <div className={styles.addActivityRow}>
                  <input
                    type="text"
                    className={styles.addActivityInput}
                    placeholder="Nome da atividade (ex: Tocar violão)"
                    value={newActivity}
                    onChange={(e) => setNewActivity(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddActivity()}
                    autoFocus
                  />
                  <button className={styles.addActivityConfirm} onClick={handleAddActivity}>
                    Adicionar
                  </button>
                  <button className={styles.addActivityCancel} onClick={() => { setShowAddActivity(false); setNewActivity(""); }}>
                    ×
                  </button>
                </div>
              )}

              {!collapsed && (
                <>
                  {group.modes.length === 0 && group.name === "Ciclos" ? (
                    <div className={styles.emptyActivities}>
                      <span className={styles.emptyActivitiesIcon}>🔄</span>
                      <div style={{ flex: 1 }}>
                        <span className={styles.emptyActivitiesText}>Adicione atividades para criar ciclos alternados.</span>
                        <div className={styles.activitySuggestions}>
                          {["🎸 Tocar violão", "🧘 Meditar", "🏃 Caminhar", "📖 Ler", "✏️ Esticar"].map((s) => (
                            <button
                              key={s}
                              className={styles.activitySuggestionChip}
                              onClick={() => {
                                setNewActivity(s.replace(/^[^\s]+\s/, ""));
                                setShowAddActivity(true);
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button className={styles.emptyActivitiesBtn} onClick={() => setShowAddActivity(true)}>
                        + Personalizar
                      </button>
                    </div>
                  ) : (
                    <div className={styles.grid}>
                      {group.modes.map((mode, i) => renderCard(mode, i))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })
      )}

      {showCreate && (
        <CreateModeModal onSave={handleSaveMode} onClose={() => setShowCreate(false)} />
      )}

      {/* Barra flutuante de combo */}
      {comboSelected.length > 0 && !activeCombo && (
        <div className={`${styles.comboBar} ${comboSelected.length === 1 ? styles.comboBarPending : ""}`}>
          {comboSelected.length === 1 ? (
            <>
              <span className={styles.comboBarLabel}>
                {modeById[comboSelected[0]]?.emoji} {modeById[comboSelected[0]]?.name}
              </span>
              <span className={styles.comboBarHint}>+ escolha mais 1 modo</span>
              <button className={styles.comboBarClear} onClick={() => setComboSelected([])}>×</button>
            </>
          ) : (() => {
            const mA = modeById[comboSelected[0]];
            const mB = modeById[comboSelected[1]];
            const typeMismatch = mA?.type && mB?.type && mA.type !== mB.type;
            return (
              <>
                <span className={styles.comboBarLabel}>
                  {mA?.emoji} {mA?.name}{" + "}{mB?.emoji} {mB?.name}
                </span>
                {typeMismatch && (
                  <span className={styles.comboBarTypeMismatch} title={`${mA.name} é "${mA.type}" · ${mB.name} é "${mB.type}"`}>
                    ⚠️ tipos diferentes
                  </span>
                )}
                <button className={styles.comboBarStart} onClick={handleStartCombo}>
                  🔀 Testar juntos
                </button>
                <button className={styles.comboBarClear} onClick={() => setComboSelected([])}>×</button>
              </>
            );
          })()}
        </div>
      )}

      {activeCombo && (
        <ModeComboSession
          modeA={activeCombo.modeA}
          modeB={activeCombo.modeB}
          onClose={() => {
            setActiveCombo(null);
            setComboSelected([]);
            setComboStats(getComboStats());
          }}
        />
      )}

      {activeSession && (
        <div
          ref={sessionRef}
          role="dialog"
          aria-modal="true"
          aria-label={activeSession.name ? `Sessão: ${activeSession.name}` : "Sessão ativa"}
        >
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
          onClose={() => {
            setActiveSession(null);
            setPinnedSplite(getPinned());
            // Recarrega contagem de ativações ao fechar sessão
            const all = getAllActivations();
            setActivations(Object.fromEntries(all.map(({ modeId, count }: { modeId: string; count: number }) => [modeId, count])));
            // Recarrega insights de uso pós-sessão
            refreshInsights();
          }}
        />
        </div>
      )}

      {ConfirmUI}
    </div>
  );
}

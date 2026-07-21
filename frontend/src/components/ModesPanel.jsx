import { useState, useEffect } from "react";
import ModeSession from "./ModeSession";
import styles from "./ModesPanel.module.css";
import dfStyles from "./daily-focus/DailyFocus.module.css";
import { modeStatsApi } from "../api/modeStats";
import { getPinned, metaFor } from "../lib/splitePinned";
import { logCompletion, usageStats } from "../lib/modeLog";
import { getAllActivations } from "../lib/modeActivations";
import { useDialog } from "../lib/useDialog";
import { MODES, CATEGORY_BY_ID, CATEGORY_ORDER } from "../data/modes";

const MODES_INLINE_REMOVED = [
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
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function buildSpliteModes(pinnedActivities) {
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
  const [prerequisite, setPrerequisite] = useState("");
  const [whyItWorks, setWhyItWorks] = useState("");
  const [whenToUse, setWhenToUse] = useState("");
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Nome é obrigatório";
    if (!tagline.trim()) e.tagline = "Tagline é obrigatória";
    if (steps.filter((s) => s.trim()).length === 0) e.steps = "Adicione pelo menos um passo";
    if (!prerequisite.trim()) e.prerequisite = "Pré-requisito é obrigatório";
    if (!whyItWorks.trim()) e.whyItWorks = "\"Por que funciona\" é obrigatório";
    if (!whenToUse.trim()) e.whenToUse = "\"Quando usar\" é obrigatório";
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
      prerequisite: prerequisite.trim(),
      whyItWorks: whyItWorks.trim(),
      whenToUse: whenToUse.trim(),
      isCustom: true,
    });
  };

  const updateStep = (i, val) => setSteps((prev) => prev.map((s, idx) => idx === i ? val : s));
  const addStep = () => setSteps((prev) => [...prev, ""]);
  const removeStep = (i) => setSteps((prev) => prev.filter((_, idx) => idx !== i));

  const dialogRef = useDialog(onClose);

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
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
    </div>
  );
}

export default function ModesPanel({ tasks, routines = [], onCompleteTask, onCompleteRoutine, onAddTask, onAddChecklist, onToggleChecklist, onAddRoutineChecklist, onToggleRoutineChecklist }) {
  const [expanded, setExpanded] = useState(null);
  const [activeSession, setActiveSession] = useState(null); // objeto completo do modo
  const [showCreate, setShowCreate] = useState(false);
  const [sortBy, setSortBy] = useState("default"); // "default" | "tasks"
  const [category, setCategory] = useState(""); // "" = todas
  const [pinnedSplite, setPinnedSplite] = useState(() => getPinned());
  const [weekly, setWeekly] = useState(() => usageStats(7));
  const [activations, setActivations] = useState(() => {
    const all = getAllActivations();
    return Object.fromEntries(all.map(({ modeId, count }) => [modeId, count]));
  });

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

  const hasRequiredFields = (m) =>
    !!(m.prerequisite?.trim() && m.whyItWorks?.trim() && m.whenToUse?.trim());

  const incompleteCustomModes = customModes.filter((m) => !hasRequiredFields(m));

  const allModes = [...MODES, ...buildSpliteModes(pinnedSplite), ...customModes]
    .filter(hasRequiredFields);
  const modeById = Object.fromEntries(allModes.map((m) => [m.id, m]));

  // Top modos da semana (com metadados conhecidos)
  const topWeekly = weekly
    .map((w) => ({ ...w, mode: modeById[w.modeId] }))
    .filter((w) => w.mode)
    .slice(0, 5);
  const weeklyMax = topWeekly.reduce((mx, w) => Math.max(mx, w.count), 0);

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
    const activationCount = activations[mode.id] || 0;
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
                {activationCount > 0 && (
                  <span className={styles.statBadge} style={{ opacity: 0.75 }} title="Ativações">
                    ▶ {activationCount}
                  </span>
                )}
              </div>
              <span className={styles.cardTagline}>{mode.tagline}</span>
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

  const openDailyFocus = () => {
    window.open(window.location.href.split("#")[0] + "#/daily-focus", "_blank");
  };

  return (
    <div className={styles.root}>
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
      {topWeekly.length > 0 && (
        <div className={styles.weeklyPanel}>
          <div className={styles.weeklyHeader}>
            <span className={styles.weeklyTitle}>⚡ Mais usados na semana</span>
            <span className={styles.weeklyNote}>últimos 7 dias · por dispositivo</span>
          </div>
          <div className={styles.weeklyList}>
            {topWeekly.map((w) => (
              <div key={w.modeId} className={styles.weeklyRow}>
                <span className={styles.weeklyEmoji}>{w.mode.emoji}</span>
                <span className={styles.weeklyName}>{w.mode.name}</span>
                <div className={styles.weeklyBarTrack}>
                  <div
                    className={styles.weeklyBarFill}
                    style={{ width: `${weeklyMax ? (w.count / weeklyMax) * 100 : 0}%`, background: w.mode.color }}
                  />
                </div>
                <span className={styles.weeklyCount}>{w.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
          onClose={() => {
            setActiveSession(null);
            setPinnedSplite(getPinned());
            // Recarrega contagem de ativações ao fechar sessão
            const all = getAllActivations();
            setActivations(Object.fromEntries(all.map(({ modeId, count }) => [modeId, count])));
          }}
        />
      )}
    </div>
  );
}

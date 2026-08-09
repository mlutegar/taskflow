/**
 * Mapeamento: estado emocional/energético → modo(s) de apoio recomendado(s)
 * Suporta overrides via localStorage (chave: taskflow.checkin.estadosCustom).
 */

import { withOfflineFallback } from "../../lib/syncQueue";

const LS_KEY = "taskflow.checkin.estadosCustom";

export const ESTADOS_DEFAULT = [
  {
    id: "travado",
    emoji: "🧱",
    label: "Travado",
    modeId: "ler_diario",
    motivo: "Ler o diário ajuda a destravar pensamentos e criar impulso inicial.",
    modeIdAlt: "momentum",
    motivoAlt: "Sessões de 5 min quebram a inércia sem exigir foco prolongado.",
    // combo sugerido: diário + ciclos curtos desbloqueiam e criam tração
    modeIds: ["ler_diario", "momentum"],
    comboMotivo: "Ler o diário desvenda o bloqueio; Momentum transforma isso em ação em mini-sprints.",
  },
  {
    id: "cansado",
    emoji: "😴",
    label: "Cansado",
    modeId: "meditar",
    motivo: "Um timer de meditação curto recarrega energia sem exigir esforço.",
    modeIdAlt: "agua",
    motivoAlt: "Hidratar-se é a tarefa mais fácil e já é uma conquista.",
    modeIds: ["meditar", "agua"],
    comboMotivo: "Meditar repõe energia mental; água cuida do corpo — dupla de recuperação.",
  },
  {
    id: "ansioso",
    emoji: "😰",
    label: "Ansioso",
    modeId: "espresso",
    motivo: "Sprints de 25 min com foco claro reduzem a sensação de sobrecarga.",
    modeIdAlt: "esticar",
    motivoAlt: "5 min de alongamento liberam tensão física antes de começar.",
    modeIds: ["esticar", "espresso"],
    comboMotivo: "Esticar alivia a tensão corporal primeiro; Espresso canaliza o que sobra em produção.",
  },
  {
    id: "sem_foco",
    emoji: "🌫️",
    label: "Sem foco",
    modeId: "momentum",
    motivo: "5 minutos são o suficiente para criar tração sem precisar de concentração.",
    modeIdAlt: "music",
    motivoAlt: "A música certa cria um estado de foco sem esforço consciente.",
    modeIds: ["music", "momentum"],
    comboMotivo: "Música cria o ambiente; Momentum dá o primeiro empurrão — foco construído em camadas.",
  },
  {
    id: "disperso",
    emoji: "🪟",
    label: "Disperso",
    modeId: "tabhop",
    motivo: "Tab Hop transforma a dispersão em sistema — você rotaciona apps com intenção em vez de navegar sem rumo.",
    modeIdAlt: "momentum",
    motivoAlt: "5 minutos com uma tarefa micro criam âncora de foco mesmo com a mente dispersa.",
    modeIds: ["tabhop", "music"],
    comboMotivo: "Tab Hop dá estrutura à dispersão; música fecha o ambiente — duas âncoras ao mesmo tempo.",
  },
  {
    id: "bem",
    emoji: "😊",
    label: "Estou bem",
    modeId: null,
    motivo: null,
    modeIdAlt: null,
    motivoAlt: null,
    modeIds: [],
    comboMotivo: null,
  },
  {
    id: "energizado",
    emoji: "⚡",
    label: "Energizado",
    modeId: "rpg",
    motivo: "Transforma sua energia em progresso gamificado com classes e missões.",
    modeIdAlt: "espresso",
    motivoAlt: "Canaliza a energia em sprints de alta intensidade.",
    modeIds: ["rpg", "espresso"],
    comboMotivo: "RPG gamifica a energia; Espresso intensifica cada sprint — pico de desempenho duplo.",
  },
];

export function getEstados() {
  try {
    const custom = localStorage.getItem(LS_KEY);
    if (custom) return JSON.parse(custom);
  } catch {}
  return ESTADOS_DEFAULT;
}

export function saveEstados(estados) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(estados));
    withOfflineFallback("PUT", "/preferences", { estadosCustom: estados });
  } catch {}
}

export function resetEstados() {
  try {
    localStorage.removeItem(LS_KEY);
    withOfflineFallback("PUT", "/preferences", { estadosCustom: [] });
  } catch {}
}

// Compatibilidade: exportar ESTADOS como alias (para não quebrar imports existentes)
export const ESTADOS = ESTADOS_DEFAULT;

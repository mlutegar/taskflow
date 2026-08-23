/**
 * Mapeamento: estado emocional/energético → modo(s) de apoio recomendado(s)
 * Suporta overrides via localStorage (chave: taskflow.checkin.estadosCustom).
 */

import { withOfflineFallback } from "../../lib/syncQueue";

const LS_KEY = "taskflow.checkin.estadosCustom";

export interface Estado {
  id: string;
  emoji: string;
  label: string;
  modeId: string | null;
  motivo: string | null;
  modeIdAlt: string | null;
  motivoAlt: string | null;
  modeIds: string[];
  comboMotivo: string | null;
}

export const ESTADOS_DEFAULT: Estado[] = [
  {
    id: "travado",
    emoji: "🧱",
    label: "Travado",
    modeId: "ler_diario",
    motivo: "Ler o diário ajuda a destravar pensamentos e criar impulso inicial.",
    modeIdAlt: "accountability",
    motivoAlt: "Verbalizar o compromisso em voz alta cria um contrato mental — destranca sem exigir foco prolongado.",
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
    modeIdAlt: "playlist_fixed",
    motivoAlt: "Uma playlist pronta elimina a busca pela música certa — âncora sonora sem esforço de curadoria.",
    modeIds: ["tabhop", "music"],
    comboMotivo: "Tab Hop dá estrutura à dispersão; música fecha o ambiente — duas âncoras ao mesmo tempo.",
  },
  {
    id: "sobrecarregado",
    emoji: "🌊",
    label: "Sobrecarregado",
    modeId: "caminhar",
    motivo: "Sair da tela e se mover fisicamente remove você do loop mental — perspectiva que nenhuma tela consegue dar.",
    modeIdAlt: "ler_diario",
    motivoAlt: "Ver o quanto você já fez reduz a sensação de sobrecarga — progresso comprovado acalma mais do que planejamento.",
    modeIds: ["caminhar", "accountability"],
    comboMotivo: "Caminhar descomprime a mente sobrecarregada; Accountability organiza o que realmente importa fazer agora — saída do espiral.",
  },
  {
    id: "procrastinando",
    emoji: "📱",
    label: "Procrastinando",
    modeId: "cold_turkey",
    motivo: "Eliminar todas as distrações de uma vez quebra o loop de procrastinação sem depender de força de vontade.",
    modeIdAlt: "momentum",
    motivoAlt: "5 minutos é menos assustador do que qualquer tarefa — a inércia quebra com o mínimo possível.",
    modeIds: ["cold_turkey", "momentum"],
    comboMotivo: "Cold Turkey fecha tudo que distrai; Momentum reduz a tarefa ao mínimo possível — menor resistência combinada contra procrastinação.",
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

export function getEstados(): Estado[] {
  try {
    const custom = localStorage.getItem(LS_KEY);
    if (custom) return JSON.parse(custom) as Estado[];
  } catch {}
  return ESTADOS_DEFAULT;
}

export function saveEstados(estados: Estado[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(estados));
    withOfflineFallback("PUT", "/preferences", { estadosCustom: estados });
  } catch {}
}

export function resetEstados(): void {
  try {
    localStorage.removeItem(LS_KEY);
    withOfflineFallback("PUT", "/preferences", { estadosCustom: [] });
  } catch {}
}

// Compatibilidade: exportar ESTADOS como alias (para não quebrar imports existentes)
export const ESTADOS = ESTADOS_DEFAULT;

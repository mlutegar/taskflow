import type { LucideIcon } from "lucide-react";
import {
  CheckSquare,
  Repeat,
  Target,
  Gamepad2,
  BarChart3,
  User,
} from "lucide-react";

export interface NavItem {
  Icon: LucideIcon;
  label: string;
  /**
   * Rótulo curto usado SÓ na bottom nav do mobile, onde cada item tem ~25% da
   * largura da tela. A sidebar do desktop continua usando `label`.
   */
  shortLabel?: string;
  hash: string;
}

// Todos os itens da navegação (ordem = sidebar desktop + drawer mobile)
export const NAV_ITEMS: NavItem[] = [
  { Icon: CheckSquare, label: "Tarefas",     hash: "#/tasks" },
  { Icon: Repeat,      label: "Hábitos",     hash: "#/routines" },
  { Icon: Target,      label: "Daily Focus", shortLabel: "Foco", hash: "#/daily-focus" },
  { Icon: Gamepad2,    label: "Modos",       hash: "#/modes" },
  { Icon: BarChart3,   label: "Análises",    hash: "#/dashboard" },
  { Icon: User,        label: "Perfil",      hash: "#/profile" },
];

// Os 3 atalhos fixos no bottom nav mobile
export const MOBILE_PINNED = ["#/tasks", "#/routines", "#/daily-focus"];

export function navigate(hash: string): void {
  window.location.hash = hash.slice(1);
}

// Vibração curta no toque (só onde suportado — mobile).
export function tapHaptic(): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
    }
  } catch {
    /* ignore */
  }
}

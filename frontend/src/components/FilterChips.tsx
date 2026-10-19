import { X } from "lucide-react";
import type { TaskFilters } from "../hooks/useTaskFilters";
import { useProjects } from "../hooks/useProjects";
import styles from "./FilterChips.module.css";

interface FilterChipsProps {
  filters: TaskFilters;
  onRemove: (key: keyof TaskFilters, value?: any) => void;
  onClearAll: () => void;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "🔴 Alta",
  2: "🟡 Média",
  3: "🟡 Média",
  4: "🟢 Baixa",
};

const TIME_LABELS: Record<string, string> = {
  fast: "⚡ Rápida",
  medium: "⏳ Média",
  long: "🕰 Longa",
  none: "Sem estimativa",
};

const DUE_LABELS: Record<string, string> = {
  overdue: "Vencidas",
  today: "Hoje",
  this_week: "Esta semana",
  no_date: "Sem data",
};

export function FilterChips({ filters, onRemove, onClearAll }: FilterChipsProps) {
  const { data: projects = [] } = useProjects();

  const chips: Array<{ label: string; onRemove: () => void }> = [];

  // Responsável
  if (filters.assignedTo === "me") {
    chips.push({ label: "Minhas", onRemove: () => onRemove("assignedTo") });
  } else if (filters.assignedTo === "none") {
    chips.push({ label: "Sem responsável", onRemove: () => onRemove("assignedTo") });
  }

  // Projetos
  filters.projectIds.forEach((id) => {
    const project = projects.find((p) => p.id === id);
    if (project) {
      chips.push({
        label: `${project.emoji} ${project.name}`,
        onRemove: () => onRemove("projectIds", id),
      });
    }
  });

  // Prioridade
  const uniquePriorities = [...new Set(filters.priorities)];
  uniquePriorities.forEach((priority) => {
    chips.push({
      label: PRIORITY_LABELS[priority] || `Prioridade ${priority}`,
      onRemove: () => onRemove("priorities", priority),
    });
  });

  // Tempo estimado
  if (filters.timeEstimate) {
    chips.push({
      label: TIME_LABELS[filters.timeEstimate] || filters.timeEstimate,
      onRemove: () => onRemove("timeEstimate"),
    });
  }

  // Vencimento
  if (filters.dueFilter) {
    chips.push({
      label: DUE_LABELS[filters.dueFilter] || filters.dueFilter,
      onRemove: () => onRemove("dueFilter"),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className={styles.container}>
      {chips.map((chip, i) => (
        <button key={i} className={styles.chip} onClick={chip.onRemove} type="button">
          {chip.label}
          <X size={14} className={styles.icon} />
        </button>
      ))}
      {chips.length > 1 && (
        <button className={styles.clearAll} onClick={onClearAll} type="button">
          Limpar tudo
        </button>
      )}
    </div>
  );
}

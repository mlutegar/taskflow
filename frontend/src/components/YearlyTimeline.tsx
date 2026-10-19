import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "../api/tasks";
import styles from "./YearlyTimeline.module.css";

interface YearlyTimelineProps {
  taskId: string | number;
  dueDate?: string | null;
}

interface Completion {
  id: string;
  completed_at: string;
  previous_due_date?: string | null;
  next_due_date?: string | null;
}

export default function YearlyTimeline({ taskId, dueDate }: YearlyTimelineProps): JSX.Element | null {
  const { data: history = [] } = useQuery<Completion[]>({
    queryKey: ["task-history", taskId],
    queryFn: () => tasksApi.history(taskId) as Promise<Completion[]>,
    staleTime: 60_000,
  });

  if (!history.length && !dueDate) return null;

  // Agrupar por ano
  const byYear = new Map<number, Completion>();
  history.forEach((c) => {
    if (c.completed_at) {
      const year = new Date(c.completed_at).getFullYear();
      if (!byYear.has(year)) {
        byYear.set(year, c);
      }
    }
  });

  // Ano atual/próximo
  const currentYear = new Date().getFullYear();
  const nextYear = dueDate ? new Date(dueDate).getFullYear() : currentYear;

  // Criar lista de anos (do mais antigo ao próximo)
  const years = new Set([...byYear.keys(), nextYear]);
  const sortedYears = Array.from(years).sort((a, b) => b - a); // Mais recente primeiro

  // Calcular streak (anos consecutivos concluídos)
  let streak = 0;
  for (let year = currentYear - 1; year >= Math.min(...sortedYears); year--) {
    if (byYear.has(year)) {
      streak++;
    } else {
      break;
    }
  }

  return (
    <div className={styles.timeline}>
      <div className={styles.header}>
        📅 Histórico Anual
        {streak > 1 && <span className={styles.streak}>🔥 {streak} anos consecutivos</span>}
      </div>
      <ul className={styles.list}>
        {sortedYears.map((year) => {
          const completion = byYear.get(year);
          const isNext = year === nextYear && !byYear.has(year);
          const isCurrent = year === currentYear;

          if (completion) {
            const completedDate = new Date(completion.completed_at);
            const daysLate = completion.previous_due_date
              ? Math.round(
                  (completedDate.getTime() - new Date(completion.previous_due_date).getTime()) / 86_400_000
                )
              : 0;

            return (
              <li key={year} className={styles.itemCompleted}>
                <span className={styles.icon}>✅</span>
                <span className={styles.year}>{year}</span>
                <span className={styles.detail}>
                  Concluído em {completedDate.toLocaleDateString("pt-BR")}
                  {daysLate > 0 && ` (${daysLate} dia${daysLate > 1 ? "s" : ""} atrasado)`}
                  {daysLate < 0 && ` (${-daysLate} dia${-daysLate > 1 ? "s" : ""} adiantado)`}
                </span>
              </li>
            );
          }

          if (isNext && dueDate) {
            return (
              <li key={year} className={isCurrent ? styles.itemCurrent : styles.itemPending}>
                <span className={styles.icon}>{isCurrent ? "⏳" : "📌"}</span>
                <span className={styles.year}>{year}</span>
                <span className={styles.detail}>
                  {isCurrent ? "Vence em" : "Próxima em"} {new Date(dueDate).toLocaleDateString("pt-BR")}
                </span>
              </li>
            );
          }

          // Ano sem registro (pulado)
          return (
            <li key={year} className={styles.itemSkipped}>
              <span className={styles.icon}>⊘</span>
              <span className={styles.year}>{year}</span>
              <span className={styles.detail}>Não concluído</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { TaskFilters } from "../hooks/useTaskFilters";
import { useProjects } from "../hooks/useProjects";
import styles from "./FilterSheet.module.css";

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: TaskFilters;
  onApply: (filters: TaskFilters) => void;
  taskCount: number;
}

export function FilterSheet({ isOpen, onClose, filters, onApply, taskCount }: FilterSheetProps) {
  const [localFilters, setLocalFilters] = useState(filters);
  const { data: projects = [] } = useProjects();
  const [projectSearch, setProjectSearch] = useState("");

  // Sincroniza filtros quando abre
  useEffect(() => {
    if (isOpen) {
      setLocalFilters(filters);
      setProjectSearch("");
    }
  }, [isOpen, filters]);

  // Fecha com ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleClear = () => {
    setLocalFilters({
      assignedTo: null,
      projectIds: [],
      priorities: [],
      timeEstimate: null,
      dueFilter: null,
    });
  };

  const togglePriority = (priority: number) => {
    setLocalFilters((prev) => {
      const priorities = prev.priorities.includes(priority)
        ? prev.priorities.filter((p) => p !== priority)
        : [...prev.priorities, priority];
      return { ...prev, priorities };
    });
  };

  const toggleProject = (projectId: string) => {
    setLocalFilters((prev) => {
      const projectIds = prev.projectIds.includes(projectId)
        ? prev.projectIds.filter((id) => id !== projectId)
        : [...prev.projectIds, projectId];
      return { ...prev, projectIds };
    });
  };

  const filteredProjects = projects.filter(
    (p) =>
      !p.archived &&
      (projectSearch === "" ||
        p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.emoji.includes(projectSearch))
  );

  if (!isOpen) return null;

  return (
    <div className={`${styles.overlay} ${isOpen ? styles.open : ""}`}>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Sheet */}
      <div className={styles.sheet}>
        <header className={styles.header}>
          <h2>Filtros</h2>
          <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <div className={styles.content}>
          {/* Responsável */}
          <section className={styles.section}>
            <h3>Responsável</h3>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={!localFilters.assignedTo}
                  onChange={() => setLocalFilters({ ...localFilters, assignedTo: null })}
                />
                <span>Todas</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={localFilters.assignedTo === "me"}
                  onChange={() => setLocalFilters({ ...localFilters, assignedTo: "me" })}
                />
                <span>Minhas (atribuídas a mim)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={localFilters.assignedTo === "none"}
                  onChange={() => setLocalFilters({ ...localFilters, assignedTo: "none" })}
                />
                <span>Sem responsável</span>
              </label>
            </div>
          </section>

          {/* Projeto */}
          <section className={styles.section}>
            <h3>Projeto</h3>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar projetos..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
            />
            <div className={styles.checkboxGroup}>
              {filteredProjects.length === 0 && (
                <p className={styles.emptyMessage}>Nenhum projeto encontrado</p>
              )}
              {filteredProjects.map((p) => (
                <label key={p.id} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={localFilters.projectIds.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                  />
                  <span>
                    {p.emoji} {p.name}
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* Prioridade */}
          <section className={styles.section}>
            <h3>Prioridade</h3>
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={localFilters.priorities.includes(1)}
                  onChange={() => togglePriority(1)}
                />
                <span>🔴 Alta</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={localFilters.priorities.includes(2) || localFilters.priorities.includes(3)}
                  onChange={() => {
                    const hasMedium = localFilters.priorities.includes(2) || localFilters.priorities.includes(3);
                    if (hasMedium) {
                      setLocalFilters({
                        ...localFilters,
                        priorities: localFilters.priorities.filter((p) => p !== 2 && p !== 3),
                      });
                    } else {
                      setLocalFilters({
                        ...localFilters,
                        priorities: [...localFilters.priorities, 2, 3],
                      });
                    }
                  }}
                />
                <span>🟡 Média</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={localFilters.priorities.includes(4)}
                  onChange={() => togglePriority(4)}
                />
                <span>🟢 Baixa</span>
              </label>
            </div>
          </section>

          {/* Tempo Estimado */}
          <section className={styles.section}>
            <h3>Tempo Estimado</h3>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={!localFilters.timeEstimate}
                  onChange={() => setLocalFilters({ ...localFilters, timeEstimate: null })}
                />
                <span>Qualquer tempo</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={localFilters.timeEstimate === "fast"}
                  onChange={() => setLocalFilters({ ...localFilters, timeEstimate: "fast" })}
                />
                <span>⚡ Rápida (≤15 min)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={localFilters.timeEstimate === "medium"}
                  onChange={() => setLocalFilters({ ...localFilters, timeEstimate: "medium" })}
                />
                <span>⏳ Média (16–60 min)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={localFilters.timeEstimate === "long"}
                  onChange={() => setLocalFilters({ ...localFilters, timeEstimate: "long" })}
                />
                <span>🕰 Longa (&gt;60 min)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={localFilters.timeEstimate === "none"}
                  onChange={() => setLocalFilters({ ...localFilters, timeEstimate: "none" })}
                />
                <span>Sem estimativa</span>
              </label>
            </div>
          </section>

          {/* Vencimento */}
          <section className={styles.section}>
            <h3>Vencimento</h3>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={!localFilters.dueFilter}
                  onChange={() => setLocalFilters({ ...localFilters, dueFilter: null })}
                />
                <span>Qualquer data</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={localFilters.dueFilter === "overdue"}
                  onChange={() => setLocalFilters({ ...localFilters, dueFilter: "overdue" })}
                />
                <span>Vencidas</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={localFilters.dueFilter === "today"}
                  onChange={() => setLocalFilters({ ...localFilters, dueFilter: "today" })}
                />
                <span>Hoje</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={localFilters.dueFilter === "this_week"}
                  onChange={() => setLocalFilters({ ...localFilters, dueFilter: "this_week" })}
                />
                <span>Esta semana</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  checked={localFilters.dueFilter === "no_date"}
                  onChange={() => setLocalFilters({ ...localFilters, dueFilter: "no_date" })}
                />
                <span>Sem data</span>
              </label>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <button className={styles.clearBtn} onClick={handleClear} type="button">
            Limpar
          </button>
          <button className={styles.applyBtn} onClick={handleApply} type="button">
            Aplicar ({taskCount} {taskCount === 1 ? "tarefa" : "tarefas"})
          </button>
        </footer>
      </div>
    </div>
  );
}

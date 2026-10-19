/**
 * MobileHeader — cabeçalho da tela de Tarefas no mobile.
 *
 * "Meu dia" + data por extenso + botão quadrado "+". Esse botão SUBSTITUI o
 * FAB flutuante, que no mobile passava por cima do conteúdo.
 */

import { useMemo } from "react";
import { Plus, X } from "lucide-react";

import styles from "./mobileHeader.module.css";

/** "Domingo, 18 de outubro" — com a inicial maiúscula (pt-BR devolve minúscula). */
function formatToday(date: Date): string {
  const text = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface MobileHeaderProps {
  /** Formulário de nova tarefa aberto — o botão vira "fechar". */
  formOpen: boolean;
  onToggleForm: () => void;
}

export default function MobileHeader({ formOpen, onToggleForm }: MobileHeaderProps): JSX.Element {
  const today = useMemo(() => formatToday(new Date()), []);

  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Meu dia</h1>
        <p className={styles.date}>{today}</p>
      </div>

      <button
        className={styles.addBtn}
        onClick={onToggleForm}
        aria-label={formOpen ? "Fechar nova tarefa" : "Nova tarefa"}
        aria-expanded={formOpen}
      >
        {formOpen ? <X size={22} /> : <Plus size={22} />}
      </button>
    </header>
  );
}

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "../shared/Modal";
import { useDeleteMeal, useMeals, useSaveMeal } from "../../hooks/useNutrition";
import { nowHHMM } from "../../lib/healthFormat";
import type { Meal, MealType } from "../../api/saude";
import styles from "./Health.module.css";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  snack: "Lanche",
  dinner: "Jantar",
};
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

/** Palpite do tipo pela hora atual (só pré-seleção; o usuário pode trocar). */
function guessType(hhmm: string): MealType {
  const h = Number(hhmm.slice(0, 2));
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

function MealForm({ date, meal, onClose }: { date: string; meal: Meal | null; onClose: () => void }): JSX.Element {
  const save = useSaveMeal();
  const now = nowHHMM();
  const [type, setType] = useState<MealType>(meal?.type ?? guessType(now));
  const [time, setTime] = useState(meal?.time ?? now);
  const [description, setDescription] = useState(meal?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!description.trim()) return setError("Descreva o que você comeu.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setError("Horário inválido.");
    save.mutate({ id: meal?.id, data: { date, type, time, description: description.trim() } }, { onSuccess: onClose });
  };

  return (
    <Modal isOpen onClose={onClose} title={meal ? "Editar refeição" : "Nova refeição"}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.field}>
          Tipo
          <div className={styles.mealType} role="group" aria-label="Tipo de refeição">
            {MEAL_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.chip} ${type === t ? styles.active : ""}`}
                aria-pressed={type === t}
                onClick={() => setType(t)}
              >
                {MEAL_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <label className={styles.field}>
          Horário
          <input className={styles.input} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className={styles.field}>
          O que comeu
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            autoFocus={!meal}
            placeholder="Ex.: arroz, feijão, frango grelhado e salada"
          />
        </label>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <div className={styles.formActions}>
          <button type="button" className={styles.btn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Refeições do dia agrupadas por tipo (sem calorias). */
export default function MealLog({ date }: { date: string }): JSX.Element {
  const { data, isLoading, isError } = useMeals(date);
  const remove = useDeleteMeal();
  const [editing, setEditing] = useState<Meal | "new" | null>(null);

  const confirmDelete = (m: Meal): void => {
    if (window.confirm(`Excluir "${MEAL_LABELS[m.type]}" das ${m.time}?`)) remove.mutate(m.id);
  };

  return (
    <>
      <div className={styles.toolbar}>
        <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Refeições</h3>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditing("new")}>
          <Plus size={16} aria-hidden="true" /> Registrar refeição
        </button>
      </div>

      {isLoading && <div className={styles.empty}>Carregando…</div>}
      {isError && <div className={styles.empty}>Não foi possível carregar as refeições.</div>}
      {data && data.length === 0 && <div className={styles.empty}>Nenhuma refeição registrada neste dia.</div>}

      {data &&
        MEAL_ORDER.map((type) => {
          const meals = data.filter((m) => m.type === type);
          if (meals.length === 0) return null;
          return (
            <section key={type}>
              <h4 className={styles.sectionTitle}>{MEAL_LABELS[type]}</h4>
              <ul className={styles.list}>
                {meals.map((m) => (
                  <li key={m.id} className={styles.mealRow}>
                    <span className={styles.doseTime}>{m.time}</span>
                    <span className={styles.mealDesc}>{m.description}</span>
                    <div className={styles.doseActions}>
                      <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => setEditing(m)} aria-label={`Editar ${MEAL_LABELS[m.type]} ${m.time}`}>
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button className={`${styles.btn} ${styles.btnIcon} ${styles.btnDanger}`} onClick={() => confirmDelete(m)} aria-label={`Excluir ${MEAL_LABELS[m.type]} ${m.time}`}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

      {editing && (
        <MealForm
          key={editing === "new" ? "new" : editing.id}
          date={date}
          meal={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

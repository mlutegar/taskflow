import { Droplets, Undo2 } from "lucide-react";
import { useAddWater, useWater } from "../../hooks/useNutrition";
import styles from "./Health.module.css";

/** Consumo de água do dia: "+1 copo" rápido e desfazer (-1). */
export default function WaterTracker({ date }: { date: string }): JSX.Element {
  const { data, isLoading, isError } = useWater(date);
  const add = useAddWater(date);

  if (isLoading) return <div className={styles.card}>Carregando água…</div>;
  if (isError || !data) return <div className={styles.card}>Não foi possível carregar a água.</div>;

  const slots = Math.max(data.goalGlasses, data.count);
  const reached = data.count >= data.goalGlasses;

  return (
    <section className={`${styles.card} ${styles.water}`} aria-label="Consumo de água">
      <div className={styles.waterTop}>
        <div>
          <span className={styles.waterCount}>{data.count}</span>{" "}
          <span className={styles.progress}>
            de {data.goalGlasses} copos · {(data.totalMl / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L
          </span>
        </div>
        {reached && <span className={styles.progress}>meta batida 🎉</span>}
      </div>

      <div className={styles.glasses} aria-hidden="true">
        {Array.from({ length: slots }, (_, i) => (
          <span key={i} className={`${styles.glass} ${i < data.count ? styles.glassOn : ""}`} />
        ))}
      </div>

      <div className={styles.waterActions}>
        <button className={`${styles.btn} ${styles.waterAdd}`} onClick={() => add.mutate(1)} aria-label="Adicionar 1 copo de água">
          <Droplets size={18} aria-hidden="true" /> +1 copo
        </button>
        <button
          className={styles.btn}
          onClick={() => add.mutate(-1)}
          disabled={data.count <= 0}
          aria-label="Desfazer o último copo"
          title="Desfazer"
        >
          <Undo2 size={16} aria-hidden="true" /> Desfazer
        </button>
      </div>
    </section>
  );
}

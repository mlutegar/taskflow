import { ShoppingBasket } from "lucide-react";
import { useProductPurchased, useShoppingList } from "../../hooks/useSkincare";
import { CATEGORY_LABELS } from "../../lib/healthLabels";
import { formatQty } from "../../lib/healthFormat";
import styles from "./Health.module.css";

interface ShoppingListViewProps {
  /** Leva à aba Remédios para atualizar o estoque depois de comprar. */
  onGoMedications: () => void;
}

/** Lista de compras automática: produtos de pele + (seção separada) remédios com estoque baixo. */
export default function ShoppingListView({ onGoMedications }: ShoppingListViewProps): JSX.Element {
  const { data, isLoading, isError } = useShoppingList();
  const purchased = useProductPurchased();

  if (isLoading) return <div className={styles.empty}>Carregando…</div>;
  if (isError || !data) return <div className={styles.empty}>Não foi possível carregar a lista.</div>;
  if (data.total === 0) {
    return (
      <div className={styles.empty}>
        <ShoppingBasket size={28} aria-hidden="true" />
        <div>Nada para comprar. Produtos “acabando” ou “preciso comprar” e remédios com estoque baixo aparecem aqui.</div>
      </div>
    );
  }

  return (
    <>
      {data.skincare.length > 0 && (
        <>
          <h3 className={styles.sectionTitle}>Cuidado de pele</h3>
          <ul className={styles.list}>
            {data.skincare.map((p) => (
              <li key={p.id} className={styles.step}>
                <span className={styles.stepLabel}>
                  {p.name}
                  <span className={styles.stepSub}>{CATEGORY_LABELS[p.category]}</span>
                </span>
                <span className={`${styles.badgeWarn} ${p.status === "need_to_buy" ? styles.badgeDanger : ""}`}>
                  {p.status === "need_to_buy" ? "comprar" : "acabando"}
                </span>
                <button
                  className={`${styles.btn} ${styles.btnTake}`}
                  disabled={purchased.isPending}
                  onClick={() => purchased.mutate(p.id)}
                >
                  Comprei
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {data.medications.length > 0 && (
        <>
          <h3 className={styles.sectionTitle}>Remédios</h3>
          <ul className={styles.list}>
            {data.medications.map((m) => (
              <li key={m.id} className={styles.step}>
                <span className={styles.stepLabel}>
                  {m.name}
                  <span className={styles.stepSub}>
                    {m.dose ? `${m.dose} · ` : ""}
                    {m.empty ? "sem estoque" : `${formatQty(m.stockQty)} restantes (avisa em ≤ ${formatQty(m.lowStockThreshold)})`}
                  </span>
                </span>
                <span className={`${styles.badgeWarn} ${m.empty ? styles.badgeDanger : ""}`}>
                  {m.empty ? "zerado" : "acabando"}
                </span>
                <button className={styles.btn} onClick={onGoMedications}>
                  Repor estoque
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.progress}>
            Depois de comprar, atualize o estoque em Remédios → Editar. O item sai da lista sozinho.
          </div>
        </>
      )}
    </>
  );
}

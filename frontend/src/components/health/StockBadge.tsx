import { Package } from "lucide-react";
import { formatQty } from "../../lib/healthFormat";
import styles from "./Health.module.css";

interface StockBadgeProps {
  stockQty: number;
  lowStock: boolean;
  daysLeft?: number | null;
}

/** Estoque com aviso: vermelho se zerou, laranja se está acabando. */
export default function StockBadge({ stockQty, lowStock, daysLeft }: StockBadgeProps): JSX.Element {
  const cls = stockQty <= 0 ? styles.stockEmpty : lowStock ? styles.stockLow : "";
  const label =
    stockQty <= 0
      ? "Sem estoque"
      : `${formatQty(stockQty)} em estoque${lowStock ? " · acabando" : ""}${
          daysLeft != null && daysLeft <= 14 ? ` (~${daysLeft} d)` : ""
        }`;
  return (
    <span className={`${styles.stock} ${cls}`} title="Estoque do remédio">
      <Package size={11} aria-hidden="true" />
      {label}
    </span>
  );
}

import { useState } from "react";
import { useShoppingList } from "../../hooks/useSkincare";
import RoutinePeriod from "./RoutinePeriod";
import ProductList from "./ProductList";
import ShoppingListView from "./ShoppingListView";
import styles from "./Health.module.css";

type Sub = "morning" | "night" | "products" | "shopping";

/** Cuidado de pele: rotinas Manhã/Noite (check separado), Produtos e Compras. */
export default function SkincareSection(): JSX.Element {
  const [sub, setSub] = useState<Sub>("morning");
  const { data: shopping } = useShoppingList();
  const count = shopping?.total ?? 0;

  const items: { id: Sub; label: string }[] = [
    { id: "morning", label: "Manhã" },
    { id: "night", label: "Noite" },
    { id: "products", label: "Produtos" },
    { id: "shopping", label: "Compras" },
  ];

  return (
    <>
      <div className={styles.subtabs} role="tablist" aria-label="Cuidado de pele" style={{ flexWrap: "wrap" }}>
        {items.map((i) => (
          <button
            key={i.id}
            role="tab"
            aria-selected={sub === i.id}
            className={`${styles.chip} ${sub === i.id ? styles.active : ""}`}
            onClick={() => setSub(i.id)}
          >
            {i.label}
            {i.id === "shopping" && count > 0 && <span className={styles.badgeCount}>{count}</span>}
          </button>
        ))}
      </div>

      {sub === "morning" && <RoutinePeriod period="morning" />}
      {sub === "night" && <RoutinePeriod period="night" />}
      {sub === "products" && <ProductList />}
      {sub === "shopping" && <ShoppingListView />}
    </>
  );
}

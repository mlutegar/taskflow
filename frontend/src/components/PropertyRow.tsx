import { ReactNode } from "react";
import styles from "./PropertyRow.module.css";

interface PropertyRowProps {
  label: string;
  children: ReactNode;
}

export function PropertyRow({ label, children }: PropertyRowProps) {
  return (
    <div className={styles.row}>
      <label className={styles.label}>{label}</label>
      <div className={styles.value}>{children}</div>
    </div>
  );
}

import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  /** Main message — shown in bold */
  title: string;
  /** Optional secondary line */
  description?: string;
  /** Emoji icon — defaults to 📭 */
  icon?: string;
  /** Optional action button */
  action?: { label: string; onClick: () => void };
  /** Extra className on the root div */
  className?: string;
}

export default function EmptyState({
  title,
  description,
  icon = "📭",
  action,
  className = "",
}: EmptyStateProps): JSX.Element {
  return (
    <div className={`${styles.root} ${className}`}>
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <span className={styles.title}>{title}</span>
      {description && <span className={styles.desc}>{description}</span>}
      {action && (
        <button className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

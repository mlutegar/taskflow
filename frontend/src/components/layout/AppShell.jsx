import Sidebar from "./Sidebar";
import styles from "./Sidebar.module.css";

export default function AppShell({ children, currentHash }) {
  return (
    <div className={styles.shell}>
      <Sidebar currentHash={currentHash} />
      <div className={styles.pageArea}>{children}</div>
    </div>
  );
}

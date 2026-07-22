import Sidebar from "./Sidebar";
import styles from "./Sidebar.module.css";

export default function AppShell({ children }) {
  const currentHash = "#" + (window.location.hash || "/");
  return (
    <div className={styles.shell}>
      <Sidebar currentHash={currentHash} />
      <div className={styles.pageArea}>{children}</div>
    </div>
  );
}

import Sidebar from "./Sidebar";
import styles from "./Sidebar.module.css";
import SyncStatus from "../SyncStatus";

export default function AppShell({ children, currentHash, onSignOut }) {
  return (
    <div className={styles.shell}>
      <Sidebar currentHash={currentHash} onSignOut={onSignOut} />
      <div className={styles.pageArea}>{children}</div>
      <SyncStatus />
    </div>
  );
}

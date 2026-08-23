import React, { ReactNode } from "react";
import Sidebar from "./Sidebar";
import styles from "./Sidebar.module.css";
import SyncStatus from "../SyncStatus";

interface AppShellProps {
  children: ReactNode;
  currentHash: string;
  onSignOut: () => void;
}

export default function AppShell({ children, currentHash, onSignOut }: AppShellProps): JSX.Element {
  return (
    <div className={styles.shell}>
      <Sidebar currentHash={currentHash} onSignOut={onSignOut} />
      <div className={styles.pageArea}>{children}</div>
      <SyncStatus />
    </div>
  );
}

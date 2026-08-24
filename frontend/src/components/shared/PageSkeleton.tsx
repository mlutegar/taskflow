import styles from "./PageSkeleton.module.css";

// ── Primitives ────────────────────────────────────────────────────────────────
function Bone({ w = "100%", h = 16, radius = 6, mb = 0 }: { w?: string | number; h?: number; radius?: number; mb?: number }): JSX.Element {
  return (
    <div
      className={styles.bone}
      style={{ width: w, height: h, borderRadius: radius, marginBottom: mb }}
    />
  );
}

function Row({ gap = 8, children }: { gap?: number; children: React.ReactNode }): JSX.Element {
  return <div style={{ display: "flex", gap, alignItems: "center" }}>{children}</div>;
}

// ── Skeletons por tipo de página ──────────────────────────────────────────────

function TasksSkeleton(): JSX.Element {
  return (
    <div className={styles.page}>
      <Row gap={10}>
        <Bone w={160} h={32} radius={8} />
        <Bone w={90} h={32} radius={8} />
        <Bone w={90} h={32} radius={8} />
      </Row>
      <div style={{ height: 16 }} />
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className={styles.taskRow}>
          <Bone w={20} h={20} radius={4} />
          <Bone w={`${60 + (i % 3) * 12}%`} h={14} radius={4} />
          <Bone w={48} h={20} radius={12} />
        </div>
      ))}
    </div>
  );
}

function RoutinesSkeleton(): JSX.Element {
  return (
    <div className={styles.page}>
      <Bone w={200} h={28} radius={6} mb={20} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.routineCard}>
          <Row gap={12}>
            <Bone w={36} h={36} radius={8} />
            <div style={{ flex: 1 }}>
              <Bone w={`${45 + (i % 4) * 10}%`} h={14} radius={4} mb={6} />
              <Bone w="30%" h={11} radius={4} />
            </div>
            <Bone w={60} h={26} radius={6} />
          </Row>
        </div>
      ))}
    </div>
  );
}

function ModesSkeleton(): JSX.Element {
  return (
    <div className={styles.page}>
      <Row gap={8}>
        <Bone w={120} h={30} radius={6} />
        <Bone w={120} h={30} radius={6} />
        <Bone w={120} h={30} radius={6} />
        <Bone w="100%" h={30} radius={6} />
      </Row>
      <div style={{ height: 14 }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.modeCard}>
          <Row gap={12}>
            <Bone w={40} h={40} radius={10} />
            <div style={{ flex: 1 }}>
              <Bone w={`${35 + (i % 4) * 10}%`} h={15} radius={4} mb={6} />
              <Bone w="55%" h={11} radius={4} />
            </div>
            <Bone w={28} h={28} radius={6} />
            <Bone w={70} h={28} radius={6} />
          </Row>
        </div>
      ))}
    </div>
  );
}

function DailyFocusSkeleton(): JSX.Element {
  return (
    <div className={`${styles.page} ${styles.centered}`}>
      <Row gap={8}>
        <Bone w={90} h={28} radius={14} />
        <Bone w={70} h={28} radius={14} />
        <Bone w={80} h={28} radius={14} />
      </Row>
      <div style={{ height: 32 }} />
      <Bone w={200} h={200} radius={100} />
      <div style={{ height: 24 }} />
      <Bone w={160} h={20} radius={6} />
      <div style={{ height: 12 }} />
      <Row gap={12}>
        <Bone w={110} h={44} radius={10} />
        <Bone w={110} h={44} radius={10} />
      </Row>
      <div style={{ height: 32 }} />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.taskRow}>
          <Bone w={18} h={18} radius={4} />
          <Bone w={`${50 + (i % 3) * 12}%`} h={13} radius={4} />
        </div>
      ))}
    </div>
  );
}

function AnalyticsSkeleton(): JSX.Element {
  return (
    <div className={styles.page}>
      <Row gap={4}>
        <Bone w={120} h={36} radius={6} />
        <Bone w={120} h={36} radius={6} />
      </Row>
      <div style={{ height: 20 }} />
      <div className={styles.statGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.statCard}>
            <Bone w="50%" h={11} radius={4} mb={8} />
            <Bone w="70%" h={28} radius={6} />
          </div>
        ))}
      </div>
      <div style={{ height: 24 }} />
      <div className={styles.chartCard}>
        <Bone w={140} h={14} radius={4} mb={16} />
        <div className={styles.bars}>
          {Array.from({ length: 14 }).map((_, i) => (
            <Bone key={i} w={18} h={20 + (i % 5) * 18} radius={4} />
          ))}
        </div>
      </div>
      <div style={{ height: 16 }} />
      <div className={styles.chartCard}>
        <Bone w={180} h={14} radius={4} mb={16} />
        <div className={styles.bars}>
          {Array.from({ length: 10 }).map((_, i) => (
            <Bone key={i} w={28} h={30 + (i % 4) * 20} radius={4} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton(): JSX.Element {
  return (
    <div className={`${styles.page} ${styles.centered}`}>
      <Bone w={80} h={80} radius={40} />
      <div style={{ height: 16 }} />
      <Bone w={160} h={20} radius={6} />
      <div style={{ height: 8 }} />
      <Bone w={220} h={13} radius={4} />
      <div style={{ height: 32 }} />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.profileRow}>
          <Bone w="40%" h={13} radius={4} />
          <Bone w="35%" h={13} radius={4} />
        </div>
      ))}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
export type SkeletonType = "tasks" | "routines" | "modes" | "daily-focus" | "analytics" | "profile" | "generic";

const MAP: Record<SkeletonType, () => JSX.Element> = {
  tasks:           TasksSkeleton,
  routines:        RoutinesSkeleton,
  modes:           ModesSkeleton,
  "daily-focus":   DailyFocusSkeleton,
  analytics:       AnalyticsSkeleton,
  profile:         ProfileSkeleton,
  generic: () => (
    <div className={`${styles.page} ${styles.centered}`}>
      <Bone w={200} h={16} radius={6} mb={12} />
      <Bone w={140} h={12} radius={4} />
    </div>
  ),
};

export default function PageSkeleton({ type }: { type: SkeletonType }): JSX.Element {
  const Skeleton = MAP[type];
  return <Skeleton />;
}

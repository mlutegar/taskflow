import styles from "./ModeSession.module.css";
import MusicSession from "./sessions/MusicSession";
import TikTokSession from "./sessions/TikTokSession";
import SpliteSession from "./sessions/SpliteSession";
import MomentumSession from "./sessions/MomentumSession";
import EspressoSession from "./sessions/EspressoSession";
import RPGSession from "./sessions/RPGSession";
import LazyFalconSession from "./sessions/LazyFalconSession";

const SESSION_MAP = {
  music: MusicSession,
  tiktok: TikTokSession,
  splite: SpliteSession,
  momentum: MomentumSession,
  espresso: EspressoSession,
  rpg: RPGSession,
  lazyfal: LazyFalconSession,
};

export default function ModeSession({ modeId, tasks, onCompleteTask, onClose }) {
  const Session = SESSION_MAP[modeId];
  if (!Session) return null;

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <Session tasks={tasks} onCompleteTask={onCompleteTask} onClose={onClose} />
      </div>
    </div>
  );
}

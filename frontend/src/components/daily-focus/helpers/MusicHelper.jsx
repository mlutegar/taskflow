import styles from "../DailyFocus.module.css";

const VARIANTS = [
  { id: "hundred", label: "100 Músicas" },
  { id: "album", label: "Álbum" },
  { id: "playlist", label: "Playlist 10" },
];

export const DEFAULT_STATE = { variant: "hundred", count: 0, currentSong: "", albumName: "", playlist: [] };

export default function MusicHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };

  const setField = (field, val) => onChange({ ...s, [field]: val });

  const addToPlaylist = () => {
    if (!s.currentSong.trim()) return;
    const updated = [...(s.playlist || []), s.currentSong.trim()].slice(0, 10);
    onChange({ ...s, playlist: updated, currentSong: "" });
  };

  const togglePlaylistItem = (i) => {
    const updated = (s.playlist || []).map((item, idx) =>
      idx === i ? (typeof item === "object" ? { ...item, done: !item.done } : { name: item, done: true }) : item
    );
    onChange({ ...s, playlist: updated });
  };

  return (
    <div className={styles.helperPanelBody}>
      {/* Variant selector */}
      <div className={styles.variantRow}>
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            className={`${styles.variantBtn} ${s.variant === v.id ? styles.variantBtnActive : ""}`}
            onClick={() => setField("variant", v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {s.variant === "hundred" && (
        <>
          <div>
            <div className={styles.counterLabel}>Música nº</div>
            <div className={styles.counter}>
              <button className={styles.counterBtn} onClick={() => setField("count", Math.max(0, s.count - 1))}>−</button>
              <div>
                <div className={styles.counterNum}>{s.count}</div>
              </div>
              <button className={styles.counterBtn} onClick={() => setField("count", s.count + 1)}>+</button>
            </div>
          </div>
          <div>
            <div className={styles.helperInputLabel}>Música atual (opcional)</div>
            <input
              className={styles.helperInput}
              placeholder="Ex: Counting Stars — OneRepublic"
              value={s.currentSong}
              onChange={(e) => setField("currentSong", e.target.value)}
            />
          </div>
        </>
      )}

      {s.variant === "album" && (
        <>
          <div>
            <div className={styles.helperInputLabel}>Nome do álbum</div>
            <input
              className={styles.helperInput}
              placeholder="Ex: Dark Side of the Moon"
              value={s.albumName}
              onChange={(e) => setField("albumName", e.target.value)}
            />
          </div>
          {s.albumName && (
            <div className={`${styles.cycleBadge} ${styles.textCenter}`}>
              🎵 {s.albumName}
            </div>
          )}
        </>
      )}

      {s.variant === "playlist" && (
        <>
          <div>
            <div className={styles.helperInputLabel}>
              Adicionar música ({(s.playlist || []).length}/10)
            </div>
            <div className={styles.helperRow}>
              <input
                className={styles.helperInput}
                placeholder="Nome da música"
                value={s.currentSong}
                onChange={(e) => setField("currentSong", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToPlaylist()}
                disabled={(s.playlist || []).length >= 10}
              />
              <button
                className={styles.helperSmallBtn}
                onClick={addToPlaylist}
                disabled={(s.playlist || []).length >= 10}
              >
                +
              </button>
            </div>
          </div>
          {(s.playlist || []).length > 0 && (
            <div className={styles.queueList}>
              {s.playlist.map((item, i) => {
                const name = typeof item === "object" ? item.name : item;
                const done = typeof item === "object" ? item.done : false;
                return (
                  <div key={i} className={`${styles.queueItem} ${done ? styles.queueItemDone : ""}`}>
                    <div
                      className={`${styles.queueCheck} ${done ? styles.queueCheckDone : ""}`}
                      onClick={() => togglePlaylistItem(i)}
                    >
                      {done ? "✓" : ""}
                    </div>
                    <span>{name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

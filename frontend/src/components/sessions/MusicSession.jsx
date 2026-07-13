import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import SessionHeader from "./SessionHeader";
import ResumeBanner from "./ResumeBanner";
import WorkingTask from "./WorkingTask";
import styles from "./session.module.css";
import { useModeSession } from "../../hooks/useModeSession";

const MUSIC_MODES = [
  { id: "hundred",  emoji: "🎧", title: "100 Músicas",         desc: "Passe por ~100 músicas no Spotify, encontre UMA que ressoa e faça uma tarefa enquanto ouve." },
  { id: "album",    emoji: "💿", title: "Escolher um Álbum",   desc: "Escolha um álbum completo e faça suas tarefas enquanto ele toca do início ao fim." },
  { id: "playlist", emoji: "✨", title: "Playlist Perfeita de 10", desc: "Curade 10 músicas especiais, uma a uma. A cada música encontrada, faça uma tarefa." },
];

const PLAYLIST_SIZE = 10;

export default function MusicSession({ tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const {
    persist, clearSaved, saved,
    completed, setCompleted,
    doneIds, addDone,
    selectedTask, setSelectedTask,
    wasRestored, setWasRestored,
    available,
  } = useModeSession("music", tasks);

  const [mode,       setMode]       = useState(saved?.mode      ?? null);
  const [step,       setStep]       = useState(saved?.step      ?? "choose_mode");
  const [albumInput, setAlbumInput] = useState("");
  const [albumName,  setAlbumName]  = useState(saved?.albumName ?? "");
  const [playlist,   setPlaylist]   = useState(saved?.playlist  ?? []);
  const [songInput,  setSongInput]  = useState("");

  useEffect(() => {
    if (step === "summary" || step === "playlist_done") return;
    persist({ step, mode, completed, doneIds: [...doneIds], albumName, playlist, selectedTaskId: selectedTask?.id ?? null });
  }, [step, mode, completed, doneIds, albumName, playlist, selectedTask]); // eslint-disable-line

  const handleClose = () => { clearSaved(); onClose(); };

  const selectMode = (modeId) => {
    setMode(modeId);
    if (modeId === "hundred")  setStep("hundred_finding");
    else if (modeId === "album")    setStep("album_choose");
    else if (modeId === "playlist") setStep("playlist_hunt");
  };

  const getMusicStep = () => {
    if (mode === "hundred")  return "hundred_finding";
    if (mode === "album")    return "album_choose";
    if (mode === "playlist") return "playlist_hunt";
    return "choose_mode";
  };

  const finishTask = async () => {
    await onCompleteTask(selectedTask.id);
    addDone(selectedTask.id);
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    setStep(available.length - 1 === 0 ? "summary" : getMusicStep());
  };

  const finishPlaylistTask = async () => {
    await onCompleteTask(selectedTask.id);
    addDone(selectedTask.id);
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    if (playlist.length >= PLAYLIST_SIZE) setStep("playlist_done");
    else if (available.length - 1 === 0) setStep("summary");
    else setStep("playlist_hunt");
  };

  const handleSubtaskToggle = async (taskId, itemId) => {
    const currentTask = tasks.find((t) => t.id === taskId);
    const item = currentTask?.checklist?.find((c) => c.id === itemId);
    const wasCompleted = item?.completed ?? true;
    await onToggleChecklist?.(taskId, itemId);
    if (!wasCompleted) {
      setCompleted((c) => c + 1);
      setSelectedTask(null);
      if (available.length === 0) {
        setStep("summary");
      } else if (step === "playlist_working") {
        setStep(playlist.length >= PLAYLIST_SIZE ? "playlist_done" : "playlist_hunt");
      } else {
        setStep(getMusicStep());
      }
    }
  };

  return (
    <div className={styles.root}>
      <SessionHeader emoji="🎵" title="Music Mode" sub={`${completed} concluída(s)`} onClose={handleClose} />

      <div className={styles.body}>
        <ResumeBanner
          show={wasRestored && step !== "choose_mode" && step !== "summary" && step !== "playlist_done"}
          onDismiss={() => setWasRestored(false)}
        >
          ↩ Sessão restaurada — {completed} tarefa(s) concluída(s)
        </ResumeBanner>

        {/* ── Escolha do modo ── */}
        {step === "choose_mode" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>Como quer usar a música hoje?</div>
              <div className={styles.promptText}>Escolha uma das formas de ativar sua concentração com música.</div>
            </div>
            <div className={styles.classGrid}>
              {MUSIC_MODES.map((m) => (
                <button key={m.id} className={styles.classCard} onClick={() => selectMode(m.id)}>
                  <span className={styles.classEmoji}>{m.emoji}</span>
                  <div className={styles.classInfo}>
                    <span className={styles.className}>{m.title}</span>
                    <span className={styles.classDesc}>{m.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Modo 1: 100 Músicas ── */}
        {step === "hundred_finding" && (
          <>
            <div className={styles.infoPill}>🎧 Modo: 100 Músicas — música {completed + 1}</div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎧 Encontre sua música</div>
              <div className={styles.promptText}>Abra o Spotify e passe por ~100 músicas. Quando encontrar UMA que realmente ressoa, volte aqui.</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => available.length === 0 ? setStep("summary") : setStep("hundred_select")}>
              🎵 Encontrei minha música!
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>Encerrar sessão</button>
          </>
        )}

        {step === "hundred_select" && (
          <TaskSelector tasks={available} onSelect={(t) => { setSelectedTask(t); setStep("hundred_working"); }} onCancel={() => setStep("hundred_finding")} />
        )}

        {step === "hundred_working" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          return (
            <WorkingTask
              task={live}
              badge={<div className={styles.infoPill}>🎵 Música tocando — foco total!</div>}
              completeLabel="✅ Tarefa concluída!"
              onComplete={finishTask}
              onToggleChecklist={handleSubtaskToggle}
              onAddChecklist={onAddChecklist}
              onSwap={() => setStep("hundred_select")}
            />
          );
        })()}

        {/* ── Modo 2: Álbum ── */}
        {step === "album_choose" && (
          <>
            <div className={styles.infoPill}>💿 Modo: Álbum — escolha {completed > 0 ? "o próximo" : "seu"} álbum</div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>💿 Qual álbum você quer ouvir?</div>
              <div className={styles.promptText}>Vá ao Spotify, escolha um álbum para ouvir do início ao fim e anote o nome abaixo.</div>
            </div>
            <div className={styles.actions}>
              <input
                className={styles.input}
                value={albumInput}
                onChange={(e) => setAlbumInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && albumInput.trim()) { setAlbumName(albumInput.trim()); setAlbumInput(""); setStep(available.length === 0 ? "summary" : "album_select"); } }}
                placeholder="Nome do álbum — Artista..."
                autoFocus
              />
              <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={!albumInput.trim()} onClick={() => { setAlbumName(albumInput.trim()); setAlbumInput(""); setStep(available.length === 0 ? "summary" : "album_select"); }}>
                💿 Confirmar álbum
              </button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>Encerrar</button>
            </div>
          </>
        )}

        {step === "album_select" && (
          <>
            <div className={styles.infoPill}>💿 {albumName}</div>
            <TaskSelector tasks={available} onSelect={(t) => { setSelectedTask(t); setStep("album_working"); }} onCancel={() => setStep("album_choose")} />
          </>
        )}

        {step === "album_working" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          return (
            <WorkingTask
              task={live}
              badge={<div className={styles.infoPill}>💿 {albumName} — foco total!</div>}
              completeLabel="✅ Tarefa concluída!"
              onComplete={finishTask}
              onToggleChecklist={handleSubtaskToggle}
              onAddChecklist={onAddChecklist}
              onSwap={() => setStep("album_select")}
            />
          );
        })()}

        {/* ── Modo 3: Playlist Perfeita ── */}
        {step === "playlist_hunt" && (
          <>
            <div className={styles.infoPill}>✨ Playlist Perfeita — {playlist.length}/{PLAYLIST_SIZE} músicas</div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎵 Encontre a música #{playlist.length + 1}</div>
              <div className={styles.promptText}>Vá ao Spotify e encontre uma música especial para sua playlist. Quando tiver, volte aqui.</div>
            </div>
            {playlist.length > 0 && (
              <div className={styles.savedTaskList}>
                <span className={styles.sectionLabel}>Na playlist até agora</span>
                {playlist.map((s, i) => (
                  <div key={i} className={styles.savedTask}><span className={styles.savedTaskTitle}>🎵 {i + 1}. {s}</span></div>
                ))}
              </div>
            )}
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("playlist_enter")}>🎵 Encontrei! Registrar música</button>
            {playlist.length > 0 && (
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>
                Encerrar com {playlist.length} música{playlist.length !== 1 ? "s" : ""}
              </button>
            )}
          </>
        )}

        {step === "playlist_enter" && (
          <>
            <div className={styles.infoPill}>✨ Música {playlist.length + 1}/{PLAYLIST_SIZE}</div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>📝 Qual é a música?</div>
              <div className={styles.promptText}>Digite o nome da música (e artista, se quiser).</div>
            </div>
            <div className={styles.actions}>
              <input
                className={styles.input}
                value={songInput}
                onChange={(e) => setSongInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && songInput.trim()) { setPlaylist((p) => [...p, songInput.trim()]); setSongInput(""); setStep(available.length === 0 ? "summary" : "playlist_select"); } }}
                placeholder="Música — Artista..."
                autoFocus
              />
              <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={!songInput.trim()} onClick={() => { setPlaylist((p) => [...p, songInput.trim()]); setSongInput(""); setStep(available.length === 0 ? "summary" : "playlist_select"); }}>
                ➕ Adicionar à playlist
              </button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("playlist_hunt")}>← Voltar</button>
            </div>
          </>
        )}

        {step === "playlist_select" && (() => {
          const lastSong = playlist[playlist.length - 1];
          return (
            <>
              <div className={styles.infoPill}>✨ {playlist.length}/{PLAYLIST_SIZE} — "{lastSong}" adicionada!</div>
              <div className={styles.promptBox}>
                <div className={styles.promptTitle}>🎵 Agora: faça uma tarefa!</div>
                <div className={styles.promptText}>Selecione uma tarefa para fazer enquanto <strong>{lastSong}</strong> toca.</div>
              </div>
              <TaskSelector tasks={available} onSelect={(t) => { setSelectedTask(t); setStep("playlist_working"); }} onCancel={() => setStep("playlist_hunt")} />
            </>
          );
        })()}

        {step === "playlist_working" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          const currentSong = playlist[playlist.length - 1];
          return (
            <WorkingTask
              task={live}
              badge={<div className={styles.infoPill}>🎵 {currentSong} — foco total!</div>}
              completeLabel="✅ Tarefa concluída!"
              onComplete={finishPlaylistTask}
              onToggleChecklist={handleSubtaskToggle}
              onAddChecklist={onAddChecklist}
              onSwap={() => setStep("playlist_select")}
            />
          );
        })()}

        {step === "playlist_done" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>✨</span>
              <div className={styles.summaryTitle}>Playlist Perfeita Completa!</div>
              <div className={styles.summaryText}>{completed} tarefa{completed !== 1 ? "s" : ""} concluída{completed !== 1 ? "s" : ""} durante a curadoria.</div>
            </div>
            <div className={styles.savedTaskList}>
              <span className={styles.sectionLabel}>🎵 Sua Playlist Perfeita de {PLAYLIST_SIZE}</span>
              {playlist.map((s, i) => (
                <div key={i} className={styles.savedTask}><span className={styles.savedTaskTitle}>{i + 1}. {s}</span></div>
              ))}
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClose}>🎵 Fechar</button>
          </>
        )}

        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>🎵</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>{completed > 0 ? `${completed} tarefa(s) concluída(s).` : "Nenhuma tarefa concluída."}</div>
            </div>
            {mode === "playlist" && playlist.length > 0 && (
              <div className={styles.savedTaskList}>
                <span className={styles.sectionLabel}>🎵 Playlist curada ({playlist.length} música{playlist.length !== 1 ? "s" : ""})</span>
                {playlist.map((s, i) => (
                  <div key={i} className={styles.savedTask}><span className={styles.savedTaskTitle}>{i + 1}. {s}</span></div>
                ))}
              </div>
            )}
            {mode === "album" && albumName && (
              <div className={styles.infoPill} style={{ marginBottom: 8 }}>💿 Álbum da sessão: {albumName}</div>
            )}
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}

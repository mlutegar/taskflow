import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { orbitaApi, preferencesApi, OrbitaFolder } from "../api/orbita";
import { buildPromptFromTask, DEFAULT_ORBITA_TEMPLATE } from "../lib/orbitaPrompt";
import type { TaskRecord } from "../types/tasks";

interface OrbitaLauncherProps {
  task: TaskRecord;
  onUpdate: (id: number | string, payload: Record<string, unknown>) => Promise<unknown>;
}

const PROVIDERS: { id: string; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
  { id: "antigravity", label: "Gemini" },
];

const CONFIRM_SECONDS = 4; // janela de "Desfazer" antes do envio automático

interface Pending {
  path: string;
  projectName: string;
  provider: string;
  reuseKey?: string;
  secondsLeft: number;
}

export default function OrbitaLauncher({ task, onUpdate }: OrbitaLauncherProps): JSX.Element {
  const [folders, setFolders] = useState<OrbitaFolder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(task.orbita_projects ?? []);
  const [prompt, setPrompt] = useState<string>(task.orbita_prompt ?? "");
  const [provider, setProvider] = useState<string>(task.orbita_last_provider || "claude");
  const [reuse, setReuse] = useState<boolean>(false);
  const [template, setTemplate] = useState<string>("");
  const [showTemplate, setShowTemplate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const autoLaunched = useRef(false);

  const nameOf = (path: string): string => folders.find((f) => f.path === path)?.name ?? path;
  const promptFor = (projectName: string): string =>
    prompt.trim() ? prompt : buildPromptFromTask(task, template, projectName);

  const previewText = useMemo(
    () => promptFor(selected.length ? nameOf(selected[0]) : ""),
    [prompt, template, task, selected, folders]
  );

  // Carrega projetos do Órbita + template global do usuário.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      orbitaApi.listProjects().catch((e) => { throw e; }),
      preferencesApi.get().then((p) => p?.orbitaPromptTemplate ?? "").catch(() => ""),
    ])
      .then(([f, tpl]) => { if (alive) { setFolders(f); setTemplate(tpl || ""); setLoadError(null); } })
      .catch(() => { if (alive) setLoadError("Não foi possível carregar os projetos do Órbita (o Claude Web está rodando?)."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Contagem regressiva do envio (janela de desfazer).
  useEffect(() => {
    if (!pending) return;
    if (pending.secondsLeft <= 0) { void doLaunch(pending); setPending(null); return; }
    const t = setTimeout(() => setPending({ ...pending, secondsLeft: pending.secondsLeft - 1 }), 1000);
    return () => clearTimeout(t);
  }, [pending]);

  // Deep-link: ?launch=<path> abre automaticamente aquele projeto (uma vez).
  useEffect(() => {
    if (autoLaunched.current || loading || loadError) return;
    let launchPath: string | null = null;
    try { launchPath = new URLSearchParams(window.location.search).get("launch"); } catch { launchPath = null; }
    if (!launchPath) return;
    autoLaunched.current = true;
    const folder = folders.find((f) => f.path === launchPath || f.name === launchPath);
    if (folder) startLaunch(folder.path);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("launch");
      window.history.replaceState(null, "", url.toString());
    } catch { /* noop */ }
  }, [loading, loadError, folders]);

  const toggleProject = (path: string): void => {
    const next = selected.includes(path) ? selected.filter((p) => p !== path) : [...selected, path];
    setSelected(next);
    void onUpdate(task.id, { orbita_projects: next });
  };

  const persistPrompt = (): void => { void onUpdate(task.id, { orbita_prompt: prompt }); };

  const saveTemplate = async (): Promise<void> => {
    try { await preferencesApi.saveOrbitaTemplate(template); setStatus("Template global salvo."); }
    catch { setStatus("Falha ao salvar o template."); }
  };

  const startLaunch = (path: string): void => {
    setStatus(null);
    setPending({
      path,
      projectName: nameOf(path),
      provider,
      reuseKey: reuse && task.orbita_last_key ? task.orbita_last_key : undefined,
      secondsLeft: CONFIRM_SECONDS,
    });
  };

  const doLaunch = async (p: Pending): Promise<void> => {
    setStatus(`Abrindo ${p.projectName}…`);
    try {
      const res = await orbitaApi.launch({
        taskId: String(task.id),
        path: p.path,
        prompt: promptFor(p.projectName),
        provider: p.provider,
        reuseKey: p.reuseKey,
      });
      if (res?.openUrl) {
        window.open(res.openUrl, "_blank", "noopener");
        setStatus(res.reused ? "Continuando a aba anterior — prompt enviado." : "Aba aberta no Claude — prompt enviado.");
        // Reflete o novo lastKey/histórico sem recarregar tudo.
        void onUpdate(task.id, {});
      } else {
        setStatus("Resposta inesperada do Órbita.");
      }
    } catch (err) {
      setStatus((err as Error)?.message || "Falha ao abrir no Claude.");
    }
  };

  const missing = selected.filter((p) => folders.length > 0 && !folders.some((f) => f.path === p));
  const history = (task.orbita_history ?? []).slice(0, 3);

  return (
    <section style={box}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={heading}>🛰️ Claude Web (Órbita)</h3>
        <button type="button" style={linkBtn} onClick={() => setShowTemplate((v) => !v)}>
          ⚙ Template
        </button>
      </div>

      {loading && <p style={muted}>Carregando projetos…</p>}
      {loadError && <p style={errorText}>{loadError}</p>}

      {!loading && !loadError && (
        <>
          {/* Template global (placeholders) */}
          {showTemplate && (
            <div style={{ margin: "6px 0 12px" }}>
              <p style={muted}>Template global — placeholders: <code>{"{{titulo}}"}</code> <code>{"{{descricao}}"}</code> <code>{"{{checklist}}"}</code> <code>{"{{projeto}}"}</code></p>
              <textarea
                value={template}
                placeholder={DEFAULT_ORBITA_TEMPLATE}
                onChange={(e) => setTemplate(e.target.value)}
                rows={4}
                style={textarea}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button type="button" style={smallBtn} onClick={saveTemplate}>Salvar template</button>
                <button type="button" style={smallGhost} onClick={() => setTemplate(DEFAULT_ORBITA_TEMPLATE)}>Restaurar padrão</button>
              </div>
            </div>
          )}

          {/* Projetos associados */}
          <p style={muted}>Projetos associados a esta tarefa:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
            {folders.length === 0 && <span style={muted}>Nenhum projeto encontrado.</span>}
            {folders.map((f) => {
              const on = selected.includes(f.path);
              return (
                <button key={f.path} type="button" onClick={() => toggleProject(f.path)} title={f.path} style={{ ...chip, ...(on ? chipOn : {}) }}>
                  {on ? "✓ " : ""}{f.name}
                </button>
              );
            })}
          </div>

          {/* Projetos "mortos" (associados mas ausentes no Órbita) */}
          {missing.length > 0 && (
            <div style={{ margin: "4px 0 8px" }}>
              {missing.map((p) => (
                <div key={p} style={warnRow}>
                  <span title={p}>⚠️ Projeto indisponível: <b>{p.split(/[\\/]/).pop()}</b></span>
                  <button type="button" style={linkBtn} onClick={() => toggleProject(p)}>remover</button>
                </div>
              ))}
            </div>
          )}

          {/* Provider + reuso */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", margin: "8px 0" }}>
            <label style={muted}>
              Agente:{" "}
              <select value={provider} onChange={(e) => setProvider(e.target.value)} style={select}>
                {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            {task.orbita_last_key && (
              <label style={{ ...muted, display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={reuse} onChange={(e) => setReuse(e.target.checked)} />
                Continuar aba anterior (em vez de nova)
              </label>
            )}
          </div>

          {/* Prompt (override por tarefa) */}
          <label style={muted}>Prompt (vazio = usa o template acima):</label>
          <textarea
            value={prompt}
            placeholder={previewText}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={persistPrompt}
            rows={6}
            style={textarea}
          />
          <button type="button" style={linkBtn} onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? "Ocultar" : "Ver"} prompt final que será enviado
          </button>
          {showPreview && <pre style={pre}>{previewText}</pre>}

          {/* Botões de abrir */}
          {selected.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={muted}>Abrir no Claude ({PROVIDERS.find((p) => p.id === provider)?.label}):</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {selected.filter((p) => !missing.includes(p)).map((path) => (
                  <button key={path} type="button" disabled={pending !== null} onClick={() => startLaunch(path)} style={launchBtn}>
                    ▶ {nameOf(path)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirmação com contagem (janela de desfazer) */}
          {pending && (
            <div style={confirmRow}>
              <span>Enviando para <b>{pending.projectName}</b> em {pending.secondsLeft}s…</span>
              <button type="button" style={smallBtn} onClick={() => { void doLaunch(pending); setPending(null); }}>Enviar agora</button>
              <button type="button" style={smallGhost} onClick={() => { setPending(null); setStatus("Cancelado."); }}>Cancelar</button>
            </div>
          )}

          {status && <p style={{ ...muted, marginTop: 8 }}>{status}</p>}

          {/* Histórico de launches */}
          {history.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={muted}>Últimos envios:</p>
              <ul style={histList}>
                {history.map((h, i) => (
                  <li key={i} style={muted}>
                    {new Date(h.at).toLocaleString()} · {h.path ? (h.path.split(/[\\/]/).pop()) : "(aba reusada)"} · {h.provider}{h.reused ? " · continuação" : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── estilos inline (tema escuro do app) ──────────────────────────────────────
const box: CSSProperties = { marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" };
const heading: CSSProperties = { margin: "0 0 8px", fontSize: 14, fontWeight: 700 };
const muted: CSSProperties = { margin: "4px 0", fontSize: 12, color: "var(--muted, #9aa0aa)" };
const errorText: CSSProperties = { margin: "4px 0", fontSize: 12, color: "#fca5a5" };
const warnRow: CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#fbbf24" };
const chip: CSSProperties = { fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "inherit", cursor: "pointer" };
const chipOn: CSSProperties = { background: "#7c6ef5", borderColor: "#7c6ef5", color: "#fff" };
const textarea: CSSProperties = { width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.25)", color: "inherit", fontFamily: "inherit", fontSize: 13, resize: "vertical" };
const pre: CSSProperties = { whiteSpace: "pre-wrap", fontSize: 12, background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 8, marginTop: 6, maxHeight: 220, overflow: "auto" };
const select: CSSProperties = { fontSize: 12, padding: "3px 6px", borderRadius: 6, background: "rgba(0,0,0,0.25)", color: "inherit", border: "1px solid rgba(255,255,255,0.15)" };
const launchBtn: CSSProperties = { fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: "1px solid #7c6ef5", background: "#7c6ef5", color: "#fff", cursor: "pointer" };
const smallBtn: CSSProperties = { fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 7, border: "1px solid #7c6ef5", background: "#7c6ef5", color: "#fff", cursor: "pointer" };
const smallGhost: CSSProperties = { fontSize: 12, padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit", cursor: "pointer" };
const linkBtn: CSSProperties = { fontSize: 12, padding: 0, border: "none", background: "none", color: "#a5b4fc", cursor: "pointer", textDecoration: "underline" };
const confirmRow: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10, padding: 8, borderRadius: 8, background: "rgba(124,110,245,0.15)", border: "1px solid rgba(124,110,245,0.4)", fontSize: 13 };
const histList: CSSProperties = { margin: "2px 0 0", padding: "0 0 0 14px" };

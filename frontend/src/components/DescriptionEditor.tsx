import { useId, useRef, useState } from "react";
import { uploadImage } from "../api/uploads";

interface DescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * Textarea de descrição com suporte a upload de imagens:
 * - botão "🖼️ Imagem", colar (paste) e arrastar (drop);
 * - insere markdown `![](url)` na posição do cursor após o upload.
 */
export default function DescriptionEditor({
  value,
  onChange,
  className,
  placeholder,
  rows = 2,
  maxLength,
  ...aria
}: DescriptionEditorProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function insertAtCursor(snippet: string): void {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    const trimmed = maxLength ? next.slice(0, maxLength) : next;
    onChange(trimmed);
    // Reposiciona o cursor após o snippet inserido.
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = Math.min(start + snippet.length, trimmed.length);
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  async function handleFiles(files: FileList | File[] | null): Promise<void> {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of list) {
        const { url } = await uploadImage(file);
        const alt = file.name.replace(/\.[^.]+$/, "");
        insertAtCursor(`\n![${alt}](${url})\n`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <textarea
        ref={textareaRef}
        className={className}
        value={value}
        onChange={(e) => {
          const v = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
          onChange(v);
        }}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
        onPaste={(e) => {
          const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
          if (imgs.length > 0) {
            e.preventDefault();
            void handleFiles(imgs);
          }
        }}
        onDrop={(e) => {
          if (Array.from(e.dataTransfer.files).some((f) => f.type.startsWith("image/"))) {
            e.preventDefault();
            void handleFiles(e.dataTransfer.files);
          }
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.85rem",
            padding: "2px 8px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "transparent",
            cursor: uploading ? "default" : "pointer",
            color: "inherit",
          }}
        >
          🖼️ {uploading ? "Enviando…" : "Imagem"}
        </button>
        <input
          id={inputId}
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {error && <span role="alert" style={{ color: "var(--danger, #e5484d)", fontSize: "0.8rem" }}>{error}</span>}
      </div>
    </div>
  );
}

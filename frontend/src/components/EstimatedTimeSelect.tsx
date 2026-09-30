import { useState } from "react";
import { ESTIMATED_TIME_PRESETS, parseMinutesInput, formatMinutes } from "../lib/estimatedTime";

interface Props {
  value: number | null;
  onChange: (minutes: number | null) => void;
  className?: string;
  id?: string;
  ariaLabel?: string;
}

/**
 * Select de tempo estimado com presets + opção "Outro…" que revela um campo
 * livre ("90", "1h30", "45m"). Mantém a UX simples mas cobre casos fora da lista.
 */
export default function EstimatedTimeSelect({ value, onChange, className, id, ariaLabel = "Tempo estimado" }: Props) {
  const isPreset = value == null || ESTIMATED_TIME_PRESETS.some((p) => p.value === value);
  const [custom, setCustom] = useState<boolean>(!isPreset);
  const [customText, setCustomText] = useState<string>(value != null && !isPreset ? String(value) : "");

  return (
    <div>
      <select
        id={id}
        className={className}
        aria-label={ariaLabel}
        value={custom ? "custom" : (value ?? "")}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "custom") { setCustom(true); return; }
          setCustom(false);
          onChange(v === "" ? null : Number(v));
        }}
      >
        <option value="">Sem estimativa</option>
        {ESTIMATED_TIME_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>⏱ {preset.label}</option>
        ))}
        <option value="custom">✏️ Outro…</option>
      </select>
      {custom && (
        <input
          className={className}
          style={{ marginTop: 6 }}
          value={customText}
          placeholder='Ex.: 90, 1h30, 45m'
          aria-label="Tempo estimado personalizado"
          onChange={(e) => {
            setCustomText(e.target.value);
            onChange(parseMinutesInput(e.target.value));
          }}
        />
      )}
      {custom && value != null && (
        <span style={{ fontSize: 12, opacity: 0.7 }}>= {formatMinutes(value)}</span>
      )}
    </div>
  );
}

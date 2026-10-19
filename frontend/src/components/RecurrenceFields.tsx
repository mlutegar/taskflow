import styles from "./RecurrenceFields.module.css";

export interface RecurrenceRule {
  type?: "interval" | "weekdays";
  intervalDays?: number;
  weekdays?: number[];
  skipWeekends?: boolean;
  skipHolidays?: boolean;
  reminderDaysBefore?: number;
  birthdayYear?: number;
}

interface Props {
  recurrence: string;
  rule?: RecurrenceRule | null;
  onChange: (recurrence: string, rule: RecurrenceRule | null) => void;
  compact?: boolean;
}

const DAYS = [
  { value: 1, label: "S" }, { value: 2, label: "T" }, { value: 3, label: "Q" },
  { value: 4, label: "Q" }, { value: 5, label: "S" }, { value: 6, label: "S" },
  { value: 0, label: "D" },
];

export default function RecurrenceFields({ recurrence, rule = {}, onChange, compact = false }: Props) {
  const preset = recurrence === "custom"
    ? (rule?.type === "weekdays" ? "custom_weekdays" : "custom_interval")
    : recurrence;

  const selectPreset = (value: string) => {
    if (value === "custom_interval") onChange("custom", { type: "interval", intervalDays: rule?.intervalDays || 2 });
    else if (value === "custom_weekdays") onChange("custom", { type: "weekdays", weekdays: rule?.weekdays?.length ? rule.weekdays : [1, 2, 3, 4, 5] });
    else onChange(value, value ? { skipWeekends: false, skipHolidays: false } : null);
  };

  const patchRule = (patch: Partial<RecurrenceRule>) => onChange(recurrence, { ...(rule || {}), ...patch });
  const toggleDay = (day: number) => {
    const current = new Set(rule?.weekdays || []);
    if (current.has(day)) current.delete(day); else current.add(day);
    if (current.size > 0) patchRule({ type: "weekdays", weekdays: [...current] });
  };

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ""}`}>
      <select className={styles.select} value={preset} onChange={(e) => selectPreset(e.target.value)}>
        <option value="">Sem repetição</option>
        <option value="daily">Todo dia</option>
        <option value="weekdays">Dias úteis</option>
        <option value="weekly">Toda semana</option>
        <option value="biweekly">A cada 2 semanas</option>
        <option value="monthly">Todo mês</option>
        <option value="monthly_first">Primeiro dia do mês</option>
        <option value="yearly">Todo ano</option>
        <option value="custom_interval">A cada X dias</option>
        <option value="custom_weekdays">Dias específicos</option>
      </select>

      {recurrence === "custom" && rule?.type !== "weekdays" && (
        <label className={styles.inlineLabel}>
          A cada
          <input
            type="number" min={1} max={365} value={rule?.intervalDays || 2}
            onChange={(e) => patchRule({ type: "interval", intervalDays: Number(e.target.value) })}
          />
          dias
        </label>
      )}

      {recurrence === "custom" && rule?.type === "weekdays" && (
        <div className={styles.days} aria-label="Dias da semana">
          {DAYS.map((day) => (
            <button
              type="button" key={day.value}
              className={(rule.weekdays || []).includes(day.value) ? styles.dayActive : styles.day}
              onClick={() => toggleDay(day.value)}
              aria-pressed={(rule.weekdays || []).includes(day.value)}
            >{day.label}</button>
          ))}
        </div>
      )}

      {recurrence === "yearly" && (
        <>
          <label className={styles.inlineLabel}>
            🔔 Lembrar
            <input
              type="number" min={0} max={365} value={rule?.reminderDaysBefore ?? 7}
              onChange={(e) => patchRule({ reminderDaysBefore: Number(e.target.value) })}
            />
            {(rule?.reminderDaysBefore ?? 7) === 1 ? "dia antes" : "dias antes"}
          </label>
          <label className={styles.inlineLabel}>
            🎂 Aniversário (ano de nascimento)
            <input
              type="number" min={1900} max={new Date().getFullYear()} value={rule?.birthdayYear || ""}
              placeholder="Opcional"
              onChange={(e) => patchRule({ birthdayYear: e.target.value ? Number(e.target.value) : undefined })}
            />
          </label>
        </>
      )}

      {recurrence && (
        <div className={styles.options}>
          <label><input type="checkbox" checked={Boolean(rule?.skipWeekends)} onChange={(e) => patchRule({ skipWeekends: e.target.checked })} /> Pular fins de semana</label>
          <label><input type="checkbox" checked={Boolean(rule?.skipHolidays)} onChange={(e) => patchRule({ skipHolidays: e.target.checked })} /> Pular feriados</label>
        </div>
      )}
    </div>
  );
}

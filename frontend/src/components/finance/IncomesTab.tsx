import { useState } from "react";
import Modal from "../shared/Modal";
import { useToast } from "../shared/Toast";
import { todayISO } from "../../lib/dateUtils";
import { centsFromDigits, formatBRL } from "../../lib/money";
import { dayLabel } from "../../lib/financeFormat";
import { useFinanceCategories } from "../../hooks/useFinance";
import { useExpectedIncomes, useExpectedMutations, useIncomeSources, useSourceMutations } from "../../hooks/useIncomes";
import type { ExpectedIncome, ExpectedStatus, SourceKind } from "../../api/financas";
import styles from "./Finance.module.css";

export const KIND_LABELS: Record<SourceKind, string> = { job: "Emprego", freelance: "Freelas", sales: "Vendas", other: "Outro" };
export const STATUS_LABELS: Record<ExpectedStatus, string> = { confirmed: "Confirmada", probable: "Provável", uncertain: "Incerta" };

const msg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

/** Fontes de renda + rendas previstas (com botão "Recebi"). */
export default function IncomesTab(): JSX.Element {
  const { showToast } = useToast();
  const { data: sources = [] } = useIncomeSources(true);
  const { data: expected = [], isLoading } = useExpectedIncomes();
  const src = useSourceMutations();
  const exp = useExpectedMutations();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<SourceKind>("job");
  const [form, setForm] = useState<ExpectedIncome | "new" | null>(null);
  const [receiving, setReceiving] = useState<ExpectedIncome | null>(null);

  const srcName = (id: string | null) => sources.find((s) => s.id === id)?.name;
  const today = todayISO();

  const addSource = async () => {
    if (!name.trim()) return;
    try {
      await src.create.mutateAsync({ name: name.trim(), kind });
      setName("");
    } catch (e) {
      showToast(msg(e), "error");
    }
  };

  return (
    <>
      <section className={styles.card} aria-label="Rendas previstas">
        <h2 className={styles.cardTitle}>Rendas previstas</h2>
        {isLoading ? (
          <div>Carregando…</div>
        ) : expected.length === 0 ? (
          <div className={styles.empty}>Nenhuma renda prevista. Cadastre o que você espera receber.</div>
        ) : (
          <div className={styles.list}>
            {expected.map((e) => (
              <div key={e.id} className={styles.item} style={{ cursor: "default", flexWrap: "wrap" }}>
                <span className={styles.grow}>
                  {e.description || srcName(e.sourceId) || "Renda"}
                  <span className={styles.badge}>{STATUS_LABELS[e.status]}</span>
                  {e.expectedDate < today && <span className={styles.badge}>atrasada</span>}
                  <div className={styles.muted}>
                    {dayLabel(e.expectedDate)}/{e.expectedDate.slice(0, 4)}
                    {srcName(e.sourceId) && e.description ? ` · ${srcName(e.sourceId)}` : ""}
                    {e.status === "uncertain" ? " · não entra na projeção" : ""}
                  </div>
                </span>
                <span className={`${styles.amount} ${styles.pos}`}>{formatBRL(e.amountCents)}</span>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setReceiving(e)}>Recebi</button>
                <button className={styles.btn} onClick={() => setForm(e)}>Editar</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <button className={`${styles.btn} ${styles.btnBlock}`} onClick={() => setForm("new")}>+ Renda prevista</button>
        </div>
      </section>

      <section className={styles.card} aria-label="Fontes de renda">
        <h2 className={styles.cardTitle}>Fontes de renda</h2>
        <div className={styles.row} style={{ gridTemplateColumns: "1fr 110px auto" }}>
          <input className={styles.input} aria-label="Nome da fonte" placeholder="Ex.: Empresa, Cliente X" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSource()} />
          <select className={styles.input} aria-label="Tipo da fonte" value={kind} onChange={(e) => setKind(e.target.value as SourceKind)}>
            {(Object.keys(KIND_LABELS) as SourceKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
          <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={!name.trim() || src.create.isPending} onClick={addSource}>Adicionar</button>
        </div>
        <div className={styles.list} style={{ marginTop: 10 }}>
          {sources.map((s) => (
            <div key={s.id} className={`${styles.item} ${s.active ? "" : styles.itemSkipped}`} style={{ cursor: "default" }}>
              <span className={styles.grow}>{s.name}<span className={styles.badge}>{KIND_LABELS[s.kind]}</span>{!s.active && <span className={styles.badge}>arquivada</span>}</span>
              <button
                className={styles.btn}
                onClick={() => (s.active ? src.archive.mutateAsync(s.id) : src.update.mutateAsync({ id: s.id, data: { active: true } })).catch((e) => showToast(msg(e), "error"))}
              >
                {s.active ? "Arquivar" : "Restaurar"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {form && (
        <ExpectedForm
          editing={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onSave={async (data, id) => {
            try {
              await exp.save.mutateAsync({ id, data });
              setForm(null);
            } catch (e) {
              showToast(msg(e), "error");
            }
          }}
          onDelete={async (id) => {
            try {
              await exp.remove.mutateAsync(id);
              setForm(null);
            } catch (e) {
              showToast(msg(e), "error");
            }
          }}
        />
      )}
      {receiving && <ReceiveSheet item={receiving} sourceName={srcName(receiving.sourceId)} onClose={() => setReceiving(null)} />}
    </>
  );
}

function ExpectedForm(props: {
  editing: ExpectedIncome | null;
  onClose: () => void;
  onSave: (d: { sourceId: string | null; amountCents: number; expectedDate: string; status: ExpectedStatus; description: string | null }, id?: string) => void;
  onDelete: (id: string) => void;
}): JSX.Element {
  const { editing } = props;
  const { data: sources = [] } = useIncomeSources(false);
  const [digits, setDigits] = useState(editing ? String(editing.amountCents) : "");
  const [date, setDate] = useState(editing?.expectedDate ?? todayISO());
  const [status, setStatus] = useState<ExpectedStatus>(editing?.status ?? "confirmed");
  const [sourceId, setSourceId] = useState<string | null>(editing?.sourceId ?? null);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [error, setError] = useState("");
  const cents = centsFromDigits(digits);

  return (
    <Modal isOpen onClose={props.onClose} title={editing ? "Editar renda prevista" : "Nova renda prevista"}>
      <div className={styles.form}>
        <label className={styles.field}>
          Valor
          <input className={`${styles.input} ${styles.amountInput}`} inputMode="numeric" autoFocus aria-label="Valor" value={formatBRL(cents)} onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))} />
        </label>
        <div className={styles.field}>
          Status
          <div className={styles.seg} role="group" aria-label="Status">
            {(Object.keys(STATUS_LABELS) as ExpectedStatus[]).map((s) => (
              <button key={s} type="button" className={`${styles.segBtn} ${status === s ? styles.on : ""}`} onClick={() => setStatus(s)}>{STATUS_LABELS[s]}</button>
            ))}
          </div>
          <span className={styles.hint}>Incertas não entram em nenhum cenário da projeção.</span>
        </div>
        <div className={styles.row}>
          <label className={styles.field}>
            Data prevista
            <input className={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className={styles.field}>
            Fonte
            <select className={styles.input} value={sourceId ?? ""} onChange={(e) => setSourceId(e.target.value || null)}>
              <option value="">—</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
        <label className={styles.field}>
          Descrição
          <input className={styles.input} value={description} maxLength={200} placeholder="Opcional" onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}
          onClick={() => {
            if (cents <= 0) return setError("Informe um valor maior que zero.");
            if (!date) return setError("Informe a data prevista.");
            props.onSave({ sourceId, amountCents: cents, expectedDate: date, status, description: description.trim() || null }, editing?.id);
          }}
        >
          Salvar
        </button>
        {editing && <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => props.onDelete(editing.id)}>Excluir previsão</button>}
      </div>
    </Modal>
  );
}

/** "Recebi": lançamento de renda pré-preenchido (valor e data editáveis). */
function ReceiveSheet({ item, sourceName, onClose }: { item: ExpectedIncome; sourceName?: string; onClose: () => void }): JSX.Element {
  const { showToast } = useToast();
  const { receive } = useExpectedMutations();
  const { data: categories = [] } = useFinanceCategories();
  const [digits, setDigits] = useState(String(item.amountCents));
  const [date, setDate] = useState(item.expectedDate <= todayISO() ? item.expectedDate : todayISO());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const cents = centsFromDigits(digits);
  const cats = categories.filter((c) => c.kind === "income");

  const submit = async () => {
    if (cents <= 0) return showToast("Informe um valor maior que zero.", "error");
    try {
      await receive.mutateAsync({ id: item.id, data: { amountCents: cents, date, categoryId, description: item.description ?? sourceName ?? null } });
      showToast("Renda lançada", "success");
      onClose();
    } catch (e) {
      showToast(msg(e), "error");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Recebi">
      <div className={styles.form}>
        <label className={styles.field}>
          Valor recebido
          <input className={`${styles.input} ${styles.amountInput}`} inputMode="numeric" autoFocus aria-label="Valor recebido" value={formatBRL(cents)} onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className={styles.field}>
          Data do recebimento
          <input className={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className={styles.field}>
          Categoria
          <div className={styles.chips}>
            {cats.map((c) => (
              <button key={c.id} type="button" className={`${styles.chip} ${categoryId === c.id ? styles.on : ""}`} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>
        <span className={styles.hint}>Vira um lançamento de renda e sai das previsões (não conta duas vezes).</span>
        <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`} disabled={receive.isPending} onClick={submit}>
          {receive.isPending ? "Salvando…" : "Confirmar recebimento"}
        </button>
      </div>
    </Modal>
  );
}

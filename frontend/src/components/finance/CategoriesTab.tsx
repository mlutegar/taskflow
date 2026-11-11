import { useState } from "react";
import { useToast } from "../shared/Toast";
import { useCategoryMutations, useFinanceCategories } from "../../hooks/useFinance";
import type { FinanceCategory, FinanceType } from "../../api/financas";
import styles from "./Finance.module.css";

/** Categorias editáveis (nome, emoji, cor). Excluir = arquivar: o histórico continua intacto. */
export default function CategoriesTab(): JSX.Element {
  const { showToast } = useToast();
  const { data: all = [], isLoading } = useFinanceCategories(true);
  const { create, update, archive } = useCategoryMutations();
  const [kind, setKind] = useState<FinanceType>("expense");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");

  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : "Não foi possível salvar.", "error");
  const list = all.filter((c) => c.kind === kind);

  const add = async () => {
    if (!name.trim()) return;
    try {
      await create.mutateAsync({ name: name.trim(), kind, emoji: emoji.trim() || null });
      setName("");
      setEmoji("");
    } catch (e) {
      fail(e);
    }
  };

  const saveEdit = async (c: FinanceCategory) => {
    try {
      await update.mutateAsync({ id: c.id, data: { name: editName.trim() || c.name, emoji: editEmoji.trim() || null } });
      setEditId(null);
    } catch (e) {
      fail(e);
    }
  };

  const toggle = (c: FinanceCategory) =>
    (c.active ? archive.mutateAsync(c.id) : update.mutateAsync({ id: c.id, data: { active: true } })).catch(fail);

  if (isLoading) return <div className={styles.card}>Carregando…</div>;

  return (
    <>
      <div className={styles.seg} role="group" aria-label="Tipo de categoria">
        <button className={`${styles.segBtn} ${kind === "expense" ? styles.on : ""}`} onClick={() => setKind("expense")}>Gastos</button>
        <button className={`${styles.segBtn} ${kind === "income" ? styles.on : ""}`} onClick={() => setKind("income")}>Rendas</button>
      </div>

      <div className={styles.card}>
        <div className={styles.row} style={{ gridTemplateColumns: "64px 1fr auto" }}>
          <input className={styles.input} aria-label="Emoji" placeholder="🙂" value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} />
          <input className={styles.input} aria-label="Nome da categoria" placeholder="Nova categoria" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={!name.trim() || create.isPending} onClick={add}>Adicionar</button>
        </div>
      </div>

      <div className={styles.list}>
        {list.map((c) => (
          <div key={c.id} className={`${styles.item} ${c.active ? "" : styles.itemSkipped}`} style={{ cursor: "default" }}>
            {editId === c.id ? (
              <>
                <input className={styles.input} style={{ width: 56 }} aria-label="Emoji" value={editEmoji} maxLength={4} onChange={(e) => setEditEmoji(e.target.value)} />
                <input className={styles.input} aria-label="Nome" value={editName} maxLength={60} onChange={(e) => setEditName(e.target.value)} />
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => saveEdit(c)}>OK</button>
              </>
            ) : (
              <>
                <span className={styles.emoji}>{c.emoji ?? "•"}</span>
                <span className={styles.grow}>{c.name}{!c.active && <span className={styles.badge}>arquivada</span>}</span>
                <button className={styles.btn} onClick={() => { setEditId(c.id); setEditName(c.name); setEditEmoji(c.emoji ?? ""); }}>Editar</button>
                <button className={styles.btn} onClick={() => toggle(c)}>{c.active ? "Arquivar" : "Restaurar"}</button>
              </>
            )}
          </div>
        ))}
      </div>
      <p className={styles.hint}>Arquivar esconde a categoria dos novos lançamentos, mas o histórico continua com ela.</p>
    </>
  );
}

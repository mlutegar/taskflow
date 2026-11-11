import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "../shared/Modal";
import { useDeleteProduct, useSaveProduct, useSetProductStatus, useSkincareProducts } from "../../hooks/useSkincare";
import { CATEGORY_LABELS, STATUS_LABELS } from "../../lib/healthLabels";
import type { ProductCategory, ProductStatus, SkincareProduct } from "../../api/saude";
import styles from "./Health.module.css";

function ProductForm({ product, onClose }: { product: SkincareProduct | null; onClose: () => void }): JSX.Element {
  const save = useSaveProduct();
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? "hidratante");
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "have");
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!name.trim()) return setError("Informe o nome do produto.");
    save.mutate(
      { id: product?.id, data: { name: name.trim(), category, status, notes: notes.trim() || null } },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal isOpen onClose={onClose} title={product ? "Editar produto" : "Novo produto"}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          Nome
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus={!product} />
        </label>
        <label className={styles.field}>
          Categoria
          <select className={styles.input} value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)}>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <div className={styles.field}>
          Status
          <div className={styles.statusGroup} role="group" aria-label="Status do produto">
            {(Object.keys(STATUS_LABELS) as ProductStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.chip} ${status === s ? styles.active : ""}`}
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <label className={styles.field}>
          Observações (opcional)
          <input className={styles.input} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </label>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <div className={styles.formActions}>
          <button type="button" className={styles.btn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Cadastro de produtos com status (tenho / acabando / preciso comprar). */
export default function ProductList(): JSX.Element {
  const { data, isLoading, isError } = useSkincareProducts();
  const setStatus = useSetProductStatus();
  const remove = useDeleteProduct();
  const [editing, setEditing] = useState<SkincareProduct | "new" | null>(null);

  const confirmDelete = (p: SkincareProduct): void => {
    if (window.confirm(`Excluir o produto "${p.name}"?\n\nOs passos que o usam continuam na rotina, só sem o vínculo.`)) {
      remove.mutate(p.id);
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditing("new")}>
          <Plus size={16} aria-hidden="true" /> Novo produto
        </button>
      </div>

      {isLoading && <div className={styles.empty}>Carregando…</div>}
      {isError && <div className={styles.empty}>Não foi possível carregar os produtos.</div>}
      {data && data.length === 0 && <div className={styles.empty}>Nenhum produto cadastrado ainda.</div>}

      <ul className={styles.list}>
        {data?.map((p) => (
          <li key={p.id} className={`${styles.card} ${styles.med}`}>
            <div className={styles.medHead}>
              <div>
                <div className={styles.medName}>{p.name}</div>
                <div className={styles.medSub}>
                  {CATEGORY_LABELS[p.category]}
                  {p.notes ? ` · ${p.notes}` : ""}
                </div>
              </div>
              <div className={styles.doseActions}>
                <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`}>
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <button className={`${styles.btn} ${styles.btnIcon} ${styles.btnDanger}`} onClick={() => confirmDelete(p)} aria-label={`Excluir ${p.name}`}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className={styles.statusGroup} role="group" aria-label={`Status de ${p.name}`}>
              {(Object.keys(STATUS_LABELS) as ProductStatus[]).map((s) => (
                <button
                  key={s}
                  className={`${styles.chip} ${p.status === s ? styles.active : ""}`}
                  aria-pressed={p.status === s}
                  disabled={setStatus.isPending}
                  onClick={() => p.status !== s && setStatus.mutate({ id: p.id, status: s })}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <ProductForm
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

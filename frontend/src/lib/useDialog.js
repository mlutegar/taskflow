import { useEffect, useRef } from "react";

/**
 * useDialog — acessibilidade de modais.
 *
 * Retorna um ref para o container do diálogo e:
 *  - fecha no Esc
 *  - prende o foco (Tab cicla dentro do modal)
 *  - move o foco para dentro ao abrir e restaura ao elemento anterior ao fechar
 *
 * Uso:
 *   const ref = useDialog(onClose);
 *   <div ref={ref} role="dialog" aria-modal="true" aria-label="...">…</div>
 */
export function useDialog(onClose) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement;

    const getFocusable = () =>
      Array.from(
        node.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);

    // Foco inicial dentro do modal
    const focusables = getFocusable();
    (focusables[0] || node).focus?.();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeInside = node.contains(document.activeElement);

      if (e.shiftKey) {
        if (!activeInside || document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!activeInside || document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return ref;
}

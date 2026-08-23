import { useEffect, RefObject } from "react";

/**
 * useFocusTrap
 *
 * Traps keyboard focus inside a modal container while active.
 *
 * @param {React.RefObject} containerRef - ref attached to the modal root element
 * @param {boolean} isActive - whether the trap is currently active
 * @param {Function} onClose - called when the user presses Escape
 *
 * Behaviour:
 *  - Focuses the first focusable element (or the container itself) on activation
 *  - Cycles Tab / Shift+Tab within focusable children
 *  - Calls onClose on Escape
 *  - Restores focus to the previously focused element on deactivation
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  isActive: boolean,
  onClose?: () => void
): void {
  useEffect(() => {
    if (!isActive) return;

    const node = containerRef.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), ' +
          'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);

    // Focus first focusable element (or the container as fallback)
    const focusables = getFocusable();
    (focusables[0] || node).focus?.();

    const handleKeyDown = (e: KeyboardEvent): void => {
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
        // Shift+Tab: if at first (or outside), jump to last
        if (!activeInside || document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if at last (or outside), jump to first
        if (!activeInside || document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    node.addEventListener("keydown", handleKeyDown);

    return () => {
      node.removeEventListener("keydown", handleKeyDown);
      // Restore focus to trigger element when modal closes
      previouslyFocused?.focus?.();
    };
  }, [isActive, containerRef, onClose]);
}

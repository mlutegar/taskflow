import { useRef, useId, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import styles from "./ModalOverlay.module.css";

/**
 * Modal — accessible dialog wrapper.
 *
 * Props:
 *   isOpen    {boolean}   - controls visibility
 *   onClose   {Function}  - called on backdrop click or Escape key
 *   title     {string}    - dialog label (rendered visually and as aria-labelledby)
 *   children  {ReactNode}
 *
 * Accessibility:
 *   - role="dialog" + aria-modal="true" + aria-labelledby pointing to the title
 *   - focus trap: Tab/Shift+Tab cycle within the dialog
 *   - focuses first focusable child on open
 *   - restores focus to the trigger element on close
 *   - Escape key calls onClose
 *   - backdrop click calls onClose
 */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(dialogRef, isOpen, onClose);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ outline: "none" }}
      >
        {title && (
          <span id={titleId} style={{ display: "none" }}>
            {title}
          </span>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}

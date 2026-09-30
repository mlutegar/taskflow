import { useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './ModalOverlay.module.css'

interface ModalOverlayProps {
  onClose: () => void
  children: ReactNode
  /** Variante lateral (drawer) em telas largas. Default: modal centralizado. */
  variant?: 'center' | 'side'
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export default function ModalOverlay({ onClose, children, variant = 'center' }: ModalOverlayProps): React.ReactElement {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Fecha no Esc + trava o foco dentro do diálogo (Tab/Shift+Tab ciclam).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const root = dialogRef.current
      if (!root) return
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Foca o primeiro elemento ao abrir e devolve o foco ao elemento anterior ao fechar.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const root = dialogRef.current
    const firstFocusable = root?.querySelector<HTMLElement>(FOCUSABLE)
    // O AddTaskForm já tem autoFocus no título; só forçamos foco se nada assumiu.
    if (firstFocusable && root && !root.contains(document.activeElement)) {
      firstFocusable.focus()
    }
    return () => { previouslyFocused?.focus?.() }
  }, [])

  return createPortal(
    <div
      ref={dialogRef}
      className={`${styles.overlay} ${variant === 'side' ? styles.side : ''}`}
      role="dialog"
      aria-modal="true"
      onClick={(e: React.MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>,
    document.body
  )
}

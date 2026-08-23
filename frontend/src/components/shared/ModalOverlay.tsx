import { useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './ModalOverlay.module.css'

interface ModalOverlayProps {
  onClose: () => void
  children: ReactNode
}

export default function ModalOverlay({ onClose, children }: ModalOverlayProps): React.ReactElement {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      onClick={(e: React.MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>,
    document.body
  )
}

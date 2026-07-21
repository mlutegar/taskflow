import { useEffect } from 'react'
import styles from './ModalOverlay.module.css'

export default function ModalOverlay({ onClose, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}

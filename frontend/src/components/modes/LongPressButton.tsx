import type { ReactNode, CSSProperties } from "react";
import { useLongPress } from "../../lib/useLongPress";

interface LongPressButtonProps {
  onClick: () => void;
  onLongPress: () => void;
  className?: string;
  style?: CSSProperties;
  title?: string;
  children: ReactNode;
}

/**
 * Botão que dispara `onLongPress` ao segurar (mobile) ou clicar com o botão
 * direito / tecla de menu (desktop), e `onClick` no toque/clique curto.
 * Dá feedback visual enquanto segura e encapsula o hook para uso em listas.
 */
export default function LongPressButton({
  onClick,
  onLongPress,
  className,
  style,
  title,
  children,
}: LongPressButtonProps): JSX.Element {
  const lp = useLongPress(onLongPress);
  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-haspopup="dialog"
      style={{
        ...style,
        WebkitTouchCallout: "none",
        userSelect: "none",
        transform: lp.pressing ? "scale(0.98)" : style?.transform,
        opacity: lp.pressing ? 0.85 : style?.opacity,
        transition: "transform 0.12s ease, opacity 0.12s ease",
      }}
      onClick={() => { if (lp.shouldSuppressClick()) return; onClick(); }}
      onPointerDown={lp.onPointerDown}
      onPointerMove={lp.onPointerMove}
      onPointerUp={lp.onPointerUp}
      onPointerLeave={lp.onPointerLeave}
      onPointerCancel={lp.onPointerCancel}
      onContextMenu={lp.onContextMenu}
      onKeyDown={lp.onKeyDown}
    >
      {children}
    </button>
  );
}

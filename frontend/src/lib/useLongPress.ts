/**
 * useLongPress — dispara `onLongPress` ao segurar (touch/caneta) ou ao clicar
 * com o botão direito / tecla de menu (desktop). Unifica mouse+touch+caneta via
 * Pointer Events.
 *
 * Retorna handlers para espalhar no elemento, o estado `pressing` (para feedback
 * visual) e `shouldSuppressClick()` para o onClick ignorar a seleção logo após
 * um long-press.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent, KeyboardEvent } from "react";

interface Options {
  /** ms para considerar "segurar" (default 450) */
  delay?: number;
  /** movimento (px) que cancela o long-press por ser scroll (default 10) */
  moveTolerance?: number;
  /** vibração (ms) ao disparar; 0 desativa (default 15) */
  vibrateMs?: number;
}

export interface LongPressHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

export function useLongPress(
  onLongPress: () => void,
  { delay = 450, moveTolerance = 10, vibrateMs = 15 }: Options = {}
): LongPressHandlers & { pressing: boolean; shouldSuppressClick: () => boolean } {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef<boolean>(false);
  const [pressing, setPressing] = useState<boolean>(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setPressing(false);
  }, []);

  // Cancela o long-press se a página rolar enquanto segura.
  useEffect(() => {
    if (!pressing) return;
    const onScroll = () => clear();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [pressing, clear]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const fire = useCallback(() => {
    fired.current = true;
    setPressing(false);
    if (vibrateMs > 0 && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(vibrateMs);
    }
    onLongPress();
  }, [onLongPress, vibrateMs]);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    // Mouse usa o botão direito (onContextMenu); só segura em touch/caneta.
    if (e.pointerType === "mouse") return;
    fired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    if (timer.current) clearTimeout(timer.current);
    setPressing(true);
    timer.current = setTimeout(fire, delay);
  }, [delay, fire]);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (!start.current) return;
    if (Math.abs(e.clientX - start.current.x) > moveTolerance ||
        Math.abs(e.clientY - start.current.y) > moveTolerance) {
      clear();
    }
  }, [clear, moveTolerance]);

  const onPointerUp = useCallback(() => clear(), [clear]);
  const onPointerLeave = useCallback(() => clear(), [clear]);
  const onPointerCancel = useCallback(() => clear(), [clear]);

  const onContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    fire();
  }, [fire]);

  // Teclado: tecla de menu de contexto ou Shift+F10 abrem os detalhes.
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      e.preventDefault();
      fire();
    }
  }, [fire]);

  // true uma única vez após um long-press, para o onClick ignorar a seleção.
  const shouldSuppressClick = useCallback((): boolean => {
    if (fired.current) {
      fired.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onPointerCancel,
    onContextMenu, onKeyDown, pressing, shouldSuppressClick,
  };
}

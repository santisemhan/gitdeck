import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { readStoredNumber, writeStoredNumber } from "../utils/storage";

export interface UsePanelWidthOptions {
  /** Default width if nothing is persisted yet. */
  initial: number;
  /** Minimum allowed width in pixels. */
  min: number;
  /**
   * Maximum allowed width. May be a number or a function that recomputes on every
   * pointer-move tick (handy when the cap depends on window size / the other panel).
   */
  max: number | (() => number);
  /** localStorage key; omit to disable persistence. */
  storageKey?: string;
  /**
   * Which way a positive mouse delta should grow the width.
   *  - "right" → the handle lives on the right edge of the panel (left sidebar pattern).
   *  - "left"  → the handle lives on the left  edge of the panel (right panel pattern).
   */
  grow: "right" | "left";
}

export interface UsePanelWidth {
  width: number;
  /** Force-set width; useful for window-resize clamping. */
  setWidth: (next: number) => void;
  /** mousedown handler for the drag handle. */
  startResize: (event: ReactMouseEvent) => void;
}

function resolveMax(max: number | (() => number)): number {
  return typeof max === "function" ? max() : max;
}

export function usePanelWidth(options: UsePanelWidthOptions): UsePanelWidth {
  const { initial, min, max, storageKey, grow } = options;
  const [width, setWidthState] = useState<number>(() => {
    const stored = storageKey !== undefined ? readStoredNumber(storageKey, initial) : initial;
    return clamp(stored, min, resolveMax(max));
  });
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const maxRef = useRef(max);
  maxRef.current = max;

  const setWidth = useCallback(
    (next: number) => {
      setWidthState(clamp(next, min, resolveMax(maxRef.current)));
    },
    [min],
  );

  const startResize = useCallback((event: ReactMouseEvent) => {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: width };
  }, [width]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = event.clientX - drag.startX;
      const raw = grow === "right" ? drag.startWidth + delta : drag.startWidth - delta;
      const next = clamp(raw, min, resolveMax(maxRef.current));
      setWidthState((prev) => (prev === next ? prev : next));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [grow, min]);

  useEffect(() => {
    if (storageKey === undefined) return;
    writeStoredNumber(storageKey, width);
  }, [storageKey, width]);

  return { width, setWidth, startResize };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) max = min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

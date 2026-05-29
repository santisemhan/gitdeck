import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { readStoredNumber, writeStoredNumber } from "../utils/storage";

type MinValue = number | (() => number);

export interface UseResizableColumnsOptions<K extends string> {
  /** Ordered list of column keys this hook manages. */
  keys: readonly K[];
  /** Initial width if no value is persisted. */
  initial: Record<K, number>;
  /** Minimum width per key — either a static number or a function (re-read every drag tick). */
  min: Record<K, MinValue>;
  /** localStorage key per column. Omit to disable persistence for that key. */
  storageKeys?: Partial<Record<K, string>>;
}

export interface UseResizableColumns<K extends string> {
  widths: Record<K, number>;
  /**
   * Begin a resize for `key`. Pass `invert` when the drag handle sits on the
   * column's left edge, so dragging left grows the column instead of shrinking it.
   */
  startResize: (key: K, invert?: boolean) => (event: ReactMouseEvent) => void;
}

function resolveMin(min: MinValue): number {
  return typeof min === "function" ? min() : min;
}

/**
 * Generic horizontal column resize state. Persists each column's width to
 * localStorage (when a storage key is provided) and clamps to per-column
 * minimums during drag.
 */
export function useResizableColumns<K extends string>(
  options: UseResizableColumnsOptions<K>,
): UseResizableColumns<K> {
  const { keys, initial, min, storageKeys } = options;

  const [widths, setWidths] = useState<Record<K, number>>(() => {
    const out = {} as Record<K, number>;
    for (const key of keys) {
      const storageKey = storageKeys?.[key];
      const stored = storageKey !== undefined ? readStoredNumber(storageKey, initial[key]) : initial[key];
      out[key] = Math.max(resolveMin(min[key]), stored);
    }
    return out;
  });

  const minRef = useRef(min);
  minRef.current = min;
  const resizeRef = useRef<{ key: K; startX: number; startWidth: number; invert: boolean } | null>(null);

  const startResize = useCallback(
    (key: K, invert = false) => (event: ReactMouseEvent) => {
      event.preventDefault();
      resizeRef.current = { key, startX: event.clientX, startWidth: widths[key], invert };
    },
    [widths],
  );

  useEffect(() => {
    const onPointerMove = (event: MouseEvent) => {
      const active = resizeRef.current;
      if (!active) return;
      const minWidth = resolveMin(minRef.current[active.key]);
      const delta = event.clientX - active.startX;
      const next = Math.max(minWidth, active.startWidth + (active.invert ? -delta : delta));
      setWidths((prev) => (prev[active.key] === next ? prev : { ...prev, [active.key]: next }));
    };
    const stopResize = () => {
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, []);

  // Grow if a dynamic minimum exceeds the current width.
  const minSignature = useMemo(
    () => keys.map((k) => `${k}:${resolveMin(min[k])}`).join("|"),
    // re-evaluate when any `min` value changes; callers must pass a stable reference
    // when min is a number, and a fresh function only when the dynamic value changes.
    [keys, min],
  );

  useEffect(() => {
    setWidths((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of keys) {
        const minWidth = resolveMin(min[key]);
        if (next[key] < minWidth) {
          next[key] = minWidth;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // minSignature captures the actual min values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minSignature]);

  useEffect(() => {
    if (!storageKeys) return;
    for (const key of keys) {
      const storageKey = storageKeys[key];
      if (storageKey !== undefined) writeStoredNumber(storageKey, widths[key]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widths]);

  return { widths, startResize };
}

import { useCallback, useEffect, useState } from "react";

export interface UseContextMenu<T> {
  menu: T | null;
  open: (state: T) => void;
  close: () => void;
}

/**
 * Tracks an optional context-menu payload and wires up document-level
 * dismissal on outside mousedown or Escape keydown while the menu is open.
 */
export function useContextMenu<T>(): UseContextMenu<T> {
  const [menu, setMenu] = useState<T | null>(null);

  const open = useCallback((state: T) => setMenu(state), []);
  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onClose = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      setMenu(null);
    };
    document.addEventListener("mousedown", onClose);
    document.addEventListener("keydown", onClose);
    return () => {
      document.removeEventListener("mousedown", onClose);
      document.removeEventListener("keydown", onClose);
    };
  }, [menu]);

  return { menu, open, close };
}

import { useCallback, useRef, useState } from "react";

/**
 * Undo/redo stack over an immutable value. `set` pushes a new present and
 * clears the redo branch; `reset` replaces everything without history (used
 * when loading a page from the server).
 */
export function useHistory<T>(initial: T) {
  const [present, setPresent] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, force] = useState(0);
  const bump = () => force((n) => n + 1);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setPresent((prev) => {
        const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        past.current.push(prev);
        if (past.current.length > 200) past.current.shift();
        future.current = [];
        bump();
        return value;
      });
    },
    [],
  );

  const undo = useCallback(() => {
    if (!past.current.length) return;
    setPresent((cur) => {
      const prev = past.current.pop() as T;
      future.current.push(cur);
      bump();
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    setPresent((cur) => {
      const next = future.current.pop() as T;
      past.current.push(cur);
      bump();
      return next;
    });
  }, []);

  const reset = useCallback((value: T) => {
    past.current = [];
    future.current = [];
    setPresent(value);
    bump();
  }, []);

  return {
    value: present,
    set,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

import { useCallback, useRef, useState } from "react";
import { Ann } from "./annot";

type Key = string | number;

/**
 * Shared "ink per page" state used by the notebook editor, the PDF annotator
 * and the split workspace. Handles a per-key annotation map, a per-key
 * undo/redo stack and a debounced save.
 */
export function usePageInk(save: (key: Key, ann: Ann) => Promise<void>) {
  const [anns, setAnns] = useState<Record<Key, Ann>>({});
  const undo = useRef<Record<Key, Ann[]>>({});
  const redo = useRef<Record<Key, Ann[]>>({});
  const timers = useRef<Record<Key, ReturnType<typeof setTimeout>>>({});
  const [savingCount, setSavingCount] = useState(0);
  const [, force] = useState(0);
  const bump = () => force((n) => n + 1);

  const saveRef = useRef(save);
  saveRef.current = save;

  const scheduleSave = useCallback((key: Key, ann: Ann) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      setSavingCount((n) => n + 1);
      try {
        await saveRef.current(key, ann);
      } finally {
        setSavingCount((n) => Math.max(0, n - 1));
      }
    }, 800);
  }, []);

  /** Seed a key's annotation from the server without touching history. */
  const hydrate = useCallback((key: Key, ann: Ann) => {
    setAnns((prev) => (prev[key] ? prev : { ...prev, [key]: ann }));
  }, []);

  const commit = useCallback(
    (key: Key, next: Ann) => {
      setAnns((prev) => {
        const cur = prev[key] ?? { items: [] };
        (undo.current[key] ??= []).push(cur);
        if (undo.current[key].length > 100) undo.current[key].shift();
        redo.current[key] = [];
        return { ...prev, [key]: next };
      });
      scheduleSave(key, next);
      bump();
    },
    [scheduleSave],
  );

  const step = useCallback(
    (key: Key, dir: "undo" | "redo") => {
      const from = dir === "undo" ? undo.current : redo.current;
      const to = dir === "undo" ? redo.current : undo.current;
      const stack = from[key];
      if (!stack?.length) return;
      setAnns((prev) => {
        const cur = prev[key] ?? { items: [] };
        (to[key] ??= []).push(cur);
        const val = stack.pop() as Ann;
        scheduleSave(key, val);
        return { ...prev, [key]: val };
      });
      bump();
    },
    [scheduleSave],
  );

  const annOf = useCallback((key: Key): Ann => anns[key] ?? { items: [] }, [anns]);

  return {
    anns,
    annOf,
    savingCount,
    hydrate,
    commit,
    undo: (key: Key) => step(key, "undo"),
    redo: (key: Key) => step(key, "redo"),
    clear: (key: Key) => commit(key, { items: [] }),
    canUndo: (key: Key) => !!undo.current[key]?.length,
    canRedo: (key: Key) => !!redo.current[key]?.length,
  };
}

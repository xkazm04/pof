'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'pof-feature-vis-';

function readStore(moduleId: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${moduleId}`);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeStore(moduleId: string, state: Record<string, boolean>) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${moduleId}`, JSON.stringify(state));
  } catch { /* quota exceeded — ignore */ }
}

type VisState = {
  vis: Record<string, boolean>;
  /** True once an edit (not a read) produced `vis` — only then is it persisted.
   *  A mount or module switch merely READ the store; writing that snapshot back
   *  cost one write per mounted section and could rewrite a stale read over a
   *  newer one. */
  edited: boolean;
};

export function useFeatureVisibility(moduleId: string) {
  const [prevId, setPrevId] = useState(moduleId);
  const [state, setState] = useState<VisState>(() => ({ vis: readStore(moduleId), edited: false }));
  const vis = state.vis;

  // Reset during render when moduleId changes (official React pattern)
  if (prevId !== moduleId) {
    setPrevId(moduleId);
    setState({ vis: readStore(moduleId), edited: false });
  }

  // Persist edits only
  useEffect(() => {
    if (state.edited) writeStore(moduleId, state.vis);
  }, [moduleId, state]);

  /** Apply an edit; returning the same map is a no-op (no re-render, no write). */
  const setVis = useCallback((fn: (prev: Record<string, boolean>) => Record<string, boolean>) => {
    setState((prev) => {
      const next = fn(prev.vis);
      return next === prev.vis ? prev : { vis: next, edited: true };
    });
  }, []);

  const isVisible = useCallback(
    (sectionId: string) => vis[sectionId] !== false,
    [vis],
  );

  const toggle = useCallback((sectionId: string) => {
    setVis((prev) => ({ ...prev, [sectionId]: prev[sectionId] === false }));
  }, [setVis]);

  const setAll = useCallback((visible: boolean, allIds?: string[]) => {
    setVis((prev) => {
      const keys = allIds ?? Object.keys(prev);
      let changed = false;
      for (const key of keys) {
        const cur = prev[key] !== false;
        if (cur !== visible) { changed = true; break; }
      }
      if (!changed) return prev;
      const next: Record<string, boolean> = { ...prev };
      for (const key of keys) next[key] = visible;
      return next;
    });
  }, [setVis]);

  const setMany = useCallback((ids: string[], visible: boolean) => {
    setVis((prev) => {
      let changed = false;
      for (const id of ids) {
        const cur = prev[id] !== false;
        if (cur !== visible) { changed = true; break; }
      }
      if (!changed) return prev;
      const next = { ...prev };
      for (const id of ids) next[id] = visible;
      return next;
    });
  }, [setVis]);

  return { isVisible, toggle, setAll, setMany, _raw: vis } as const;
}

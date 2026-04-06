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

export function useFeatureVisibility(moduleId: string) {
  const [prevId, setPrevId] = useState(moduleId);
  const [vis, setVis] = useState<Record<string, boolean>>(() => readStore(moduleId));

  // Reset during render when moduleId changes (official React pattern)
  if (prevId !== moduleId) {
    setPrevId(moduleId);
    setVis(readStore(moduleId));
  }

  // Persist on every state change
  useEffect(() => {
    writeStore(moduleId, vis);
  }, [moduleId, vis]);

  const isVisible = useCallback(
    (sectionId: string) => vis[sectionId] !== false,
    [vis],
  );

  const toggle = useCallback((sectionId: string) => {
    setVis((prev) => ({ ...prev, [sectionId]: prev[sectionId] === false }));
  }, []);

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
  }, []);

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
  }, []);

  return { isVisible, toggle, setAll, setMany, _raw: vis } as const;
}

'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_PREFIX = 'pof-feature-vis-';

type Vis = Record<string, boolean>;
const EMPTY: Vis = {};

function readRaw(moduleId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${moduleId}`);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Vis {
  if (!raw) return EMPTY;
  try {
    return JSON.parse(raw) as Vis;
  } catch {
    return EMPTY;
  }
}

function writeStore(moduleId: string, state: Vis) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${moduleId}`, JSON.stringify(state));
  } catch { /* quota exceeded — ignore */ }
}

/**
 * ONE state per module, shared by every hook instance (each VisibleSection mounts
 * its own, and so does the Feature Map). `seenRaw` is the storage value `vis` was
 * last synced from: a different value in storage (another browser tab, a test)
 * re-parses, while a write that storage refused (quota) keeps the in-memory edit.
 */
const cache = new Map<string, { seenRaw: string | null; vis: Vis }>();
const listeners = new Set<() => void>();

function snapshot(moduleId: string): Vis {
  const raw = readRaw(moduleId);
  const hit = cache.get(moduleId);
  if (hit && hit.seenRaw === raw) return hit.vis;
  const vis = parse(raw);
  cache.set(moduleId, { seenRaw: raw, vis });
  return vis;
}

function emit() {
  for (const l of listeners) l();
}

let storageBound = false;
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageBound && typeof window !== 'undefined') {
    storageBound = true;
    // Another tab's write (the event only fires cross-document).
    window.addEventListener('storage', (e) => {
      if (e.key === null || e.key.startsWith(STORAGE_PREFIX)) emit();
    });
  }
  return () => { listeners.delete(listener); };
}

/** Apply an edit to one module's shared state; returning the same map is a no-op
 *  (no notify, no write). Only edits are persisted — a read never writes. */
function edit(moduleId: string, fn: (prev: Vis) => Vis) {
  const prev = snapshot(moduleId);
  const next = fn(prev);
  if (next === prev) return;
  writeStore(moduleId, next);
  cache.set(moduleId, { seenRaw: readRaw(moduleId), vis: next });
  emit();
}

export function useFeatureVisibility(moduleId: string) {
  const getSnapshot = useCallback(() => snapshot(moduleId), [moduleId]);
  const vis = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const setVis = useCallback((fn: (prev: Vis) => Vis) => edit(moduleId, fn), [moduleId]);

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

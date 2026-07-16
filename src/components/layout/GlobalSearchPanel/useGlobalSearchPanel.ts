'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useNavigationStore } from '@/stores/navigationStore';
import { useProjectStore } from '@/stores/projectStore';
import { apiFetch } from '@/lib/api-utils';
import type { SearchResult } from '@/lib/search-index';

// ── Index freshness ───────────────────────────────────────────────────────────
// The search index source is almost entirely static (categories, sub-modules,
// checklist items, quick actions, feature definitions) plus a few rarely-changing
// DB tables. The index persists in SQLite across opens, so rebuilding it on every
// panel open is wasted work (a full DELETE + hundreds of synchronous inserts).
// Rebuild lazily once per project instead; the manual "Reindex" button
// remains the force path for the rare cases where the DB-backed rows change.
//
// The search index is per-project SQLite data, so this guard is keyed by the
// active project path. When the user switches/deletes/creates a project the path
// changes and the next panel open lazily rebuilds against the new project rather
// than serving the previous project's stale index.
let indexEnsuredForPath: string | null = null;

export function useGlobalSearchPanel() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastRebuilt, setLastRebuilt] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic request token: only the latest dispatched search may apply its
  // response, so a slower older keystroke's result can't overwrite a newer one.
  const searchSeqRef = useRef(0);

  const navigateToModule = useNavigationStore((s) => s.navigateToModule);
  const projectPath = useProjectStore((s) => s.projectPath);
  const prefersReduced = useReducedMotion();

  // ── Keyboard shortcut: Ctrl+K ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // ── Focus input when opening ──
  useEffect(() => {
    if (open) {
      // Small delay to let animation start
      requestAnimationFrame(() => inputRef.current?.focus());
      // Build the index once per project; reuse the persisted index thereafter.
      // handleRebuild records the ensured path on success. Keying by projectPath
      // means a project switch (path change) re-triggers a lazy rebuild.
      if (indexEnsuredForPath !== projectPath) {
        handleRebuild(true);
      }
    } else {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setActiveFilter(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Search with debounce ──
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setActiveIndex(0);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      // Claim the latest request token for this dispatch. Any response whose
      // token is no longer current is dropped so an out-of-order (slower, older)
      // response can't clobber the results of a newer query.
      const seq = ++searchSeqRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query });
        if (activeFilter) params.set('types', activeFilter);
        const data = await apiFetch<{ results: SearchResult[]; count: number; lastRebuilt: string | null }>(`/api/search?${params.toString()}`);
        if (seq !== searchSeqRef.current) return; // superseded by a newer search
        setResults(data.results ?? []);
        setLastRebuilt(data.lastRebuilt ?? null);
        setActiveIndex(0);
      } catch {
        if (seq !== searchSeqRef.current) return; // superseded by a newer search
        setResults([]);
      } finally {
        if (seq === searchSeqRef.current) setLoading(false);
      }
    }, 180);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeFilter]);

  // ── Rebuild index ──
  const handleRebuild = useCallback(async (silent = false) => {
    if (!silent) setRebuilding(true);
    try {
      await apiFetch('/api/search?rebuild=1');
      setLastRebuilt(new Date().toISOString());
      // Mark the index as built for the current project only on success, so a
      // failed first rebuild is retried on the next open rather than left
      // permanently stale, and a later project switch forces a fresh rebuild.
      indexEnsuredForPath = projectPath;
    } catch { /* ignore */ }
    if (!silent) setRebuilding(false);
  }, [projectPath]);

  // ── Navigate to result ──
  const handleSelect = useCallback((result: SearchResult) => {
    if (result.moduleId) {
      navigateToModule(result.moduleId);
    }
    setOpen(false);
  }, [navigateToModule]);

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }
  }, [results, activeIndex, handleSelect]);

  // ── Scroll active item into view ──
  useEffect(() => {
    if (!resultsRef.current) return;
    const activeEl = resultsRef.current.querySelector(`[data-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // ── Filter chips ──
  const filterTypes = ['checklist', 'feature', 'module', 'finding', 'build'] as const;

  const backdropMotion = prefersReduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } };

  const panelMotion = prefersReduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: -8, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -8, scale: 0.98 }, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] as const } };

  return {
    open, setOpen,
    query, setQuery,
    results,
    loading,
    rebuilding,
    activeIndex, setActiveIndex,
    lastRebuilt,
    activeFilter, setActiveFilter,
    inputRef,
    resultsRef,
    handleRebuild,
    handleSelect,
    handleKeyDown,
    filterTypes,
    backdropMotion,
    panelMotion,
  };
}

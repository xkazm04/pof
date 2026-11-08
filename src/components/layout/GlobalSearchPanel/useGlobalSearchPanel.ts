'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useNavigationStore } from '@/stores/navigationStore';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useModuleActions } from '@/hooks/useModuleActions';
import { useHotkey, useEscapeLayer } from '@/hooks/useHotkey';
import { apiFetch } from '@/lib/api-utils';
import type { SearchResult } from '@/lib/search-index';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { resolveSearchIntents } from './searchIntents';
import { ALERT_ID_PREFIX, buildHome } from './paletteHome';
import { readRecents, recordRecent } from './recentSelections';

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

/** Recents are places. An alert row is news with an event id: it goes stale, a place does not. */
function rememberPlace(projectPath: string | null, result: SearchResult): void {
  if (!result.id.startsWith(ALERT_ID_PREFIX)) recordRecent(projectPath, result);
}

export function useGlobalSearchPanel() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setResults] = useState<SearchResult[]>([]);
  const [recents, setRecents] = useState<SearchResult[]>([]);
  const [rebuilding, setRebuilding] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastRebuilt, setLastRebuilt] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  // Bumped to re-run the current query without changing it (Retry).
  const [searchNonce, setSearchNonce] = useState(0);
  // Which search the shown outcome answers. `loading` is derived from it, so the
  // debounce window counts as searching and cannot read as "No results".
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const searchKey = query.trim() ? JSON.stringify([query, activeFilter, searchNonce]) : null;
  const loading = searchKey !== null && settledKey !== searchKey;

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic request token: only the latest dispatched search may apply its
  // response, so a slower older keystroke's result can't overwrite a newer one.
  const searchSeqRef = useRef(0);

  const navigateToModule = useNavigationStore((s) => s.navigateToModule);
  const projectPath = useProjectStore((s) => s.projectPath);
  const checklistProgress = useModuleStore((s) => s.checklistProgress);
  const feedEvents = useActivityFeedStore((s) => s.events);
  const dismissEvent = useActivityFeedStore((s) => s.dismissEvent);
  const { sendPromptToModule } = useModuleActions();
  const prefersReduced = useReducedMotion();

  // ── Keyboard shortcut: Ctrl+K (shell scope — a visible module that owns
  // mod+k, e.g. the ability Spellbook, outranks it) + Escape as a LIFO layer ──
  useHotkey('mod+k', () => setOpen((prev) => !prev), { allowInInput: true, id: 'shell.global-search' });
  useEscapeLayer('global-search', open, () => setOpen(false));

  // ── Focus input when opening ──
  useEffect(() => {
    if (open) {
      setRecents(readRecents(projectPath));
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
      setSearchFailed(false);
      searchSeqRef.current++; // an in-flight response no longer answers anything
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      // Claim the latest request token for this dispatch. Any response whose
      // token is no longer current is dropped so an out-of-order (slower, older)
      // response can't clobber the results of a newer query.
      const seq = ++searchSeqRef.current;
      try {
        const params = new URLSearchParams({ q: query });
        if (activeFilter) params.set('types', activeFilter);
        const data = await apiFetch<{ results: SearchResult[]; count: number; lastRebuilt: string | null }>(`/api/search?${params.toString()}`);
        if (seq !== searchSeqRef.current) return; // superseded by a newer search
        setResults(data.results ?? []);
        setSearchFailed(false);
        setLastRebuilt(data.lastRebuilt ?? null);
        setActiveIndex(0);
      } catch {
        if (seq !== searchSeqRef.current) return; // superseded by a newer search
        setResults([]);
        setSearchFailed(true);
      } finally {
        if (seq === searchSeqRef.current) setSettledKey(searchKey);
      }
    }, 180);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // searchKey is derived from exactly these three.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeFilter, searchNonce]);

  // ── Rebuild index ──
  const retrySearch = useCallback(() => setSearchNonce((n) => n + 1), []);

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

  // ── Resolve every hit to its intents (navigate / run / done-state) ──
  // A blank query shows the palette home (unread Fix alerts, then recents) in
  // place of results, so the same arrow/Enter/Shift+Enter model drives it.
  const blank = !query.trim();
  const homeRows = useMemo(
    () => (blank ? buildHome({ recents, events: feedEvents }) : []),
    [blank, recents, feedEvents],
  );
  const results = useMemo(
    () => (blank ? homeRows.map((h) => h.result) : searchResults),
    [blank, homeRows, searchResults],
  );
  const homeKinds = blank ? homeRows.map((h) => h.kind) : null;
  const intents = useMemo(
    () => results.map((r, i) => {
      const base = resolveSearchIntents(r, checklistProgress);
      const run = blank ? homeRows[i]?.run : null;
      return run ? { ...base, run } : base;
    }),
    [results, checklistProgress, blank, homeRows],
  );

  // ── Navigate to result (Enter / row click — never a paid run) ──
  const handleSelect = useCallback((result: SearchResult) => {
    const { primary } = resolveSearchIntents(result, checklistProgress);
    rememberPlace(projectPath, result);
    if (primary) navigateToModule(primary.moduleId);
    setOpen(false);
  }, [navigateToModule, checklistProgress, projectPath]);

  // ── Run a quick action (Shift+Enter / Run button only) ──
  // A hit with no run intent falls back to its navigation.
  const handleRun = useCallback((result: SearchResult) => {
    const homeRun = homeRows.find((h) => h.result.id === result.id)?.run;
    const run = homeRun ?? resolveSearchIntents(result, checklistProgress).run;
    if (!run) { handleSelect(result); return; }
    rememberPlace(projectPath, result);
    sendPromptToModule(run.moduleId, run.prompt);
    // Same rule as the feed card's Fix: a dispatched fix is a read alert, so a
    // second Shift+Enter cannot start the same paid run again.
    if (homeRun && result.id.startsWith(ALERT_ID_PREFIX)) dismissEvent(result.id.slice(ALERT_ID_PREFIX.length));
    setOpen(false);
  }, [checklistProgress, handleSelect, sendPromptToModule, homeRows, projectPath, dismissEvent]);

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
      if (e.shiftKey) handleRun(results[activeIndex]);
      else handleSelect(results[activeIndex]);
    }
  }, [results, activeIndex, handleSelect, handleRun]);

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
    intents,
    homeKinds,
    loading,
    searchFailed,
    retrySearch,
    rebuilding,
    activeIndex, setActiveIndex,
    lastRebuilt,
    activeFilter, setActiveFilter,
    inputRef,
    resultsRef,
    handleRebuild,
    handleSelect,
    handleRun,
    handleKeyDown,
    filterTypes,
    backdropMotion,
    panelMotion,
  };
}

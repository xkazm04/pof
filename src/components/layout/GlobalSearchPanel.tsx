'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Search, X, ListChecks, Box, Layers, AlertTriangle, Package,
  ArrowRight, RefreshCw, Loader2,
} from 'lucide-react';
import { useNavigationStore } from '@/stores/navigationStore';
import type { SearchResult } from '@/lib/search-index';

// ── Type icons ───────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: typeof Box; label: string; color: string }> = {
  checklist: { icon: ListChecks, label: 'Checklist', color: '#00ff88' },
  feature:   { icon: Box, label: 'Feature', color: '#60a5fa' },
  module:    { icon: Layers, label: 'Module', color: '#a78bfa' },
  category:  { icon: Layers, label: 'Category', color: '#f59e0b' },
  finding:   { icon: AlertTriangle, label: 'Finding', color: '#ef4444' },
  build:     { icon: Package, label: 'Build', color: '#94a3b8' },
};

// ── Main component ──────────────────────────────────────────────────────────

export function GlobalSearchPanel() {
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

  const navigateToModule = useNavigationStore((s) => s.navigateToModule);
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
      // Rebuild index on first open (ensures it's fresh)
      handleRebuild(true);
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
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query });
        if (activeFilter) params.set('types', activeFilter);
        const res = await fetch(`/api/search?${params.toString()}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setLastRebuilt(data.lastRebuilt ?? null);
        setActiveIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
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
      const res = await fetch('/api/search?rebuild=1');
      const data = await res.json();
      if (data.ok) setLastRebuilt(new Date().toISOString());
    } catch { /* ignore */ }
    if (!silent) setRebuilding(false);
  }, []);

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="search-backdrop"
          {...backdropMotion}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Panel */}
          <motion.div
            key="search-panel"
            {...panelMotion}
            className="relative w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search checklist items, features, modules, findings..."
                className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
                spellCheck={false}
                autoComplete="off"
              />
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted flex-shrink-0" />}
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-2xs text-text-muted bg-background border border-border rounded font-mono">
                esc
              </kbd>
              <button
                onClick={() => setOpen(false)}
                className="p-0.5 rounded text-text-muted hover:text-text transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto">
              <button
                onClick={() => setActiveFilter(null)}
                className={`px-2 py-0.5 rounded-full text-2xs font-medium transition-colors whitespace-nowrap ${
                  activeFilter === null
                    ? 'bg-accent-medium text-[#00ff88]'
                    : 'text-text-muted hover:text-text hover:bg-surface-hover'
                }`}
              >
                All
              </button>
              {filterTypes.map((t) => {
                const meta = TYPE_META[t];
                return (
                  <button
                    key={t}
                    onClick={() => setActiveFilter(activeFilter === t ? null : t)}
                    className={`px-2 py-0.5 rounded-full text-2xs font-medium transition-colors whitespace-nowrap ${
                      activeFilter === t
                        ? 'text-white'
                        : 'text-text-muted hover:text-text hover:bg-surface-hover'
                    }`}
                    style={activeFilter === t ? { backgroundColor: `${meta.color}30`, color: meta.color } : undefined}
                  >
                    {meta.label}
                  </button>
                );
              })}

              <div className="ml-auto flex-shrink-0">
                <button
                  onClick={() => handleRebuild(false)}
                  disabled={rebuilding}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs text-text-muted hover:text-text transition-colors disabled:opacity-40"
                  title="Rebuild search index"
                >
                  <RefreshCw className={`w-3 h-3 ${rebuilding ? 'animate-spin' : ''}`} />
                  Reindex
                </button>
              </div>
            </div>

            {/* Results */}
            <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
              {!query.trim() ? (
                <div className="px-4 py-8 text-center">
                  <Search className="w-8 h-8 text-border-bright mx-auto mb-2" />
                  <p className="text-xs text-text-muted">
                    Type to search across checklist items, features, findings, and builds
                  </p>
                  <p className="text-2xs text-text-muted mt-1">
                    <kbd className="px-1 py-0.5 bg-background border border-border rounded font-mono text-2xs">Ctrl+K</kbd> to toggle
                  </p>
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs text-text-muted">No results for &ldquo;{query}&rdquo;</p>
                  <p className="text-2xs text-text-muted mt-1">Try different keywords or rebuild the index</p>
                </div>
              ) : (
                results.map((r, i) => (
                  <SearchResultRow
                    key={r.id}
                    result={r}
                    active={i === activeIndex}
                    index={i}
                    onSelect={handleSelect}
                    onHover={setActiveIndex}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-background text-2xs text-text-muted">
              <span>
                {results.length > 0
                  ? `${results.length} result${results.length !== 1 ? 's' : ''}`
                  : 'Global search'}
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-px bg-surface border border-border rounded font-mono">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-px bg-surface border border-border rounded font-mono">↵</kbd>
                  open
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Result row ───────────────────────────────────────────────────────────────

function SearchResultRow({
  result,
  active,
  index,
  onSelect,
  onHover,
}: {
  result: SearchResult;
  active: boolean;
  index: number;
  onSelect: (r: SearchResult) => void;
  onHover: (i: number) => void;
}) {
  const meta = TYPE_META[result.type] ?? TYPE_META.feature;
  const Icon = meta.icon;

  return (
    <button
      data-index={index}
      onClick={() => onSelect(result)}
      onMouseEnter={() => onHover(index)}
      className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
        active ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'
      }`}
    >
      {/* Type icon */}
      <div
        className="flex-shrink-0 mt-0.5 w-6 h-6 rounded flex items-center justify-center"
        style={{ backgroundColor: `${meta.color}18` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium text-text truncate"
            dangerouslySetInnerHTML={{ __html: highlightMarkers(result.title) }}
          />
          <span
            className="text-2xs px-1.5 py-px rounded-full flex-shrink-0"
            style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
          >
            {meta.label}
          </span>
        </div>
        {result.snippet && (
          <p
            className="text-2xs text-text-muted mt-0.5 line-clamp-2"
            dangerouslySetInnerHTML={{ __html: highlightMarkers(result.snippet) }}
          />
        )}
        {result.moduleLabel && (
          <span className="text-2xs text-text-muted mt-0.5 flex items-center gap-1">
            <Layers className="w-2.5 h-2.5" />
            {result.moduleLabel}
          </span>
        )}
      </div>

      {/* Go arrow */}
      {active && (
        <ArrowRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-1" />
      )}
    </button>
  );
}

// ── Highlight FTS5 markers ───────────────────────────────────────────────────

function highlightMarkers(text: string): string {
  // FTS5 snippet uses → and ← as markers
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/→/g, '<mark class="bg-[#00ff88]/20 text-[#00ff88] rounded px-px">')
    .replace(/←/g, '</mark>');
}

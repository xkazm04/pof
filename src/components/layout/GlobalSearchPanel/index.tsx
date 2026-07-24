'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, RefreshCw, Loader2,
} from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { TYPE_META } from './constants';
import { SearchResultRow } from './SearchResultRow';
import { useGlobalSearchPanel } from './useGlobalSearchPanel';

// ── Main component ──────────────────────────────────────────────────────────

export function GlobalSearchPanel() {
  const {
    open, setOpen,
    query, setQuery,
    results,
    loading,
    rebuilding,
    activeIndex, setActiveIndex,
    activeFilter, setActiveFilter,
    inputRef,
    resultsRef,
    handleRebuild,
    handleSelect,
    handleKeyDown,
    filterTypes,
    backdropMotion,
    panelMotion,
  } = useGlobalSearchPanel();

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
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            className="relative w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
            style={{ ['--focus-accent' as string]: 'var(--setup)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-text-muted flex-shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search checklist items, features, modules, findings..."
                // The placeholder disappears on the first keystroke, so it can't
                // serve as the field's accessible name.
                aria-label="Search checklist items, features, modules, and findings"
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
                aria-label="Close search"
                className="p-0.5 rounded text-text-muted hover:text-text transition-colors focus-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter chips */}
            <div
              className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto"
              role="group"
              aria-label="Filter results by type"
            >
              <button
                onClick={() => setActiveFilter(null)}
                aria-pressed={activeFilter === null}
                className={`px-2 py-0.5 rounded-full text-2xs font-medium transition-colors whitespace-nowrap focus-ring ${
                  activeFilter === null
                    ? 'bg-accent-medium'
                    : 'text-text-muted hover:text-text hover:bg-surface-hover'
                }`}
                style={activeFilter === null ? { color: MODULE_COLORS.setup } : undefined}
              >
                All
              </button>
              {filterTypes.map((t) => {
                const meta = TYPE_META[t];
                return (
                  <button
                    key={t}
                    onClick={() => setActiveFilter(activeFilter === t ? null : t)}
                    aria-pressed={activeFilter === t}
                    className={`px-2 py-0.5 rounded-full text-2xs font-medium transition-colors whitespace-nowrap focus-ring ${
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
                  <Search className="w-8 h-8 text-border-bright mx-auto mb-2" aria-hidden="true" />
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
              {/* Result count doubles as the search's polite live region — the
                  results list itself is silent, so without this a screen-reader
                  user gets no feedback that a query returned (or found nothing). */}
              <span role="status" aria-live="polite" aria-atomic="true">
                {loading
                  ? 'Searching…'
                  : results.length > 0
                    ? `${results.length} result${results.length !== 1 ? 's' : ''}`
                    : query.trim()
                      ? 'No results'
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

'use client';

import { useMemo, useState, useEffect } from 'react';
import { Search, Command } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSpellbookSearchIndex, MAX_RESULTS } from './spellbook-search-index';
import { SpellbookSearchPalette } from './SpellbookSearchPalette';

/** Debounce delay for the filter scan. The input stays controlled by the raw
 *  `query` (updates instantly); only the O(index) filter waits for a pause. */
const SEARCH_DEBOUNCE_MS = 150;

interface SpellbookSearchProps {
  onNavigate: (tab: string, sectionId: string) => void;
}

export function SpellbookSearch({ onNavigate }: SpellbookSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const index = useSpellbookSearchIndex();

  // Debounce the query that drives the expensive filter scan. The text field
  // stays bound to raw `query` (responsive); only this settled value re-runs
  // the O(index) scan — final results are identical, just settled after a pause.
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return index.slice(0, MAX_RESULTS);
    const q = debouncedQuery.toLowerCase().trim();
    const terms = q.split(/\s+/);
    return index
      .filter(r => terms.every(t => r.labelLower.includes(t) || r.category.includes(t)))
      .slice(0, MAX_RESULTS);
  }, [debouncedQuery, index]);

  // Reset selection when results change (state-during-render pattern)
  const [prevFiltered, setPrevFiltered] = useState(filtered);
  if (prevFiltered !== filtered) {
    setPrevFiltered(filtered);
    setSelectedIdx(0);
  }

  // Reset query/selection when open changes (state-during-render pattern)
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setQuery('');
      setSelectedIdx(0);
    }
  }

  // Global Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-text-muted px-2 py-1 rounded-lg bg-surface-deep/50 border border-border/30
                   hover:border-border/60 hover:text-text transition-colors whitespace-nowrap"
      >
        <Search className="w-3 h-3" />
        <span>Search</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 text-2xs text-text-muted/70 bg-surface/50 px-1 py-0.5 rounded border border-border/40 ml-1">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      {/* Palette overlay */}
      <AnimatePresence>
        {open && (
          <SpellbookSearchPalette
            query={query}
            setQuery={setQuery}
            filtered={filtered}
            selectedIdx={selectedIdx}
            setSelectedIdx={setSelectedIdx}
            onClose={() => setOpen(false)}
            onNavigate={onNavigate}
          />
        )}
      </AnimatePresence>
    </>
  );
}

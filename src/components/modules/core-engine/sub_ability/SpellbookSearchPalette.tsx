'use client';

import { useRef, useEffect, useCallback, useId } from 'react';
import {
  Search, ArrowUp, ArrowDown, CornerDownLeft,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  withOpacity, OPACITY_8, OPACITY_20, OPACITY_37,
} from '@/lib/chart-colors';
import { CATEGORY_LABELS, type SearchResult } from './spellbook-search-index';

interface Props {
  query: string;
  setQuery: (q: string) => void;
  filtered: SearchResult[];
  selectedIdx: number;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
  onNavigate: (tab: string, sectionId: string) => void;
}

export function SpellbookSearchPalette({ query, setQuery, filtered, selectedIdx, setSelectedIdx, onClose, onNavigate }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Stable ids wiring the combobox input to its listbox + active option
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (resultId: string) => `${baseId}-option-${resultId}`;
  const hasResults = filtered.length > 0;
  const activeOption = hasResults ? filtered[selectedIdx] : undefined;
  const activeDescendant = activeOption ? optionId(activeOption.id) : undefined;

  // Focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const handleSelect = useCallback((r: SearchResult) => {
    onNavigate(r.tab, r.sectionId);
    onClose();
  }, [onNavigate, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selectedIdx]) {
          const r = filtered[selectedIdx];
          onNavigate(r.tab, r.sectionId);
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [filtered, selectedIdx, setSelectedIdx, onNavigate, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Palette */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.15 }}
        className="relative w-full max-w-md bg-surface-deep border border-border/60 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
          <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={hasResults}
            aria-controls={listboxId}
            aria-activedescendant={activeDescendant}
            aria-autocomplete="list"
            aria-label="Search abilities, tags, effects, attributes"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search abilities, tags, effects, attributes..."
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/50 outline-none"
          />
          <kbd className="text-2xs text-text-muted/60 bg-surface/50 px-1.5 py-0.5 rounded border border-border/40">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="max-h-[300px] overflow-y-auto custom-scrollbar p-1"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-text-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((r, i) => (
              <button
                key={r.id}
                id={optionId(r.id)}
                role="option"
                aria-selected={i === selectedIdx}
                tabIndex={-1}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setSelectedIdx(i)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                  i === selectedIdx ? 'bg-surface/80' : 'hover:bg-surface/40'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: r.color, boxShadow: i === selectedIdx ? `0 0 6px ${withOpacity(r.color, OPACITY_37)}` : 'none' }}
                />
                <span className={`flex-1 text-sm font-mono truncate ${i === selectedIdx ? 'text-text' : 'text-text-muted'}`}>
                  {r.label}
                </span>
                <span
                  className="text-2xs px-1.5 py-0.5 rounded-full border flex-shrink-0"
                  style={{
                    color: r.color,
                    borderColor: withOpacity(r.color, OPACITY_20),
                    backgroundColor: withOpacity(r.color, OPACITY_8),
                  }}
                >
                  {CATEGORY_LABELS[r.category]}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border/40 text-2xs text-text-muted/60">
          <span className="flex items-center gap-1">
            <ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" /> select
          </span>
          <span className="flex items-center gap-1">
            <span className="font-mono">esc</span> close
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

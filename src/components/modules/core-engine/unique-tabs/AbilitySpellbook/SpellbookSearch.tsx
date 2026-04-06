'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Search, Command, ArrowUp, ArrowDown, CornerDownLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_EMERALD_DARK,
  withOpacity, OPACITY_8, OPACITY_20, OPACITY_37,
} from '@/lib/chart-colors';
import {
  COMBO_ABILITIES, EFFECT_TYPES,
} from './data';
import { useSpellbookData } from './context';
import { SECTIONS } from './constants';

/* ── Search types ─────────────────────────────────────────────────────── */

type SearchCategory = 'section' | 'ability' | 'tag' | 'effect' | 'attribute' | 'combo';

interface SearchResult {
  id: string;
  label: string;
  category: SearchCategory;
  tab: string;
  sectionId: string;
  color: string;
}

const CATEGORY_LABELS: Record<SearchCategory, string> = {
  section: 'Section',
  ability: 'Ability',
  tag: 'Tag',
  effect: 'Effect',
  attribute: 'Attribute',
  combo: 'Combo',
};

/** Map a SectionId to its parent sub-tab */
function sectionToTab(sectionId: string): string {
  switch (sectionId) {
    case 'core': case 'loadout': return 'core';
    case 'abilities': case 'damage-calc': return 'abilities';
    case 'combos': return 'combos';
    case 'effects': case 'effects-timeline': return 'effects';
    case 'attributes': case 'tags': case 'tag-deps': case 'tag-audit': return 'tags';
    default: return 'core';
  }
}

function useSpellbookSearchIndex(): SearchResult[] {
  const data = useSpellbookData();

  return useMemo(() => {
    const results: SearchResult[] = [];
    const add = (id: string, label: string, category: SearchCategory, tab: string, sectionId: string, color: string) =>
      results.push({ id, label, category, tab, sectionId, color });

    // Sections
    for (const s of SECTIONS) {
      const tab = sectionToTab(s.id);
      add(`sec-${s.id}`, s.label, 'section', tab, s.id, s.color);
      for (const f of s.featureNames) {
        add(`feat-${f}`, f, 'section', tab, s.id, s.color);
      }
    }

    // Tag detail map
    for (const [key, detail] of Object.entries(data.TAG_DETAIL_MAP)) {
      const tab = key.startsWith('Ability') ? 'abilities' : 'tags';
      const section = key.startsWith('Ability') ? 'abilities' : key.startsWith('Input') ? 'tags' : key.startsWith('Damage') ? 'effects' : 'tags';
      add(`tag-${key}`, key, 'tag', tab === 'abilities' ? 'abilities' : 'tags', section, detail.color);
    }

    // Tag tree nodes (flatten)
    const flattenTags = (nodes: { name: string; children?: { name: string; children?: unknown[] }[] }[]) => {
      for (const node of nodes) {
        add(`tree-${node.name}`, node.name, 'tag', 'tags', 'tags', MODULE_COLORS.content);
        if (node.children) flattenTags(node.children as typeof nodes);
      }
    };
    flattenTags(data.TAG_TREE);

    // Abilities from radar
    for (const ab of data.ABILITY_RADAR_DATA) {
      add(`radar-${ab.name}`, ab.name, 'ability', 'abilities', 'abilities', ab.color);
    }

    // Cooldown abilities
    for (const ab of data.COOLDOWN_ABILITIES) {
      add(`cd-${ab.name}`, ab.name, 'ability', 'abilities', 'abilities', ab.color);
    }

    // Combo abilities
    for (const ab of COMBO_ABILITIES) {
      add(`combo-${ab.id}`, ab.name, 'combo', 'combos', 'combos', ab.color);
    }

    // Core + Derived attributes
    for (const attr of data.CORE_ATTRIBUTES) {
      add(`attr-core-${attr}`, attr, 'attribute', 'tags', 'attributes', ACCENT_EMERALD_DARK);
    }
    for (const attr of data.DERIVED_ATTRIBUTES) {
      add(`attr-derived-${attr}`, attr, 'attribute', 'tags', 'attributes', ACCENT_EMERALD_DARK);
    }

    // Effects
    for (const eff of EFFECT_TYPES) {
      add(`eff-${eff.name}`, eff.name, 'effect', 'effects', 'effects', eff.color);
    }

    // Tag dep nodes
    for (const node of data.TAG_DEP_NODES) {
      add(`dep-${node.id}`, node.label, 'tag', 'tags', 'tag-deps', node.color);
    }

    // De-duplicate by id
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [data]);
}

const MAX_RESULTS = 20;

interface SpellbookSearchProps {
  onNavigate: (tab: string, sectionId: string) => void;
}

export function SpellbookSearch({ onNavigate }: SpellbookSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const index = useSpellbookSearchIndex();

  const filtered = useMemo(() => {
    if (!query.trim()) return index.slice(0, MAX_RESULTS);
    const q = query.toLowerCase().trim();
    const terms = q.split(/\s+/);
    return index
      .filter(r => terms.every(t => r.label.toLowerCase().includes(t) || r.category.includes(t)))
      .slice(0, MAX_RESULTS);
  }, [query, index]);

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

  // Focus input on open
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

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

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

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
          setOpen(false);
        }
        break;
      case 'Escape':
        setOpen(false);
        break;
    }
  }, [filtered, selectedIdx, onNavigate]);

  const handleSelect = useCallback((r: SearchResult) => {
    onNavigate(r.tab, r.sectionId);
    setOpen(false);
  }, [onNavigate]);

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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
            onClick={() => setOpen(false)}
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
              <div ref={listRef} className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-text-muted">
                    No results for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  filtered.map((r, i) => (
                    <button
                      key={r.id}
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
        )}
      </AnimatePresence>
    </>
  );
}

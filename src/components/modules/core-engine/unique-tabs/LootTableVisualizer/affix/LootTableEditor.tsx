'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { SlidersHorizontal, Upload, Download, Copy, CheckCircle2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_CYAN, ACCENT_EMERALD,
  OPACITY_8, OPACITY_20, OPACITY_30,
  STATUS_SUCCESS, STATUS_ERROR, STATUS_MUTED,
  withOpacity, OPACITY_80, OPACITY_12,
} from '@/lib/chart-colors';
import { ACCENT, EXPANDED_ENTRIES, LOOT_SOURCES } from '../data';
import type { LootEditorEntryExpanded, LootSource, UE5LootTableJson } from '../data';
import { parseUE5LootTable, generateUE5LootTableJson, generateUE5LootTableCpp } from '../codegen';
import { BlueprintPanel, SectionHeader } from '../design';

const PAGE_SIZE = 20;

const SOURCE_LABELS: Record<LootSource, string> = {
  enemy: 'Enemy Drops',
  chest: 'Chest / Container',
  quest: 'Quest Rewards',
  crafting: 'Crafting Materials',
};

export function LootTableEditor() {
  const [editorEntries, setEditorEntries] = useState<LootEditorEntryExpanded[]>(EXPANDED_ENTRIES);
  const [editorHistory, setEditorHistory] = useState<LootEditorEntryExpanded[][]>([EXPANDED_ENTRIES]);
  const [showEditorJson, setShowEditorJson] = useState(false);
  const [nothingWeight, setNothingWeight] = useState(0);
  const [importSource, setImportSource] = useState<string | null>(null);
  const [showReExport, setShowReExport] = useState<'json' | 'cpp' | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedReExport, setCopiedReExport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search + pagination + source grouping
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<LootSource | 'all'>('all');
  const [page, setPage] = useState(0);

  const editorTotalWeight = useMemo(() => editorEntries.reduce((s, e) => s + e.weight, 0), [editorEntries]);

  const filteredEntries = useMemo(() => {
    let entries = editorEntries;
    if (sourceFilter !== 'all') {
      entries = entries.filter(e => e.source === sourceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(e => e.name.toLowerCase().includes(q) || e.rarity.toLowerCase().includes(q));
    }
    return entries;
  }, [editorEntries, sourceFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedEntries = filteredEntries.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Group paged entries by source for display
  const groupedEntries = useMemo(() => {
    if (sourceFilter !== 'all') return [{ source: sourceFilter, entries: pagedEntries }];
    const groups = new Map<LootSource, LootEditorEntryExpanded[]>();
    for (const e of pagedEntries) {
      const arr = groups.get(e.source);
      if (arr) arr.push(e);
      else groups.set(e.source, [e]);
    }
    return Array.from(groups.entries()).map(([source, entries]) => ({ source, entries }));
  }, [pagedEntries, sourceFilter]);

  const updateEditorWeight = useCallback((id: string, weight: number) => {
    setEditorEntries((prev) => {
      const next = prev.map((e) => e.id === id ? { ...e, weight } : e);
      setEditorHistory((h) => [...h, next]);
      return next;
    });
  }, []);

  const addEditorEntry = useCallback(() => {
    const id = `e${Date.now()}`;
    setEditorEntries((prev) => {
      const next: LootEditorEntryExpanded[] = [...prev, { id, name: 'New Item', weight: 0, rarity: 'Common', color: STATUS_MUTED, source: 'enemy' }];
      setEditorHistory((h) => [...h, next]);
      return next;
    });
  }, []);

  const removeEditorEntry = useCallback((id: string) => {
    setEditorEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      setEditorHistory((h) => [...h, next]);
      return next;
    });
  }, []);

  const undoEditor = useCallback(() => {
    if (editorHistory.length > 1) {
      const newHistory = editorHistory.slice(0, -1);
      setEditorHistory(newHistory);
      setEditorEntries(newHistory[newHistory.length - 1]);
    }
  }, [editorHistory]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string) as UE5LootTableJson;
        const { entries, nothingWeight: nw } = parseUE5LootTable(json);
        if (entries.length === 0) {
          setImportError('No loot entries found in file. Expected { Entries: [...] } format.');
          return;
        }
        const expanded: LootEditorEntryExpanded[] = entries.map(ent => ({ ...ent, source: 'enemy' as LootSource }));
        setEditorEntries(expanded);
        setEditorHistory([expanded]);
        setNothingWeight(nw);
        setImportSource(file.name);
        setImportError(null);
        setShowEditorJson(false);
        setShowReExport(null);
        setPage(0);
      } catch {
        setImportError('Failed to parse JSON. Ensure the file is a valid UE5 loot table export.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleCopyReExport = useCallback((format: 'json' | 'cpp') => {
    const text = format === 'json'
      ? generateUE5LootTableJson(editorEntries, nothingWeight)
      : generateUE5LootTableCpp(editorEntries, nothingWeight);
    navigator.clipboard.writeText(text);
    setCopiedReExport(true);
    setTimeout(() => setCopiedReExport(false), 2000);
  }, [editorEntries, nothingWeight]);

  return (
    <BlueprintPanel className="p-3">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <SectionHeader icon={SlidersHorizontal} label="Loot Table Editor" color={ACCENT} />
        <span className="text-2xs font-mono text-text-muted">{editorEntries.length} entries</span>
        {importSource && (
          <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_8), color: STATUS_SUCCESS, border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_30)}` }}>
            UE5: {importSource}
          </span>
        )}
        <div className="flex gap-1 ml-auto flex-wrap">
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 flex items-center gap-1 cursor-pointer" style={{ borderColor: withOpacity(ACCENT_CYAN, OPACITY_30), color: ACCENT_CYAN }}>
            <Upload className="w-3 h-3" /> Import UE5
          </button>
          <button onClick={() => setShowReExport(showReExport === 'json' ? null : 'json')} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 flex items-center gap-1 cursor-pointer" style={{ borderColor: withOpacity(ACCENT_EMERALD, OPACITY_30), color: ACCENT_EMERALD }}>
            <Download className="w-3 h-3" /> Re-export
          </button>
          <button onClick={undoEditor} disabled={editorHistory.length <= 1} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 disabled:opacity-40 cursor-pointer" style={{ borderColor: withOpacity(ACCENT, OPACITY_30), color: ACCENT }}>Undo</button>
          <button onClick={addEditorEntry} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 cursor-pointer" style={{ borderColor: withOpacity(ACCENT, OPACITY_30), color: ACCENT }}>+ Add</button>
          <button onClick={() => setShowEditorJson((v) => !v)} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 cursor-pointer" style={{ borderColor: withOpacity(ACCENT, OPACITY_30), color: ACCENT }}>{showEditorJson ? 'Hide' : 'Export'} JSON</button>
        </div>
      </div>

      {/* Search + source filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
            placeholder="Search items..."
            className="w-full pl-7 pr-2 py-1 rounded text-2xs font-mono bg-surface-deep/50 border border-border/40 text-text focus:outline-none focus:ring-1 focus:ring-current/50"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => { setSourceFilter('all'); setPage(0); }}
            className="text-2xs font-mono px-2 py-1 rounded border transition-all cursor-pointer"
            style={{
              borderColor: sourceFilter === 'all' ? ACCENT : withOpacity(ACCENT, OPACITY_30),
              backgroundColor: sourceFilter === 'all' ? withOpacity(ACCENT, OPACITY_12) : 'transparent',
              color: sourceFilter === 'all' ? ACCENT : 'var(--text-muted)',
            }}
          >
            All
          </button>
          {LOOT_SOURCES.map(src => (
            <button
              key={src}
              onClick={() => { setSourceFilter(src); setPage(0); }}
              className="text-2xs font-mono px-2 py-1 rounded border transition-all capitalize cursor-pointer"
              style={{
                borderColor: sourceFilter === src ? ACCENT : withOpacity(ACCENT, OPACITY_30),
                backgroundColor: sourceFilter === src ? withOpacity(ACCENT, OPACITY_12) : 'transparent',
                color: sourceFilter === src ? ACCENT : 'var(--text-muted)',
              }}
            >
              {src}
            </button>
          ))}
        </div>
      </div>

      {importError && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1 rounded text-2xs font-mono" style={{ backgroundColor: withOpacity(STATUS_ERROR, OPACITY_8), color: STATUS_ERROR, border: `1px solid ${withOpacity(STATUS_ERROR, OPACITY_30)}` }}>{importError}</div>
      )}
      {nothingWeight > 0 && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1 rounded text-2xs font-mono" style={{ backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_8), color: ACCENT_CYAN, border: `1px solid ${withOpacity(ACCENT_CYAN, OPACITY_30)}` }}>
          NothingWeight: {nothingWeight.toFixed(1)} &mdash; {((nothingWeight / (editorTotalWeight + nothingWeight)) * 100).toFixed(1)}% chance of no drop
        </div>
      )}

      {/* Grouped entries */}
      <div className="space-y-3 mb-3">
        {groupedEntries.map(({ source, entries }) => (
          <div key={source}>
            {sourceFilter === 'all' && (
              <div className="text-2xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5 sticky top-0 bg-surface/80 py-0.5 backdrop-blur-sm">
                {SOURCE_LABELS[source]} ({entries.length})
              </div>
            )}
            {entries.map((entry) => (
              <div key={entry.id} className="mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-2xs text-text w-28 truncate" title={entry.name}>{entry.name}</span>
                  <input type="range" min={0} max={100} value={entry.weight} onChange={(e) => updateEditorWeight(entry.id, Number(e.target.value))} className="flex-1 h-1 accent-orange-500" />
                  <span className="text-2xs font-mono w-8 text-right" style={{ color: entry.color }}>{entry.weight}%</span>
                  <span className="text-2xs font-mono w-14 text-right text-text-muted">({editorTotalWeight > 0 ? ((entry.weight / editorTotalWeight) * 100).toFixed(1) : '0.0'}%)</span>
                  <button onClick={() => removeEditorEntry(entry.id)} className="text-2xs text-text-muted transition-colors px-1 cursor-pointer" onMouseEnter={e => (e.currentTarget.style.color = STATUS_ERROR)} onMouseLeave={e => (e.currentTarget.style.color = '')}>x</button>
                </div>
                {(entry.minQuantity !== undefined || entry.maxRarity !== undefined) && (
                  <div className="flex items-center gap-3 ml-4 mt-0.5">
                    <span className="text-2xs text-text-muted font-mono">Qty {entry.minQuantity ?? 1}&ndash;{entry.maxQuantity ?? 1}</span>
                    <span className="text-2xs text-text-muted font-mono">Rarity {entry.minRarity ?? 'Common'}&ndash;{entry.maxRarity ?? 'Legendary'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        {filteredEntries.length === 0 && (
          <p className="text-2xs text-text-muted italic text-center py-4">No items match your search.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mb-3">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="p-1 rounded border border-border/30 disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-text-muted" />
          </button>
          <span className="text-2xs font-mono text-text-muted">
            Page {safePage + 1} / {totalPages} ({filteredEntries.length} items)
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="p-1 rounded border border-border/30 disabled:opacity-30 cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
      )}

      {/* Live preview bar */}
      {editorTotalWeight > 0 && (
        <div className="flex h-4 rounded overflow-hidden w-full mb-2">
          {editorEntries.map((entry) => (
            <div key={entry.id} title={`${entry.name}: ${((entry.weight / editorTotalWeight) * 100).toFixed(1)}%`} style={{ width: `${(entry.weight / editorTotalWeight) * 100}%`, backgroundColor: entry.color }} />
          ))}
        </div>
      )}
      {/* Export JSON */}
      <AnimatePresence>
        {showEditorJson && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <pre className="text-2xs font-mono text-text-muted bg-surface-deep p-2 rounded border border-border/30 overflow-x-auto max-h-40">
              {JSON.stringify(editorEntries.map((e) => ({ name: e.name, weight: e.weight, rarity: e.rarity, source: e.source })), null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
      {/* UE5 Re-export panel */}
      <AnimatePresence>
        {showReExport && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: withOpacity(ACCENT_EMERALD, OPACITY_30) }}>
              <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: withOpacity(ACCENT_EMERALD, OPACITY_8) }}>
                <div className="flex items-center gap-2">
                  <Download className="w-3 h-3" style={{ color: ACCENT_EMERALD }} />
                  <span className="text-2xs font-semibold" style={{ color: ACCENT_EMERALD }}>UE5 Re-export</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowReExport('json')} className="text-2xs font-mono px-2 py-0.5 rounded transition-all cursor-pointer" style={{ backgroundColor: showReExport === 'json' ? withOpacity(ACCENT_EMERALD, OPACITY_20) : 'transparent', color: ACCENT_EMERALD }}>JSON</button>
                  <button onClick={() => setShowReExport('cpp')} className="text-2xs font-mono px-2 py-0.5 rounded transition-all cursor-pointer" style={{ backgroundColor: showReExport === 'cpp' ? withOpacity(ACCENT_EMERALD, OPACITY_20) : 'transparent', color: ACCENT_EMERALD }}>C++</button>
                  <button onClick={() => handleCopyReExport(showReExport)} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 flex items-center gap-1 cursor-pointer" style={{ borderColor: withOpacity(ACCENT_EMERALD, OPACITY_30), color: ACCENT_EMERALD }}>
                    {copiedReExport ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedReExport ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <pre className="p-3 text-2xs font-mono leading-relaxed overflow-x-auto max-h-[300px] overflow-y-auto" style={{ color: withOpacity(ACCENT_EMERALD, OPACITY_80), backgroundColor: 'rgba(0,0,0,0.2)' }}>
                {showReExport === 'json'
                  ? generateUE5LootTableJson(editorEntries, nothingWeight)
                  : generateUE5LootTableCpp(editorEntries, nothingWeight)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BlueprintPanel>
  );
}

'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_CYAN,
  OPACITY_8, OPACITY_30,
  STATUS_ERROR, STATUS_MUTED,
  withOpacity,
} from '@/lib/chart-colors';
import { EXPANDED_ENTRIES } from '../_shared/data';
import type { LootEditorEntryExpanded, LootSource } from '../_shared/data';
import { generateUE5LootTableJson, generateUE5LootTableCpp } from '../_shared/codegen';
import { BlueprintPanel } from '../_shared/design';
import { rarityColor } from '../_shared/rarityBadge';
import { LOOT_TABLE_EDITOR_PAGE_SIZE } from './loot-table-editor-constants';
import { LootTableEditorToolbar } from './LootTableEditorToolbar';
import { LootTableSearchFilters } from './LootTableSearchFilters';
import { LootTableEntryList } from './LootTableEntryList';
import { LootTableReExportPanel } from './LootTableReExportPanel';
import { LootTablePagination } from './LootTablePagination';
import { useLootTableImport } from './useLootTableImport';

// Cap undo history so a long editing session can't grow memory without bound.
const MAX_EDITOR_HISTORY = 50;
function capHistory(h: LootEditorEntryExpanded[][]): LootEditorEntryExpanded[][] {
  return h.length > MAX_EDITOR_HISTORY ? h.slice(-MAX_EDITOR_HISTORY) : h;
}

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
  // Tracks the entry whose slider is being dragged, to coalesce a continuous drag into
  // a single undo step instead of one full-array snapshot per tick.
  const lastWeightEditIdRef = useRef<string | null>(null);

  // Search + pagination + source grouping
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<LootSource | 'all'>('all');
  const [page, setPage] = useState(0);

  const editorTotalWeight = useMemo(() => editorEntries.reduce((s, e) => s + e.weight, 0), [editorEntries]);

  // Whole-table drop-rate distribution segments for the live-preview bar. Memoized so it only
  // recomputes when entries/weights actually change — not on unrelated state ticks (search,
  // pagination, source filter, JSON toggle, import flags). Stays unpaginated by design: the bar
  // visualizes the entire table's drop-rate split, independent of the paged editable list above.
  const previewSegments = useMemo(() => {
    const denom = editorTotalWeight + nothingWeight;
    if (denom <= 0) return [];
    const segs = editorEntries.map((entry) => ({
      id: entry.id,
      pct: (entry.weight / denom) * 100,
      name: entry.name,
      color: rarityColor(entry.rarity),
    }));
    // Include the no-drop chance as its own neutral segment so the preview bar
    // reflects the true odds instead of always filling to 100% items.
    if (nothingWeight > 0) {
      segs.push({
        id: '__nothing__',
        pct: (nothingWeight / denom) * 100,
        name: 'No drop',
        color: STATUS_MUTED,
      });
    }
    return segs;
  }, [editorEntries, editorTotalWeight, nothingWeight]);

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

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / LOOT_TABLE_EDITOR_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedEntries = filteredEntries.slice(safePage * LOOT_TABLE_EDITOR_PAGE_SIZE, (safePage + 1) * LOOT_TABLE_EDITOR_PAGE_SIZE);

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

  // History pushes are done from the outer callback body (never nested inside a
  // setState updater, which must be a pure function of prev state) so a
  // double-invoked updater in Strict Mode / concurrent rendering can't double-fire
  // the coalesced undo-history logic.
  const updateEditorWeight = useCallback((id: string, weight: number) => {
    // Coalesce a continuous drag on the same slider: replace the last snapshot rather
    // than pushing one per tick (and keep history capped).
    const coalesce = lastWeightEditIdRef.current === id;
    lastWeightEditIdRef.current = id;
    const next = editorEntries.map((e) => e.id === id ? { ...e, weight } : e);
    setEditorEntries(next);
    setEditorHistory((h) => {
      const base = coalesce && h.length > 1 ? h.slice(0, -1) : h;
      return capHistory([...base, next]);
    });
  }, [editorEntries]);

  const addEditorEntry = useCallback(() => {
    // crypto.randomUUID() is collision-free even for two "+ Add" clicks within
    // the same millisecond. Raw Date.now() (1ms resolution) produced duplicate
    // ids on a rapid double-click, which cross-contaminated weight edits/deletes
    // because those match rows by id.
    const id = `e${crypto.randomUUID()}`;
    lastWeightEditIdRef.current = null; // a distinct edit boundary
    const next: LootEditorEntryExpanded[] = [...editorEntries, { id, name: 'New Item', weight: 0, rarity: 'Common', color: STATUS_MUTED, source: 'enemy' }];
    setEditorEntries(next);
    setEditorHistory((h) => capHistory([...h, next]));
  }, [editorEntries]);

  const removeEditorEntry = useCallback((id: string) => {
    lastWeightEditIdRef.current = null; // a distinct edit boundary
    const next = editorEntries.filter((e) => e.id !== id);
    setEditorEntries(next);
    setEditorHistory((h) => capHistory([...h, next]));
  }, [editorEntries]);

  const undoEditor = useCallback(() => {
    lastWeightEditIdRef.current = null; // a post-undo edit must not coalesce into the undone snapshot
    if (editorHistory.length > 1) {
      const newHistory = editorHistory.slice(0, -1);
      setEditorHistory(newHistory);
      setEditorEntries(newHistory[newHistory.length - 1]);
    }
  }, [editorHistory]);

  const handleImportFile = useLootTableImport({
    setEditorEntries, setEditorHistory, setNothingWeight,
    setImportSource, setImportError,
    setShowEditorJson, setShowReExport, setPage,
  });

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
      <LootTableEditorToolbar
        entryCount={editorEntries.length}
        importSource={importSource}
        fileInputRef={fileInputRef}
        onImportFile={handleImportFile}
        showReExport={showReExport}
        setShowReExport={setShowReExport}
        showEditorJson={showEditorJson}
        setShowEditorJson={setShowEditorJson}
        undoDisabled={editorHistory.length <= 1}
        onUndo={undoEditor}
        onAddEntry={addEditorEntry}
      />

      <LootTableSearchFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        setPage={setPage}
      />

      {importError && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1 rounded text-2xs font-mono" style={{ backgroundColor: withOpacity(STATUS_ERROR, OPACITY_8), color: STATUS_ERROR, border: `1px solid ${withOpacity(STATUS_ERROR, OPACITY_30)}` }}>{importError}</div>
      )}
      {nothingWeight > 0 && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1 rounded text-2xs font-mono" style={{ backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_8), color: ACCENT_CYAN, border: `1px solid ${withOpacity(ACCENT_CYAN, OPACITY_30)}` }}>
          NothingWeight: {nothingWeight.toFixed(1)} &mdash; {((nothingWeight / (editorTotalWeight + nothingWeight)) * 100).toFixed(1)}% chance of no drop
        </div>
      )}

      <LootTableEntryList
        groupedEntries={groupedEntries}
        sourceFilter={sourceFilter}
        editorTotalWeight={editorTotalWeight}
        filteredEntries={filteredEntries}
        onUpdateWeight={updateEditorWeight}
        onRemoveEntry={removeEditorEntry}
      />

      <LootTablePagination
        safePage={safePage}
        totalPages={totalPages}
        totalCount={filteredEntries.length}
        setPage={setPage}
      />

      {/* Live preview bar */}
      {previewSegments.length > 0 && (
        <div className="flex h-4 rounded overflow-hidden w-full mb-2">
          {previewSegments.map((seg) => (
            <div key={seg.id} title={`${seg.name}: ${seg.pct.toFixed(1)}%`} style={{ width: `${seg.pct}%`, backgroundColor: seg.color }} />
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
      <LootTableReExportPanel
        showReExport={showReExport}
        setShowReExport={setShowReExport}
        editorEntries={editorEntries}
        nothingWeight={nothingWeight}
        copiedReExport={copiedReExport}
        onCopyReExport={handleCopyReExport}
      />
    </BlueprintPanel>
  );
}

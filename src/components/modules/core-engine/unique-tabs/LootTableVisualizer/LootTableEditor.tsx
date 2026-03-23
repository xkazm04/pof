'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { SlidersHorizontal, Upload, Download, Copy, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_CYAN, ACCENT_EMERALD,
  OPACITY_8, OPACITY_20, OPACITY_30,
  STATUS_SUCCESS, STATUS_ERROR, STATUS_MUTED,
} from '@/lib/chart-colors';
import { ACCENT, DEFAULT_EDITOR_ENTRIES } from './data';
import type { LootEditorEntry, UE5LootTableJson } from './data';
import { parseUE5LootTable, generateUE5LootTableJson, generateUE5LootTableCpp } from './codegen';
import { BlueprintPanel, SectionHeader } from './design';

export function LootTableEditor() {
  const [editorEntries, setEditorEntries] = useState<LootEditorEntry[]>(DEFAULT_EDITOR_ENTRIES);
  const [editorHistory, setEditorHistory] = useState<LootEditorEntry[][]>([DEFAULT_EDITOR_ENTRIES]);
  const [showEditorJson, setShowEditorJson] = useState(false);
  const [nothingWeight, setNothingWeight] = useState(0);
  const [importSource, setImportSource] = useState<string | null>(null);
  const [showReExport, setShowReExport] = useState<'json' | 'cpp' | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedReExport, setCopiedReExport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editorTotalWeight = useMemo(() => editorEntries.reduce((s, e) => s + e.weight, 0), [editorEntries]);

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
      const next = [...prev, { id, name: 'New Item', weight: 0, rarity: 'Common', color: STATUS_MUTED }];
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
        setEditorEntries(entries);
        setEditorHistory([entries]);
        setNothingWeight(nw);
        setImportSource(file.name);
        setImportError(null);
        setShowEditorJson(false);
        setShowReExport(null);
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
        {importSource && (
          <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_8}`, color: STATUS_SUCCESS, border: `1px solid ${STATUS_SUCCESS}${OPACITY_30}` }}>
            UE5: {importSource}
          </span>
        )}
        <div className="flex gap-1 ml-auto flex-wrap">
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 flex items-center gap-1" style={{ borderColor: `${ACCENT_CYAN}${OPACITY_30}`, color: ACCENT_CYAN }}>
            <Upload className="w-3 h-3" /> Import UE5
          </button>
          <button onClick={() => setShowReExport(showReExport === 'json' ? null : 'json')} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 flex items-center gap-1" style={{ borderColor: `${ACCENT_EMERALD}${OPACITY_30}`, color: ACCENT_EMERALD }}>
            <Download className="w-3 h-3" /> Re-export
          </button>
          <button onClick={undoEditor} disabled={editorHistory.length <= 1} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 disabled:opacity-40" style={{ borderColor: `${ACCENT}${OPACITY_30}`, color: ACCENT }}>Undo</button>
          <button onClick={addEditorEntry} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80" style={{ borderColor: `${ACCENT}${OPACITY_30}`, color: ACCENT }}>+ Add</button>
          <button onClick={() => setShowEditorJson((v) => !v)} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80" style={{ borderColor: `${ACCENT}${OPACITY_30}`, color: ACCENT }}>{showEditorJson ? 'Hide' : 'Export'} JSON</button>
        </div>
      </div>
      {importError && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1 rounded text-2xs font-mono" style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_8}`, color: STATUS_ERROR, border: `1px solid ${STATUS_ERROR}${OPACITY_30}` }}>{importError}</div>
      )}
      {nothingWeight > 0 && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1 rounded text-2xs font-mono" style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_8}`, color: ACCENT_CYAN, border: `1px solid ${ACCENT_CYAN}${OPACITY_30}` }}>
          NothingWeight: {nothingWeight.toFixed(1)} &mdash; {((nothingWeight / (editorTotalWeight + nothingWeight)) * 100).toFixed(1)}% chance of no drop
        </div>
      )}
      {/* Entries */}
      <div className="space-y-3 mb-3">
        {editorEntries.map((entry) => (
          <div key={entry.id}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-2xs text-text w-24 truncate" title={entry.name}>{entry.name}</span>
              <input type="range" min={0} max={100} value={entry.weight} onChange={(e) => updateEditorWeight(entry.id, Number(e.target.value))} className="flex-1 h-1 accent-orange-500" />
              <span className="text-2xs font-mono w-8 text-right" style={{ color: entry.color }}>{entry.weight}%</span>
              <span className="text-2xs font-mono w-14 text-right text-text-muted">({editorTotalWeight > 0 ? ((entry.weight / editorTotalWeight) * 100).toFixed(1) : '0.0'}%)</span>
              <button onClick={() => removeEditorEntry(entry.id)} className="text-2xs text-text-muted hover:text-red-400 transition-colors px-1">x</button>
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
              {JSON.stringify(editorEntries.map((e) => ({ name: e.name, weight: e.weight, rarity: e.rarity })), null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
      {/* UE5 Re-export panel */}
      <AnimatePresence>
        {showReExport && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: `${ACCENT_EMERALD}${OPACITY_30}` }}>
              <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: `${ACCENT_EMERALD}${OPACITY_8}` }}>
                <div className="flex items-center gap-2">
                  <Download className="w-3 h-3" style={{ color: ACCENT_EMERALD }} />
                  <span className="text-2xs font-semibold" style={{ color: ACCENT_EMERALD }}>UE5 Re-export</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowReExport('json')} className="text-2xs font-mono px-2 py-0.5 rounded transition-all" style={{ backgroundColor: showReExport === 'json' ? `${ACCENT_EMERALD}${OPACITY_20}` : 'transparent', color: ACCENT_EMERALD }}>JSON</button>
                  <button onClick={() => setShowReExport('cpp')} className="text-2xs font-mono px-2 py-0.5 rounded transition-all" style={{ backgroundColor: showReExport === 'cpp' ? `${ACCENT_EMERALD}${OPACITY_20}` : 'transparent', color: ACCENT_EMERALD }}>C++</button>
                  <button onClick={() => handleCopyReExport(showReExport)} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 flex items-center gap-1" style={{ borderColor: `${ACCENT_EMERALD}${OPACITY_30}`, color: ACCENT_EMERALD }}>
                    {copiedReExport ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedReExport ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <pre className="p-3 text-2xs font-mono leading-relaxed overflow-x-auto max-h-[300px] overflow-y-auto" style={{ color: `${ACCENT_EMERALD}cc`, backgroundColor: 'rgba(0,0,0,0.2)' }}>
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

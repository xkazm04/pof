'use client';

import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { SlidersHorizontal, Upload, Download } from 'lucide-react';
import {
  ACCENT_CYAN, ACCENT_EMERALD,
  OPACITY_8, OPACITY_30,
  STATUS_SUCCESS,
  withOpacity,
} from '@/lib/chart-colors';
import { ACCENT } from '../_shared/data';
import { SectionHeader } from '../_shared/design';

interface LootTableEditorToolbarProps {
  entryCount: number;
  importSource: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showReExport: 'json' | 'cpp' | null;
  setShowReExport: (v: 'json' | 'cpp' | null) => void;
  showEditorJson: boolean;
  setShowEditorJson: Dispatch<SetStateAction<boolean>>;
  undoDisabled: boolean;
  onUndo: () => void;
  onAddEntry: () => void;
}

export function LootTableEditorToolbar({
  entryCount, importSource, fileInputRef, onImportFile,
  showReExport, setShowReExport,
  showEditorJson, setShowEditorJson,
  undoDisabled, onUndo, onAddEntry,
}: LootTableEditorToolbarProps) {
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <SectionHeader icon={SlidersHorizontal} label="Loot Table Editor" color={ACCENT} />
      <span className="text-2xs font-mono text-text-muted">{entryCount} entries</span>
      {importSource && (
        <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_8), color: STATUS_SUCCESS, border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_30)}` }}>
          UE5: {importSource}
        </span>
      )}
      <div className="flex gap-1 ml-auto flex-wrap">
        <input ref={fileInputRef} type="file" accept=".json" onChange={onImportFile} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 flex items-center gap-1 cursor-pointer" style={{ borderColor: withOpacity(ACCENT_CYAN, OPACITY_30), color: ACCENT_CYAN }}>
          <Upload className="w-3 h-3" /> Import UE5
        </button>
        <button onClick={() => setShowReExport(showReExport === 'json' ? null : 'json')} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 flex items-center gap-1 cursor-pointer" style={{ borderColor: withOpacity(ACCENT_EMERALD, OPACITY_30), color: ACCENT_EMERALD }}>
          <Download className="w-3 h-3" /> Re-export
        </button>
        <button onClick={onUndo} disabled={undoDisabled} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 disabled:opacity-40 cursor-pointer" style={{ borderColor: withOpacity(ACCENT, OPACITY_30), color: ACCENT }}>Undo</button>
        <button onClick={onAddEntry} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 cursor-pointer" style={{ borderColor: withOpacity(ACCENT, OPACITY_30), color: ACCENT }}>+ Add</button>
        <button onClick={() => setShowEditorJson(v => !v)} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 cursor-pointer" style={{ borderColor: withOpacity(ACCENT, OPACITY_30), color: ACCENT }}>{showEditorJson ? 'Hide' : 'Export'} JSON</button>
      </div>
    </div>
  );
}

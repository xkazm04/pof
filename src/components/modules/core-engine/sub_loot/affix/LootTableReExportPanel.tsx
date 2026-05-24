'use client';

import { Download, Copy, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_EMERALD,
  OPACITY_8, OPACITY_20, OPACITY_30, OPACITY_80,
  withOpacity,
} from '@/lib/chart-colors';
import type { LootEditorEntryExpanded } from '../_shared/data';
import { generateUE5LootTableJson, generateUE5LootTableCpp } from '../_shared/codegen';

interface LootTableReExportPanelProps {
  showReExport: 'json' | 'cpp' | null;
  setShowReExport: (v: 'json' | 'cpp' | null) => void;
  editorEntries: LootEditorEntryExpanded[];
  nothingWeight: number;
  copiedReExport: boolean;
  onCopyReExport: (format: 'json' | 'cpp') => void;
}

export function LootTableReExportPanel({
  showReExport, setShowReExport,
  editorEntries, nothingWeight,
  copiedReExport, onCopyReExport,
}: LootTableReExportPanelProps) {
  return (
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
                <button onClick={() => onCopyReExport(showReExport)} className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 flex items-center gap-1 cursor-pointer" style={{ borderColor: withOpacity(ACCENT_EMERALD, OPACITY_30), color: ACCENT_EMERALD }}>
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
  );
}

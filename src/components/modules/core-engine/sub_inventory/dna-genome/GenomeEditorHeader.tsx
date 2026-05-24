'use client';

import { Dna, Plus, Upload, Barcode } from 'lucide-react';
import { ACCENT_CYAN, ACCENT_VIOLET, OPACITY_10, OPACITY_20,
  withOpacity, OPACITY_50, OPACITY_8,
} from '@/lib/chart-colors';
import { BlueprintPanel } from '@/components/modules/core-engine/unique-tabs/_design';
import { ACCENT } from './data';

interface Props {
  genomesCount: number;
  onToggleExport: () => void;
  onToggleImport: () => void;
  onAdd: () => void;
}

export function GenomeEditorHeader({ genomesCount, onToggleExport, onToggleImport, onAdd }: Props) {
  return (
    <BlueprintPanel color={ACCENT} className="p-3" noBrackets>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg relative overflow-hidden group">
            <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT }} />
            <Dna className="w-4 h-4 relative z-10" style={{ color: ACCENT, filter: `drop-shadow(0 0 4px ${withOpacity(ACCENT, OPACITY_50)})` }} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-text tracking-wide">Item DNA Genome System</span>
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
              <span className="font-medium" style={{ color: ACCENT }}>{genomesCount}</span>
              <span className="opacity-60"> genomes defined</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleExport}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
            style={{ backgroundColor: withOpacity(ACCENT_VIOLET, OPACITY_8), color: ACCENT_VIOLET, border: `1px solid ${withOpacity(ACCENT_VIOLET, OPACITY_20)}` }}
          >
            <Barcode className="w-3 h-3" /> Build Code
          </button>
          <button
            onClick={onToggleImport}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
            style={{ backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_8), color: ACCENT_CYAN, border: `1px solid ${withOpacity(ACCENT_CYAN, OPACITY_20)}` }}
          >
            <Upload className="w-3 h-3" /> Import
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
            style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
          >
            <Plus className="w-3 h-3" /> New Genome
          </button>
        </div>
      </div>
    </BlueprintPanel>
  );
}

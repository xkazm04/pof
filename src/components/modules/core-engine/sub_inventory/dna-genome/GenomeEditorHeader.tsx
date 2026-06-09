'use client';

import { Dna, Plus, Upload, Barcode } from 'lucide-react';
import { ACCENT_CYAN, ACCENT_VIOLET, OPACITY_10, OPACITY_20,
  withOpacity, OPACITY_8,
} from '@/lib/chart-colors';
import { UniqueTabHeader } from '@/components/modules/core-engine/unique-tabs/_design';
import { ACCENT } from './data';

interface Props {
  genomesCount: number;
  onToggleExport: () => void;
  onToggleImport: () => void;
  onAdd: () => void;
}

export function GenomeEditorHeader({ genomesCount, onToggleExport, onToggleImport, onAdd }: Props) {
  return (
    <UniqueTabHeader
      icon={Dna}
      title="Item DNA Genome System"
      color={ACCENT}
      subtitle={<><span className="font-medium" style={{ color: ACCENT }}>{genomesCount}</span> genomes defined</>}
      action={
        <>
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
        </>
      }
    />
  );
}

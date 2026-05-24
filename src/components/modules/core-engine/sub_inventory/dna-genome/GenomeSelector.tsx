'use client';

import { STATUS_SUCCESS, OPACITY_20,
  withOpacity, OPACITY_37, OPACITY_25,
} from '@/lib/chart-colors';
import type { ItemGenome } from '@/types/item-genome';

interface Props {
  genomes: ItemGenome[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function GenomeSelector({ genomes, selectedId, onSelect }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
      {genomes.map((g) => (
        <button
          key={g.id}
          onClick={() => onSelect(g.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
            g.id === selectedId ? 'ring-1 text-white' : 'text-text-muted hover:text-text'
          }`}
          style={{
            backgroundColor: g.id === selectedId ? `${g.color}${OPACITY_20}` : undefined,
            border: g.id === selectedId ? `1px solid ${withOpacity(g.color, OPACITY_37)}` : '1px solid transparent',
            boxShadow: g.id === selectedId ? `0 0 0 1px ${withOpacity(g.color, OPACITY_25)}` : undefined,
          }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
          {g.name}
          {g.evolution && g.evolution.tier > 0 && (
            <span className="text-xs font-mono" style={{ color: STATUS_SUCCESS }}>+{g.evolution.tier}</span>
          )}
        </button>
      ))}
    </div>
  );
}

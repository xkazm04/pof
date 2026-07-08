import { ChevronDown, ChevronUp } from 'lucide-react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import type { SortKey, SortDir } from './types';

export function SortableHeader({
  label, sortKey, activeKey, dir, onSort,
}: {
  label: string; sortKey: SortKey; activeKey: SortKey; dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === activeKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-0.5 text-2xs uppercase tracking-wider font-medium transition-colors group cursor-pointer select-none"
    >
      <span className={active ? '' : 'text-text-muted group-hover:text-text'} style={active ? { color: ACCENT_VIOLET } : undefined}>{label}</span>
      {active ? (
        dir === 'asc'
          ? <ChevronUp className="w-2.5 h-2.5" style={{ color: ACCENT_VIOLET }} />
          : <ChevronDown className="w-2.5 h-2.5" style={{ color: ACCENT_VIOLET }} />
      ) : (
        <ChevronDown className="w-2.5 h-2.5 text-text-muted/0 group-hover:text-text-muted/50" />
      )}
    </button>
  );
}

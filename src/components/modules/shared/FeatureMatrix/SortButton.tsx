import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { SortKey, SortDir } from './types';

export function SortButton({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onToggle,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onToggle: (key: SortKey) => void;
}) {
  const isActive = currentKey === key;
  const SortDirIcon = isActive ? (currentDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      onClick={() => onToggle(key)}
      className="flex items-center gap-1 px-1.5 py-1 rounded text-xs font-medium transition-all"
      style={{
        color: isActive ? 'var(--text)' : 'var(--text-muted)',
        backgroundColor: isActive ? 'var(--border)' : 'transparent',
      }}
    >
      {label}
      <SortDirIcon className="w-3 h-3" style={{ opacity: isActive ? 1 : 0.4 }} />
    </button>
  );
}

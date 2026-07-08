import { X } from 'lucide-react';

export function PresetChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-2xs font-medium transition-colors ${
        active
          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
          : 'bg-surface-2 text-text-muted border border-transparent hover:bg-surface hover:text-text'
      }`}
    >
      {label}
      {active && <X className="w-3 h-3" />}
    </button>
  );
}

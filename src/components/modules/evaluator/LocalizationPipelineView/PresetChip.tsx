import { X } from 'lucide-react';
import { FOCUS_RING_CLASS } from '@/lib/ui/focus-ring';

/**
 * Filter toggle chip. It is a two-state control, so it reports `aria-pressed`
 * rather than relying on colour alone — the × glyph is the matching visual cue
 * for the "on" state (colour is never the only signal).
 */
export function PresetChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? `Remove filter: ${label}` : `Filter by ${label}`}
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-2xs font-medium transition-colors ${FOCUS_RING_CLASS} ${
        active
          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
          : 'bg-surface-2 text-text-muted border border-transparent hover:bg-surface hover:text-text'
      }`}
    >
      {label}
      {active && <X aria-hidden="true" className="w-3 h-3" />}
    </button>
  );
}

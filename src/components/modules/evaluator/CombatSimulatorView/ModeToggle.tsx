import { Lightbulb, SlidersHorizontal } from 'lucide-react';
import { ACCENT_EMERALD_DARK } from '@/lib/chart-colors';
import type { ViewMode } from './constants';

// ── Mode toggle (Story ⇄ Advanced) ──────────────────────────────────────────

/** Mirrors the Prompt Evolution view's Simple/Advanced toggle. */
export function ModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const options: { id: ViewMode; label: string; icon: typeof Lightbulb; hint: string }[] = [
    { id: 'simple', label: 'Story', icon: Lightbulb, hint: 'Plain-language fight report' },
    { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal, hint: 'Full numeric breakdown' },
  ];
  return (
    <div
      className="inline-flex items-center rounded-md border border-border bg-surface p-0.5"
      role="group"
      aria-label="Result detail level"
    >
      {options.map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            title={opt.hint}
            className={`focus-ring flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              active ? 'text-white' : 'text-text-muted hover:text-text'
            }`}
            style={active ? { backgroundColor: ACCENT_EMERALD_DARK } : undefined}
          >
            <opt.icon className="w-3 h-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { Lightbulb, Code2 } from 'lucide-react';

/** Plain English ⇄ Technical toggle. Plain mode leads with a humanized story and
 *  hides callstacks/raw logs behind a disclosure; Technical restores the dense
 *  developer view. */
export function PlainModeToggle({ plain, onChange }: { plain: boolean; onChange: (v: boolean) => void }) {
  const options: { id: 'plain' | 'technical'; label: string; icon: typeof Lightbulb; hint: string }[] = [
    { id: 'plain', label: 'Plain English', icon: Lightbulb, hint: 'Humanized summaries — what happened & what to do' },
    { id: 'technical', label: 'Technical', icon: Code2, hint: 'Full callstacks, diagnoses, and raw logs' },
  ];
  return (
    <div
      className="inline-flex items-center rounded-md border border-border bg-surface p-0.5"
      role="group"
      aria-label="Crash detail level"
    >
      {options.map((opt) => {
        const active = (opt.id === 'plain') === plain;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id === 'plain')}
            aria-pressed={active}
            title={opt.hint}
            className={`focus-ring flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              active ? 'bg-status-red-medium text-red-400' : 'text-text-muted hover:text-text'
            }`}
          >
            <opt.icon className="w-3 h-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

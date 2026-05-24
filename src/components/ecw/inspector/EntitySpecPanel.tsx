'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface EntitySpecPanelProps {
  data: unknown;
}

/**
 * Collapsible JSON view of `entity.data`. Generic — every catalog gets this
 * pretty-printed dump for free. Per-catalog rich editors land in Phase 7 as
 * custom facets (e.g., stat-bar editor for spellbook, archetype radar for
 * bestiary).
 */
export function EntitySpecPanel({ data }: EntitySpecPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <section className="border-b border-border/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left text-text hover:bg-surface/30 focus-ring"
        aria-label="toggle Spec"
      >
        {open ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Spec</span>
      </button>
      {open && (
        <div className="px-4 pb-3">
          {data === undefined || data === null ? (
            <p className="text-xs text-text-muted/70 italic">No spec data.</p>
          ) : (
            <pre className="text-2xs font-mono leading-relaxed text-text whitespace-pre-wrap break-all bg-surface-deep/60 rounded p-2 max-h-72 overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}

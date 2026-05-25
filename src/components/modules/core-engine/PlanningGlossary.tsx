'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface GlossaryEntry {
  /** The technical term as it appears in code or older labels. */
  term: string;
  /** Plain-language synonym shown next to the term, when different. */
  plain?: string;
  /** One-sentence definition aimed at non-technical readers. */
  definition: string;
}

/**
 * Shared dictionary of planning terms surfaced across ImplementationPlan and
 * PlanMatrixMap. Keep entries to ONE sentence so they can also be used as
 * standalone tooltip content.
 */
export const PLANNING_GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Ready',
    definition: 'A task with no remaining blockers — you can start it right now.',
  },
  {
    term: 'Dependencies',
    plain: 'depends on',
    definition: 'Other tasks that must be finished first before this one can start.',
  },
  {
    term: 'Unblocks',
    definition: 'Tasks that become Ready once this one is finished.',
  },
  {
    term: 'Direct unblocks',
    definition: 'Tasks that immediately become Ready the moment this one is marked done.',
  },
  {
    term: 'Total unblocks',
    plain: 'transitive unblocks',
    definition: 'Every downstream task that eventually becomes Ready once this is done — direct ones plus their follow-ons.',
  },
  {
    term: 'No follow-ups',
    plain: 'leaf',
    definition: 'Nothing else in the plan waits on this task — finishing it does not free up anything new.',
  },
  {
    term: 'Critical path',
    definition: 'The longest chain of dependent tasks — delays here push the whole plan back the most.',
  },
  {
    term: 'Roadmap graph',
    plain: 'DAG',
    definition: 'The map of every task and the arrows showing which task depends on which.',
  },
  {
    term: 'Effort',
    definition: 'A rough estimate of how long the task will take to finish.',
  },
  {
    term: 'Impact',
    definition: 'A score showing how many other tasks this one frees up — higher means more leverage.',
  },
];

/** Quick lookup for tooltip content by term key. */
export function glossaryDefinition(term: string): string | undefined {
  const lower = term.toLowerCase();
  const hit = PLANNING_GLOSSARY.find(
    (e) => e.term.toLowerCase() === lower || e.plain?.toLowerCase() === lower,
  );
  return hit?.definition;
}

interface PlanningGlossaryProps {
  /** Anchor side for the popover. */
  align?: 'left' | 'right';
}

/**
 * Compact '?' button that opens a popover listing the planning vocabulary
 * (DAG, critical path, leaf, unblocks, effort, impact) with plain-language
 * definitions. Closes on outside click and Escape.
 */
export function PlanningGlossary({ align = 'right' }: PlanningGlossaryProps = {}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Show plain-language glossary for planning terms"
        title="What do these terms mean?"
        className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-border-bright"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Planning glossary"
          className={`absolute top-full mt-1.5 w-80 max-h-[60vh] overflow-y-auto bg-surface-deep border border-border-bright rounded-lg shadow-2xl z-50 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="sticky top-0 flex items-center justify-between px-3 py-2 border-b border-border bg-surface-deep">
            <span className="text-xs font-semibold text-text">Planning glossary</span>
            <button
              onClick={close}
              className="p-0.5 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              aria-label="Close glossary"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <dl className="px-3 py-2 space-y-2">
            {PLANNING_GLOSSARY.map((entry) => (
              <div key={entry.term} className="text-2xs leading-relaxed">
                <dt className="font-semibold text-text">
                  {entry.term}
                  {entry.plain && (
                    <span className="ml-1.5 font-normal text-text-muted">
                      (a.k.a. <span className="font-mono">{entry.plain}</span>)
                    </span>
                  )}
                </dt>
                <dd className="text-text-muted mt-0.5">{entry.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

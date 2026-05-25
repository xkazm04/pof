'use client';

import { useMemo } from 'react';
import { Flag, CheckCircle2 } from 'lucide-react';
import { useCatalogRoster } from '@/components/ecw/catalogs/useCatalogRoster';
import { milestoneProgress } from '@/lib/roadmap/milestones';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

/**
 * Mission Control roadmap (ECW Phase 10-MC round 2 — folds in the legacy
 * EvalRoadmap / CalendarRoadmap milestone ladder). Drives the canonical
 * milestone progression (vertical slice → release) from real catalog completion
 * (verified / total across all catalogs), so "how far to playable?" is honest.
 */
export function RoadmapCard() {
  const roster = useCatalogRoster();

  const milestones = useMemo(() => {
    const total = roster.reduce((s, r) => s + r.total, 0);
    const verified = roster.reduce((s, r) => s + r.verified, 0);
    const completionPct = total > 0 ? (verified / total) * 100 : 0;
    return milestoneProgress(completionPct);
  }, [roster]);

  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <Flag className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">Roadmap</h2>
      </header>

      <ul className="space-y-2">
        {milestones.map((m) => (
          <li key={m.id} className="space-y-1">
            <div className="flex items-center gap-2 text-2xs font-mono">
              {m.reached && <CheckCircle2 className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />}
              <span className={m.reached ? 'text-text' : 'text-text-muted'}>{m.name}</span>
              <span className="ml-auto text-text-muted/60">{m.progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface overflow-hidden">
              <div className="h-full" style={{ width: `${m.progress}%`, backgroundColor: STATUS_SUCCESS }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

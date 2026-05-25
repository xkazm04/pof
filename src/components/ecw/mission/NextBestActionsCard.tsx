'use client';

import { useEffect, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { computeProjectNBA, type NBARecommendation } from '@/lib/nba-engine';

const TOP_COUNT = 5;

/**
 * Mission Control Next Best Actions (ECW Phase 10-MC — the Phase 9 audit's
 * "critical path" panel). Fetches feature statuses, then runs the project-wide
 * NBA engine to surface the highest-leverage checklist items to do next across
 * all modules (dependency urgency + impact + readiness + pattern success).
 */
export function NextBestActionsCard() {
  const [recs, setRecs] = useState<NBARecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/feature-matrix/all-statuses')
      .then((r) => (r.ok ? r.json() : { data: { statuses: [] } }))
      .then((res) => {
        if (cancelled) return;
        const statuses = res?.data?.statuses ?? res?.statuses ?? [];
        const map = new Map<string, string>();
        for (const row of statuses) map.set(`${row.moduleId}::${row.featureName}`, row.status);
        setRecs(computeProjectNBA(map, TOP_COUNT));
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRecs(computeProjectNBA(undefined, TOP_COUNT));
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <Crosshair className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">Next Best Actions</h2>
      </header>

      {isLoading && recs.length === 0 ? (
        <p className="text-xs text-text-muted/60">Computing recommendations…</p>
      ) : recs.length === 0 ? (
        <p className="text-xs text-text-muted/60">
          Nothing recommended right now — every tracked checklist item is complete or blocked.
        </p>
      ) : (
        <ol className="space-y-2">
          {recs.map((r, i) => (
            <li key={`${r.moduleId}-${r.item.id}-${i}`} className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5 w-5 h-5 rounded bg-surface flex items-center justify-center text-2xs font-bold text-text">
                {r.score}
              </span>
              <div className="min-w-0">
                <div className="text-xs text-text truncate">{r.item.label}</div>
                <div className="text-xs text-text-muted/70 truncate">
                  <span className="text-text-muted">{r.moduleId}</span> · {r.reason}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

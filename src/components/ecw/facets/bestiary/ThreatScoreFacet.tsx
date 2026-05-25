'use client';

import { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { useCatalogEntities } from '@/stores/catalogStore';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { computeThreatScore, threatContributions, threatPercentile, type StatRow } from '@/lib/balance/threat-score';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

function statsOf(data: unknown): StatRow[] | null {
  if (!data || typeof data !== 'object') return null;
  const s = (data as { stats?: unknown }).stats;
  if (!Array.isArray(s) || s.length === 0) return null;
  return s as StatRow[];
}

/**
 * Threat Score facet (ECW Phase 10-B). Shows the archetype's threat score, its
 * percentile vs the bestiary roster (encounter-budgeting at a glance), and a
 * transparent per-stat contribution breakdown so the number is never a black box.
 */
export function ThreatScoreFacet({ entity }: Props) {
  const roster = useCatalogEntities('bestiary');

  const model = useMemo(() => {
    const stats = statsOf(entity.data);
    if (!stats) return null;
    const score = computeThreatScore(stats);
    const contributions = threatContributions(stats);
    const rosterScores = roster
      .map((e) => statsOf((e as StoredCatalogEntity).data))
      .filter((s): s is StatRow[] => s !== null)
      .map((s) => computeThreatScore(s));
    const percentile = threatPercentile(score, rosterScores.length > 0 ? rosterScores : [score]);
    const max = Math.max(...contributions.map((c) => c.contribution), 1);
    return { score, contributions, percentile, max };
  }, [entity.data, roster]);

  if (!model) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No stat data to score.</div>;
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Threat Score</span>
        <span className="ml-auto text-2xl font-bold text-text">{model.score}</span>
      </div>

      <div className="text-2xs font-mono text-text-muted">
        {model.percentile}th percentile across the bestiary roster
      </div>

      <div className="space-y-1">
        <div className="text-2xs font-mono uppercase tracking-wider text-text-muted/70">Contribution</div>
        {model.contributions.map((c) => (
          <div key={c.label} className="flex items-center gap-2 text-2xs font-mono">
            <span className="w-20 truncate text-text-muted">{c.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
              <div className="h-full bg-amber-500/70" style={{ width: `${(c.contribution / model.max) * 100}%` }} />
            </div>
            <span className="w-10 text-right text-text">{Math.round(c.contribution)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

registerFacet('bestiary', { id: 'threat', label: 'Threat', Component: ThreatScoreFacet });

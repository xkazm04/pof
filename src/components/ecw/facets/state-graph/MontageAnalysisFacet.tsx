'use client';

import { useMemo } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useCatalogEntities } from '@/stores/catalogStore';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { asMontage, montageMetrics, lintMontage, type MontageLike, type MontageFinding } from '@/lib/animation/montage-analysis';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

const ICON: Record<MontageFinding['severity'], typeof CheckCircle2> = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle };
const COLOR: Record<MontageFinding['severity'], string> = { ok: 'text-emerald-500', warn: 'text-amber-500', error: 'text-red-500' };

/**
 * Montage Analysis facet (ECW Phase 10-F). Shows duration + memory and runs the
 * same-category lint (memory outliers, missing root motion, long blend-in) read
 * live from the roster. The state-graph analogue of the Combat/Zone analysis facets.
 */
export function MontageAnalysisFacet({ entity }: Props) {
  const roster = useCatalogEntities('state-graph');

  const model = useMemo(() => {
    const montage = asMontage(entity.data);
    if (!montage) return null;
    const peers = roster
      .map((e) => asMontage((e as StoredCatalogEntity).data))
      .filter((m): m is MontageLike => m !== null);
    return { metrics: montageMetrics(montage), findings: lintMontage(montage, peers) };
  }, [entity.data, roster]);

  if (!model) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No montage data to analyse.</div>;
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Montage Analysis</span>
        <span className="ml-auto text-2xs font-mono text-text-muted">
          {model.metrics.durationSec.toFixed(2)}s · {model.metrics.memorySizeMB} MB
        </span>
      </div>

      <ul className="space-y-1.5">
        {model.findings.map((f, i) => {
          const Icon = ICON[f.severity];
          return (
            <li key={`${f.rule}-${i}`} className="flex items-start gap-2 text-xs">
              <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${COLOR[f.severity]}`} />
              <span className="text-text">{f.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

registerFacet('state-graph', { id: 'analysis', label: 'Analysis', Component: MontageAnalysisFacet });

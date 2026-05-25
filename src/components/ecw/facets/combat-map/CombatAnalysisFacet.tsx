'use client';

import { useMemo } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useCatalogEntities } from '@/stores/catalogStore';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { asCombo, comboMetrics, lintCombo, type ComboLike, type ComboFinding } from '@/lib/combat/combo-analysis';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

const ICON: Record<ComboFinding['severity'], typeof CheckCircle2> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
};
const COLOR: Record<ComboFinding['severity'], string> = {
  ok: 'text-emerald-500',
  warn: 'text-amber-500',
  error: 'text-red-500',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xs font-mono uppercase tracking-wider text-text-muted/70">{label}</span>
      <span className="text-sm font-semibold text-text">{value}</span>
    </div>
  );
}

/**
 * Combat Analysis facet (ECW Phase 10-C). Derives total damage, attack cadence,
 * and damage-per-hit from the combo, and runs a same-weapon lint (DPS outliers,
 * chain/hit consistency, long-commitment) read live from the roster. The
 * combat-map analogue of the Loot Economy / Bestiary Balance facets.
 */
export function CombatAnalysisFacet({ entity }: Props) {
  const roster = useCatalogEntities('combat-map');

  const model = useMemo(() => {
    const combo = asCombo(entity.data);
    if (!combo) return null;
    const peers = roster
      .map((e) => asCombo((e as StoredCatalogEntity).data))
      .filter((c): c is ComboLike => c !== null);
    return { metrics: comboMetrics(combo), findings: lintCombo(combo, peers) };
  }, [entity.data, roster]);

  if (!model) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No combo data to analyse.</div>;
  }

  const { metrics, findings } = model;

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Combat Analysis</span>
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
        <Stat label="DPS" value={`${metrics.dps}`} />
        <Stat label="Total damage" value={`${Math.round(metrics.totalDamage)}`} />
        <Stat label="Cadence" value={`${metrics.hitsPerSecond.toFixed(1)} hits/s`} />
        <Stat label="Damage / hit" value={`${Math.round(metrics.damagePerHit)}`} />
      </div>

      <ul className="space-y-1.5">
        {findings.map((f, i) => {
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

registerFacet('combat-map', { id: 'analysis', label: 'Analysis', Component: CombatAnalysisFacet });

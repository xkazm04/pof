'use client';

import { useEffect, useMemo, useState } from 'react';
import { GitCompare, ArrowUp, ArrowDown, Minus, Camera } from 'lucide-react';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { useEntityBaseline, useBaselineStore } from '@/stores/baselineStore';
import { computeThreatScore, type StatRow } from '@/lib/balance/threat-score';
import { threatDrift, computeStatDrift, driftDirection, type BalanceBaseline } from '@/lib/balance/baseline';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
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

function DriftIcon({ delta }: { delta: number }) {
  const dir = driftDirection(delta);
  if (dir === 'up') return <ArrowUp className="w-3.5 h-3.5" style={{ color: STATUS_ERROR }} />;
  if (dir === 'down') return <ArrowDown className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />;
  return <Minus className="w-3.5 h-3.5 text-text-muted" />;
}

/**
 * Balance Baseline facet (ECW Phase 10-B, idea 375a9f88). Captures the
 * archetype's current threat score + stats as a persisted baseline (the third
 * use of the persisted-store template — DB-backed via /api/balance-baseline),
 * then shows drift against it so unintended balance changes surface for review.
 */
export function BestiaryBaselineFacet({ entity }: Props) {
  const slot = useEntityBaseline(entity.catalogId, entity.id);
  const loadBaseline = useBaselineStore((s) => s.loadBaseline);
  const setBaseline = useBaselineStore((s) => s.setBaseline);
  const [saving, setSaving] = useState(false);

  const current = useMemo(() => {
    const stats = statsOf(entity.data);
    if (!stats) return null;
    return { stats, threatScore: computeThreatScore(stats) };
  }, [entity.data]);

  // Load the persisted baseline (or its absence) on entity open.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/balance-baseline?catalogId=${encodeURIComponent(entity.catalogId)}&entityId=${encodeURIComponent(entity.id)}`)
      .then((r) => r.json())
      .then((res: { success: boolean; data?: BalanceBaseline | null }) => {
        if (!cancelled && res.success) loadBaseline(entity.catalogId, entity.id, res.data ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entity.catalogId, entity.id, loadBaseline]);

  const capture = async () => {
    if (!current) return;
    setSaving(true);
    try {
      const res = await fetch('/api/balance-baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogId: entity.catalogId,
          entityId: entity.id,
          threatScore: current.threatScore,
          stats: current.stats,
        }),
      }).then((r) => r.json());
      if (res.success && res.data) setBaseline(entity.catalogId, entity.id, res.data);
    } finally {
      setSaving(false);
    }
  };

  if (!current) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No stat data to baseline.</div>;
  }

  const baseline = slot ?? null;
  const tDrift = baseline ? threatDrift(current.threatScore, baseline.threatScore) : null;
  const statDrift = baseline ? computeStatDrift(current.stats, baseline.stats) : [];

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <GitCompare className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Balance Baseline</span>
        <button
          onClick={capture}
          disabled={saving}
          className="focus-ring ml-auto flex items-center gap-1 px-2 py-1 rounded text-2xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50"
        >
          <Camera className="w-3 h-3" />
          <span>{saving ? 'Saving…' : baseline ? 'Recapture' : 'Capture baseline'}</span>
        </button>
      </div>

      {!baseline && (
        <p className="text-2xs text-text-muted/70">
          No baseline captured. Snapshot the current numbers (threat {current.threatScore}) to track drift over time.
        </p>
      )}

      {baseline && tDrift && (
        <>
          <div className="flex items-center gap-2 text-2xs font-mono">
            <span className="text-text-muted">Threat</span>
            <span className="text-text-muted/60">{baseline.threatScore}</span>
            <span className="text-text-muted/40">→</span>
            <span className="text-text font-semibold">{current.threatScore}</span>
            <span className="ml-auto flex items-center gap-1">
              <DriftIcon delta={tDrift.delta} />
              <span className="text-text">
                {tDrift.delta > 0 ? '+' : ''}{tDrift.delta}
                {tDrift.pct !== null ? ` (${tDrift.pct > 0 ? '+' : ''}${tDrift.pct}%)` : ''}
              </span>
            </span>
          </div>

          {baseline.capturedAt && (
            <div className="text-2xs font-mono text-text-muted/50">
              Baseline captured {new Date(baseline.capturedAt).toLocaleString()}
            </div>
          )}

          <div className="space-y-1">
            <div className="text-2xs font-mono uppercase tracking-wider text-text-muted/70">Stat drift</div>
            {statDrift.length === 0 ? (
              <div className="text-2xs font-mono text-text-muted/60">No stat changes since baseline.</div>
            ) : (
              statDrift.map((d) => (
                <div key={d.label} className="flex items-center gap-2 text-2xs font-mono">
                  <span className="w-20 truncate text-text-muted">{d.label}</span>
                  <span className="text-text-muted/60">{d.baseline}</span>
                  <span className="text-text-muted/40">→</span>
                  <span className="text-text">{d.current}</span>
                  <span className="ml-auto flex items-center gap-1">
                    <DriftIcon delta={d.delta} />
                    <span className="text-text">{d.delta > 0 ? '+' : ''}{d.delta}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

registerFacet('bestiary', { id: 'baseline', label: 'Baseline', Component: BestiaryBaselineFacet });

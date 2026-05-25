'use client';

import { useEffect, useState } from 'react';
import { GitCompare, ArrowUp, ArrowDown, Minus, Camera } from 'lucide-react';
import { useEntityBaseline, useBaselineStore } from '@/stores/baselineStore';
import { threatDrift, computeStatDrift, driftDirection, type BalanceBaseline } from '@/lib/balance/baseline';
import type { StatRow } from '@/lib/balance/threat-score';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';

interface Props {
  catalogId: string;
  entityId: string;
  /** Current snapshot to baseline against, or null when the entity has no data. */
  current: { score: number; stats: StatRow[] } | null;
  /** Header label, e.g. "Balance Baseline" / "EV Baseline". */
  title: string;
  /** Drift-row label for the score, e.g. "Threat" / "EV". */
  scoreLabel: string;
  /** Noun in the no-baseline hint, e.g. "threat" / "value". */
  scoreNoun: string;
  /** Header for the per-stat drift list, e.g. "Stat drift" / "Value drift". */
  breakdownLabel: string;
  /** Shown when `current` is null. */
  emptyHint: string;
}

function DriftIcon({ delta }: { delta: number }) {
  const dir = driftDirection(delta);
  if (dir === 'up') return <ArrowUp className="w-3.5 h-3.5" style={{ color: STATUS_ERROR }} />;
  if (dir === 'down') return <ArrowDown className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />;
  return <Minus className="w-3.5 h-3.5 text-text-muted" />;
}

/**
 * Shared persisted-baseline panel (ECW Phase 10). Captures a numeric score + a
 * stat breakdown as a DB-backed baseline (via /api/balance-baseline + baselineStore)
 * and renders drift against it. Domain-agnostic — bestiary passes threat score +
 * stats, loot passes EV + rarity contributions. The reusable core of the
 * persisted-store enhancement template.
 */
export function EntityBaselinePanel({
  catalogId,
  entityId,
  current,
  title,
  scoreLabel,
  scoreNoun,
  breakdownLabel,
  emptyHint,
}: Props) {
  const slot = useEntityBaseline(catalogId, entityId);
  const loadBaseline = useBaselineStore((s) => s.loadBaseline);
  const setBaseline = useBaselineStore((s) => s.setBaseline);
  const [saving, setSaving] = useState(false);

  // Load the persisted baseline (or its absence) on entity open.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/balance-baseline?catalogId=${encodeURIComponent(catalogId)}&entityId=${encodeURIComponent(entityId)}`)
      .then((r) => r.json())
      .then((res: { success: boolean; data?: BalanceBaseline | null }) => {
        if (!cancelled && res.success) loadBaseline(catalogId, entityId, res.data ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [catalogId, entityId, loadBaseline]);

  const capture = async () => {
    if (!current) return;
    setSaving(true);
    try {
      const res = await fetch('/api/balance-baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogId, entityId, threatScore: current.score, stats: current.stats }),
      }).then((r) => r.json());
      if (res.success && res.data) setBaseline(catalogId, entityId, res.data);
    } finally {
      setSaving(false);
    }
  };

  if (!current) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">{emptyHint}</div>;
  }

  const baseline = slot ?? null;
  const sDrift = baseline ? threatDrift(current.score, baseline.threatScore) : null;
  const statDrift = baseline ? computeStatDrift(current.stats, baseline.stats) : [];

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <GitCompare className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">{title}</span>
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
          No baseline captured. Snapshot the current numbers ({scoreNoun} {current.score}) to track drift over time.
        </p>
      )}

      {baseline && sDrift && (
        <>
          <div className="flex items-center gap-2 text-2xs font-mono">
            <span className="text-text-muted">{scoreLabel}</span>
            <span className="text-text-muted/60">{baseline.threatScore}</span>
            <span className="text-text-muted/40">→</span>
            <span className="text-text font-semibold">{current.score}</span>
            <span className="ml-auto flex items-center gap-1">
              <DriftIcon delta={sDrift.delta} />
              <span className="text-text">
                {sDrift.delta > 0 ? '+' : ''}{sDrift.delta}
                {sDrift.pct !== null ? ` (${sDrift.pct > 0 ? '+' : ''}${sDrift.pct}%)` : ''}
              </span>
            </span>
          </div>

          {baseline.capturedAt && (
            <div className="text-2xs font-mono text-text-muted/50">
              Baseline captured {new Date(baseline.capturedAt).toLocaleString()}
            </div>
          )}

          <div className="space-y-1">
            <div className="text-2xs font-mono uppercase tracking-wider text-text-muted/70">{breakdownLabel}</div>
            {statDrift.length === 0 ? (
              <div className="text-2xs font-mono text-text-muted/60">No changes since baseline.</div>
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

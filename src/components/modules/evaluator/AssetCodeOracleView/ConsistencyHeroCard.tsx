'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { KPICard } from '@/components/ui/KPICard';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { letterGrade, gradeBandLabel, gradeBandCaption } from '@/lib/consistency-grade';
import { STATUS_ERROR, STATUS_SUCCESS, STATUS_NEUTRAL, statusBg, statusBorder, successRateColor } from '@/lib/chart-colors';

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return <KPICard label={label} value={value} />;
}

/**
 * Hero card for the headline consistency metric: a 96px color-graded ring with
 * a large letter-grade centerpiece, the raw percentage, a qualitative band
 * label, a delta-vs-last-scan indicator, and a plain-language caption.
 */
export function ConsistencyHeroCard({
  score,
  delta,
}: {
  score: number;
  delta: { delta: number; sinceLabel: string } | null;
}) {
  const color = successRateColor(score);
  const grade = letterGrade(score);
  const band = gradeBandLabel(score);

  return (
    <SurfaceCard
      level={2}
      className="md:col-span-2 flex items-center gap-4 px-4 py-3"
    >
      <ScoreRing
        value={score}
        size={96}
        strokeWidth={8}
        color={color}
        labelClassName="leading-none"
        label={
          <span className="flex flex-col items-center leading-none">
            <span className="text-[2rem] font-extrabold" style={{ color }}>{grade}</span>
            <span className="mt-1 text-2xs font-semibold text-text-muted tabular-nums">{score}%</span>
          </span>
        }
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold">
            Consistency Score
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.5 text-2xs font-medium rounded border"
            style={{ color, backgroundColor: statusBg(color), borderColor: statusBorder(color) }}
          >
            {band}
          </span>
        </div>
        <DeltaIndicator delta={delta} />
        <p className="text-2xs text-text-muted leading-relaxed">{gradeBandCaption(score)}</p>
      </div>
    </SurfaceCard>
  );
}

/** Up/down/flat delta vs. the previous scan, e.g. "+3% since Tuesday". */
function DeltaIndicator({ delta }: { delta: { delta: number; sinceLabel: string } | null }) {
  if (!delta) {
    return <p className="text-2xs text-text-muted">First scan recorded — re-run to track change over time.</p>;
  }

  const { delta: d, sinceLabel } = delta;
  const flat = d === 0;
  const positive = d > 0;
  const color = flat ? STATUS_NEUTRAL : positive ? STATUS_SUCCESS : STATUS_ERROR;
  const Icon = flat ? Minus : positive ? ArrowUp : ArrowDown;
  const sign = positive ? '+' : d < 0 ? '−' : '';

  return (
    <div className="flex items-center gap-1 text-xs font-medium" style={{ color }}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="tabular-nums">{sign}{Math.abs(d)}%</span>
      <span className="text-text-muted font-normal">{sinceLabel}</span>
    </div>
  );
}

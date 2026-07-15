'use client';

import { MeterBar } from '@/components/ui/MeterBar';
import { qualityColor } from '@/lib/chart-colors';

/**
 * DimensionScoreBars — the shared renderer for a judge verdict's per-dimension 0-100 craft
 * scores (Quality Program WS2). One labeled {@link MeterBar} per rubric dimension, fill and
 * value tinted by {@link qualityColor}. Consumed by BOTH the /status EvidenceModal (lab theme)
 * and the Evaluator Verdicts detail modal (app theme) so the two never drift.
 *
 * `variant` switches only the label/heading typography for the two surfaces; the bars themselves
 * are identical. Renders nothing when there are no dimensions.
 */
export function DimensionScoreBars({
  dimensions,
  variant = 'app',
  heading = 'Dimension scores',
}: {
  dimensions: Record<string, number>;
  variant?: 'app' | 'lab';
  heading?: string;
}) {
  const entries = Object.entries(dimensions);
  if (entries.length === 0) return null;

  const lab = variant === 'lab';
  const headingStyle = lab
    ? { fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)' }
    : undefined;
  const labelStyle = lab ? { color: 'var(--lab-text)' } : undefined;

  return (
    <section className="space-y-2" data-testid="verdict-dimensions">
      <h3
        className={lab ? 'text-2xs uppercase tracking-wider' : 'text-2xs uppercase tracking-wider text-text-muted font-medium'}
        style={headingStyle}
      >
        {heading}
      </h3>
      <div className="space-y-1.5">
        {entries.map(([key, score]) => (
          <div key={key} className="grid grid-cols-[8.5rem_1fr_2.25rem] items-center gap-2">
            <span className={lab ? 'text-xs truncate' : 'text-xs text-text truncate'} style={labelStyle}>{key}</span>
            <MeterBar value={score} color={qualityColor} height={6} ariaLabel={`${key} score`} valueText={`${score} of 100`} />
            <span className="text-xs tabular-nums text-right" style={{ color: qualityColor(score) }}>{score}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

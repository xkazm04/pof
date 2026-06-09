'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { lookupMetric } from '@/lib/combat/metric-glossary';

interface MetricLabelProps {
  /** Metric id (usually the raw `CombatSummary` / `TuningOverrides` field name). */
  metricId: string;
  /** Display text (defaults to the glossary term). */
  label?: ReactNode;
  /** Classes applied to the inline trigger (use for sizing/color of the label text). */
  className?: string;
  /** Hide the trailing info dot in very tight rows — the term stays tooltipped. */
  showIcon?: boolean;
  /** Side the popover opens on; `bottom` suits labels near the top of the page. */
  placement?: 'top' | 'bottom';
}

/**
 * Inline, accessible decoder for a single combat metric. Renders the term with
 * a small 12px Info dot (60% opacity) and a hover/tap/focus popover giving a
 * one-sentence plain-English definition plus a worked example — pulled from the
 * shared {@link import('@/lib/combat/metric-glossary').lookupMetric metric glossary}
 * so every panel (KPI cards, mini-stats, the heatmap, the tuning sliders) reads
 * the same source of truth.
 *
 * Unknown ids render the label unchanged (fail-soft — never blocks reading the
 * screen). Mirrors {@link import('./StatTerm').StatTerm} but is keyed by metric
 * id and shows a worked example; keyboard-accessible (focus + Escape) and
 * touch-friendly (tap focuses the trigger) via the underlying `Tooltip`.
 */
export function MetricLabel({
  metricId,
  label,
  className = '',
  showIcon = true,
  placement = 'top',
}: MetricLabelProps) {
  const entry = lookupMetric(metricId);
  const text = label ?? entry?.term ?? metricId;

  // Fail-soft: no glossary entry → plain text, no affordance.
  if (!entry) {
    return <span className={className}>{text}</span>;
  }

  const content = (
    <span className="block">
      <span className="block text-text">{entry.plain}</span>
      <span className="mt-1 block text-text-muted">
        <span className="font-semibold text-text">Example: </span>
        {entry.example}
      </span>
    </span>
  );

  return (
    <Tooltip content={content} multiline placement={placement}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 cursor-help rounded-sm focus-ring align-baseline ${className}`}
        // Full plain-language explanation for screen readers regardless of hover state.
        aria-label={`${entry.term}: ${entry.plain} For example, ${entry.example}`}
      >
        <span>{text}</span>
        {showIcon && (
          <Info aria-hidden="true" className="w-3 h-3 shrink-0" style={{ opacity: 0.6 }} />
        )}
      </button>
    </Tooltip>
  );
}

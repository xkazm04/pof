'use client';

import { useMemo } from 'react';
import { AlertTriangle, Cpu, Layers } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL,
  OPACITY_15, OPACITY_25, withOpacity,
} from '@/lib/chart-colors';
import {
  estimateMaterialBudget, SAMPLER_HARD_LIMIT, SAMPLER_WARN_LIMIT, INSTRUCTION_WARN_THRESHOLD,
  type MaterialBudgetReport,
} from '@/lib/material-cost-estimator';
import { MeterBar } from '@/components/ui/MeterBar';
import type { SurfaceType, RenderFeature } from './MaterialParameterConfigurator';

/**
 * Visual mirror of the PostProcess GPUBreakdown panel for materials.
 * Reads the cost report from `estimateMaterialBudget` and renders:
 *   • a sampler-budget bar (n / 16, green→amber→red as it climbs)
 *   • an instruction-cost bar (×base, green→amber as features pile on)
 *   • a per-feature breakdown row
 *   • warning chips with the cheaper-swap suggestion the estimator emits
 */
export function MaterialBudgetBar({
  surfaceType, features,
}: { surfaceType: SurfaceType; features: RenderFeature[] }) {
  const report = useMemo(
    () => estimateMaterialBudget({ surfaceType, features }),
    [surfaceType, features],
  );
  return (
    <section aria-label="Material cost" className="rounded-lg border border-border/40 bg-surface-deep/40 p-3 space-y-3">
      <header className="flex items-center gap-2">
        <Cpu className="w-4 h-4 text-text-muted" />
        <h4 className="text-xs font-mono uppercase tracking-[0.15em] text-text">Shader Budget</h4>
        <span className="text-2xs text-text-muted">{report.shadingModel}</span>
      </header>

      <BudgetMeter
        icon={Layers}
        label="Samplers"
        valueLabel={`${report.samplers} / ${SAMPLER_HARD_LIMIT}`}
        value={report.samplers}
        max={SAMPLER_HARD_LIMIT}
        toneAt={(n) =>
          n > SAMPLER_HARD_LIMIT ? STATUS_ERROR
            : n >= SAMPLER_WARN_LIMIT ? STATUS_WARNING
              : STATUS_SUCCESS}
        breakdown={report.samplerBreakdown.map((b) => ({ label: b.source, amount: b.count, formatter: (n) => `${n}` }))}
      />

      <BudgetMeter
        icon={Cpu}
        label="Instructions"
        valueLabel={`${report.instructionScore.toFixed(2)}× metal base`}
        value={report.instructionScore}
        max={INSTRUCTION_WARN_THRESHOLD}
        toneAt={(n) => (n >= INSTRUCTION_WARN_THRESHOLD ? STATUS_WARNING : STATUS_SUCCESS)}
        breakdown={report.instructionBreakdown.map((b) => ({ label: b.source, amount: b.cost, formatter: (n) => `${n.toFixed(2)}×` }))}
      />

      {report.warnings.length > 0 && (
        <ul className="space-y-1" aria-label="Material cost warnings">
          {report.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 px-2 py-1.5 rounded text-2xs"
              style={{
                background: withOpacity(w.severity === 'error' ? STATUS_ERROR : STATUS_WARNING, OPACITY_15),
                border: `1px solid ${withOpacity(w.severity === 'error' ? STATUS_ERROR : STATUS_WARNING, OPACITY_25)}`,
              }}>
              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5"
                style={{ color: w.severity === 'error' ? STATUS_ERROR : STATUS_WARNING }} />
              <span className="min-w-0">
                <span className="block text-text">{w.message}</span>
                {w.suggestion && <span className="block text-text-muted">{w.suggestion}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface BudgetMeterProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  valueLabel: string;
  /** Raw measured value — NEVER pre-clamped; the meter owns the overflow story. */
  value: number;
  /** The real limit this value is graded against (UE5's sampler cap, the warn threshold). */
  max: number;
  toneAt: (value: number) => string;
  breakdown: Array<{ label: string; amount: number; formatter: (n: number) => string }>;
}

/**
 * One shader-budget row. The value reaches the bar unclamped: the callers used
 * to `Math.min(…, 1)` before handing it over, which cropped every overrun to a
 * full bar (and made the sampler meter's own STATUS_ERROR branch unreachable,
 * since it re-derived the count from a fraction that could never exceed 1).
 * `MeterBar`'s `overflow` now carries the excess as a hatched segment and
 * announces the true multiple.
 */
function BudgetMeter({ icon: Icon, label, valueLabel, value, max, toneAt, breakdown }: BudgetMeterProps) {
  const tone = toneAt(value);
  return (
    <div className="space-y-1.5" data-meter={label.toLowerCase()}>
      <div className="flex items-center gap-2 text-xs">
        <Icon size={12} className="text-text-muted" />
        <span className="text-text-muted">{label}</span>
        <span className="font-mono text-text-muted ml-auto" data-meter-value>{valueLabel}</span>
      </div>
      <MeterBar
        value={value}
        max={max}
        overflow
        color={tone}
        // A 45° hatch needs a few pixels of track to read; the old 1.5px rail
        // would have swallowed the over-budget cue entirely.
        height={6}
        ariaLabel={label}
        valueText={valueLabel}
      />
      <ul className="flex flex-wrap gap-1 text-2xs" aria-label={`${label} breakdown`}>
        {breakdown.map((b, i) => (
          <li key={`${b.label}-${i}`} className="px-1.5 py-0.5 rounded font-mono"
            style={{ background: withOpacity(STATUS_NEUTRAL, OPACITY_15), color: 'var(--text-muted)' }}>
            {b.label} <span className="text-text">{b.formatter(b.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Re-export so callers can render the bar from a pre-computed report. */
export type { MaterialBudgetReport };

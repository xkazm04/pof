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
        valueFraction={Math.min(report.samplers / SAMPLER_HARD_LIMIT, 1)}
        toneAt={(v) =>
          v * SAMPLER_HARD_LIMIT > SAMPLER_HARD_LIMIT ? STATUS_ERROR
            : v * SAMPLER_HARD_LIMIT >= SAMPLER_WARN_LIMIT ? STATUS_WARNING
              : STATUS_SUCCESS}
        breakdown={report.samplerBreakdown.map((b) => ({ label: b.source, amount: b.count, formatter: (n) => `${n}` }))}
      />

      <BudgetMeter
        icon={Cpu}
        label="Instructions"
        valueLabel={`${report.instructionScore.toFixed(2)}× metal base`}
        valueFraction={Math.min(report.instructionScore / (INSTRUCTION_WARN_THRESHOLD * 1.5), 1)}
        toneAt={(v) =>
          v * (INSTRUCTION_WARN_THRESHOLD * 1.5) >= INSTRUCTION_WARN_THRESHOLD ? STATUS_WARNING : STATUS_SUCCESS}
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
  valueFraction: number;
  toneAt: (v: number) => string;
  breakdown: Array<{ label: string; amount: number; formatter: (n: number) => string }>;
}

function BudgetMeter({ icon: Icon, label, valueLabel, valueFraction, toneAt, breakdown }: BudgetMeterProps) {
  const tone = toneAt(valueFraction);
  const widthPct = Math.max(2, Math.round(valueFraction * 100));
  return (
    <div className="space-y-1.5" data-meter={label.toLowerCase()}>
      <div className="flex items-center gap-2 text-xs">
        <Icon size={12} className="text-text-muted" />
        <span className="text-text-muted">{label}</span>
        <span className="font-mono text-text-muted ml-auto" data-meter-value>{valueLabel}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: withOpacity(tone, OPACITY_15) }}>
        <div className="h-full rounded-full" style={{ width: `${widthPct}%`, background: tone, transition: 'width 200ms ease' }} />
      </div>
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

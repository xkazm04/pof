'use client';

import type { LabTheme } from '../theme';
import { describeRunPlanTotals, type RunPlan, type RunPlanRow, type StepModeOverride } from '@/lib/one-shot/runPlan';

interface Props {
  t: LabTheme;
  plan: RunPlan;
  /** Choose who authors a step (only offered on model-authorable rows). */
  onSetMode: (label: string, mode: StepModeOverride) => void;
  /** Model/effort + historical cost sentence for one model dispatch, when known. */
  costCopy?: string | null;
}

function authorOf(r: RunPlanRow): string {
  if (r.mode === 'run-cli') return 'model';
  if (r.mode === 'run-deterministic') return 'built-in';
  if (r.mode === 'skip-needs-art') return 'needs art';
  return `deferred ${r.tier}`;
}

/**
 * The run plan above 'Run pipeline': every step of the draft with who will author it, the
 * totals, and an 'Author with model' toggle on each model-authorable row — so the spend is
 * decided before the click, not read off the run log after it.
 */
export function RunPlanView({ t, plan, onSetMode, costCopy }: Props) {
  return (
    <div data-testid="run-plan" style={{ border: `1px solid ${t.line}`, background: t.panel, padding: '10px 12px', marginBottom: 12 }}>
      <div className={t.fontMono} style={{ fontSize: 12, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
        Run plan
      </div>
      <div className={t.fontMono} data-testid="run-plan-totals" style={{ fontSize: 13, color: t.inkDeep, fontWeight: 600, marginBottom: 6 }}>
        {describeRunPlanTotals(plan.totals)}
      </div>
      {plan.totals.model > 0 && costCopy && (
        <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.45, marginBottom: 6 }}>Per model dispatch: {costCopy}</div>
      )}
      {plan.rows.length === 0 && (
        <div style={{ fontSize: 13, color: t.warn }}>No registered pipeline steps for this catalog — the run would record nothing.</div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {plan.rows.map((r) => {
          const onModel = r.mode === 'run-cli';
          return (
            <li key={r.label} data-testid={`run-plan-row-${r.label}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: `1px solid ${t.line}`, fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
              <span className={t.fontMono} style={{ fontSize: 12, color: onModel ? t.warn : t.muted }}>{authorOf(r)}</span>
              {r.authorable && (
                <button type="button" aria-pressed={onModel} aria-label={`Author with model: ${r.label}`}
                  onClick={() => onSetMode(r.label, onModel ? 'deterministic' : 'cli')}
                  className={t.fontMono}
                  style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', background: 'transparent',
                    color: onModel ? t.warn : t.muted, border: `1px solid ${onModel ? t.warn : t.line}` }}>
                  {onModel ? '✓ ' : ''}Author with model
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

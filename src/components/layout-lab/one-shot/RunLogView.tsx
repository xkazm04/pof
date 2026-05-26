'use client';

import type { LabTheme } from '../theme';
import type { StepResult, StepOutcome } from '@/stores/oneShotJobStore';

interface Props {
  t: LabTheme;
  steps: StepResult[];
  phase: string;
  summary?: { passed: number; failed: number; skipped: number; deferred: number } | null;
}

function outcomeColor(outcome: StepOutcome, t: LabTheme): string {
  switch (outcome) {
    case 'pass':     return t.ok;
    case 'fail':     return t.bad;
    case 'skipped':  return t.muted;
    case 'deferred': return t.warn;
  }
}

function outcomeLabel(outcome: StepOutcome): string {
  switch (outcome) {
    case 'pass':     return 'PASS';
    case 'fail':     return 'FAIL';
    case 'skipped':  return 'SKIP';
    case 'deferred': return 'DEFER';
  }
}

/**
 * Renders StepResult[] with outcome-colored rows. Pass/fail/skip/defer each use
 * the corresponding theme token — no hard-coded hex.
 */
export function RunLogView({ t, steps, phase, summary }: Props) {
  return (
    <div>
      <div className={t.fontMono} style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.muted, marginBottom: 8 }}>
        Run log · {phase}
      </div>

      {summary && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {([
            { label: 'passed',   value: summary.passed,   color: t.ok },
            { label: 'failed',   value: summary.failed,   color: t.bad },
            { label: 'skipped',  value: summary.skipped,  color: t.muted },
            { label: 'deferred', value: summary.deferred, color: t.warn },
          ] as const).map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div className={t.fontMono} style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
              <div className={t.fontMono} style={{ fontSize: 11, color: t.muted }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {steps.length === 0 ? (
        <div className={t.fontMono} style={{ fontSize: 13, color: t.muted }}>No steps recorded yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {steps.map((r, i) => (
            <div
              key={`${r.step}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                padding: '5px 8px',
                border: `1px solid ${t.line}`,
                background: t.panel,
              }}
            >
              <span
                className={t.fontMono}
                style={{ fontSize: 11, fontWeight: 700, color: outcomeColor(r.outcome, t), minWidth: 40, flexShrink: 0 }}
              >
                {outcomeLabel(r.outcome)}
              </span>
              <span style={{ fontSize: 13, color: t.text, flex: 1 }}>{r.step}</span>
              {r.reason && (
                <span className={t.fontMono} style={{ fontSize: 11, color: t.muted, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.reason}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

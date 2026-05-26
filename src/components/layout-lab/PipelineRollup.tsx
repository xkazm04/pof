'use client';

import { summarizeEntity, type EntityRollup } from '@/lib/catalog/rollup';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { LabTheme } from './theme';

const COLOR = (t: LabTheme, s: PipelineArtifact['status']) =>
  s === 'pass' ? t.ok : s === 'fail' ? t.bad : s === 'deferred' ? t.muted : t.warn;

/** Per-step status strip + a config-complete summary, so deferred (stub) steps are visible. */
export function PipelineRollup({ t, steps, artifacts, onDrain, draining }: {
  t: LabTheme; steps: string[]; artifacts: PipelineArtifact[];
  /** When provided and there are deferred gates, shows a "Run deferred gates" button. */
  onDrain?: () => void; draining?: boolean;
}) {
  const byStep = new Map(artifacts.map((a) => [a.step, a]));
  const sum: EntityRollup = summarizeEntity(artifacts, steps.length);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className={t.fontMono} style={{ fontSize: 14, color: t.muted, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>
          {sum.done}/{sum.total} pass · {sum.deferred} deferred · {sum.pending} pending · highest {sum.highestTier ?? '—'}
          {sum.configComplete && <span style={{ color: t.ok }}> · CONFIG-COMPLETE</span>}
        </span>
        {onDrain && sum.deferred > 0 && (
          <button onClick={onDrain} disabled={draining} className={t.fontMono}
            title="Run the deferred L3/L4 Test Gates through the live-UE runner (bridge)"
            style={{ fontSize: 13, padding: '3px 10px', cursor: draining ? 'wait' : 'pointer', background: 'transparent', color: t.ink, border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, opacity: draining ? 0.6 : 1 }}>
            {draining ? 'Running…' : `Run ${sum.deferred} deferred gate${sum.deferred > 1 ? 's' : ''}`}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {steps.map((s) => {
          const a = byStep.get(s);
          const status = a?.status ?? 'pending';
          return (
            <span key={s} className={t.fontMono} title={`${s}: ${status}${a?.tier ? ' · ' + a.tier : ''}${a?.reason ? ' — ' + a.reason : ''}`}
              style={{ fontSize: 14, padding: '4px 8px', border: `1px solid ${COLOR(t, status)}`, color: COLOR(t, status), borderRadius: t.glass ? 6 : 0 }}>
              {s}{a?.tier ? ` · ${a.tier}` : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

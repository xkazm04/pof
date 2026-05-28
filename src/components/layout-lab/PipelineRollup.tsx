'use client';

import { summarizeEntity, type EntityRollup } from '@/lib/catalog/rollup';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { LabTheme } from './theme';
import {
  STATUS_GLOSSARY, TIER_GLOSSARY, TERM_GLOSSARY, plainEntitySummary,
} from './labGlossary';

const COLOR = (t: LabTheme, s: PipelineArtifact['status']) =>
  s === 'pass' ? t.ok : s === 'fail' ? t.bad : s === 'deferred' ? t.muted : t.warn;

/**
 * Build a `title` tooltip that is helpful in both technical and plain modes:
 * the technical line stays present so power users still see status/tier/reason,
 * plus a plain-language sentence for everyone else.
 */
function stepTooltip(step: string, art: PipelineArtifact | undefined): string {
  const status = art?.status ?? 'pending';
  const tech = `${step}: ${status}${art?.tier ? ` · ${art.tier}` : ''}${art?.reason ? ` — ${art.reason}` : ''}`;
  const plain = STATUS_GLOSSARY[status]?.plain;
  const tierPlain = art?.tier ? `\nTier ${art.tier}: ${TIER_GLOSSARY[art.tier]?.plain ?? ''}` : '';
  return `${tech}\n\n${plain}${tierPlain}`;
}

/** Per-step status strip + a config-complete summary, so deferred (stub) steps are visible. */
export function PipelineRollup({ t, steps, artifacts, onDrain, draining, plainMode = false }: {
  t: LabTheme; steps: string[]; artifacts: PipelineArtifact[];
  /** When provided and there are deferred gates, shows a "Run deferred gates" button. */
  onDrain?: () => void; draining?: boolean;
  /** When true, renders a one-sentence plain-language summary instead of the dense X/Y line. */
  plainMode?: boolean;
}) {
  const byStep = new Map(artifacts.map((a) => [a.step, a]));
  const sum: EntityRollup = summarizeEntity(artifacts, steps.length);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className={t.fontMono} style={{ fontSize: 14, color: t.muted, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {plainMode ? (
          <span style={{ fontSize: 14 }} data-testid="rollup-plain">{plainEntitySummary(sum)}</span>
        ) : (
          <span>
            <span title="Steps whose acceptance check has passed">{sum.done}/{sum.total} pass</span>
            {' · '}
            <span title={TERM_GLOSSARY.deferred.plain}>{sum.deferred} deferred</span>
            {' · '}
            <span title={STATUS_GLOSSARY.pending.plain}>{sum.pending} pending</span>
            {' · '}
            <span title={TERM_GLOSSARY.tier.plain}>highest {sum.highestTier ?? '—'}</span>
            {sum.configComplete && (
              <span style={{ color: t.ok }} title={TERM_GLOSSARY['config-complete'].plain}> · CONFIG-COMPLETE</span>
            )}
          </span>
        )}
        {onDrain && sum.deferred > 0 && (
          <button onClick={onDrain} disabled={draining} className={t.fontMono}
            title={TERM_GLOSSARY.drain.plain}
            style={{ fontSize: 13, padding: '3px 10px', cursor: draining ? 'wait' : 'pointer', background: 'transparent', color: t.ink, border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, opacity: draining ? 0.6 : 1 }}>
            {draining
              ? 'Running…'
              : plainMode
                ? `Run ${sum.deferred} waiting test${sum.deferred > 1 ? 's' : ''}`
                : `Run ${sum.deferred} deferred gate${sum.deferred > 1 ? 's' : ''}`}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {steps.map((s) => {
          const a = byStep.get(s);
          const status = a?.status ?? 'pending';
          return (
            <span key={s} className={t.fontMono} title={stepTooltip(s, a)}
              style={{ fontSize: 14, padding: '4px 8px', border: `1px solid ${COLOR(t, status)}`, color: COLOR(t, status), borderRadius: t.glass ? 6 : 0 }}>
              {s}{a?.tier ? ` · ${a.tier}` : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

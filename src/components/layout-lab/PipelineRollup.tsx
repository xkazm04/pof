'use client';

import { useState } from 'react';
import { summarizeEntity, type EntityRollup } from '@/lib/catalog/rollup';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { LabTheme } from './theme';
import {
  STATUS_GLOSSARY, TIER_GLOSSARY, TERM_GLOSSARY, plainEntitySummary,
} from './labGlossary';
import { STATUS_GLYPH, STATUS_WORD, statusAriaLabel, type StatusKind } from './statusLanguage';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { Panel } from './ui/Panel';

const COLOR = (t: LabTheme, s: PipelineArtifact['status']) =>
  s === 'pass' ? t.ok : s === 'fail' ? t.bad : s === 'deferred' ? t.muted : t.warn;

type ChipTone = 'ok' | 'bad' | 'neutral' | 'warn';
const STATUS_TONE: Record<PipelineArtifact['status'], ChipTone> = {
  pass: 'ok', fail: 'bad', deferred: 'neutral', pending: 'warn',
};

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

/** Recover the bridge-runner test id (e.g. `FVSGenFireballEffectTest`) from a status reason. */
function recoverTestName(reason?: string): string | null {
  if (!reason) return null;
  const m = reason.match(/\b([A-Z][A-Za-z0-9_]*Test)\b/);
  return m ? m[1] : null;
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
  const [openStep, setOpenStep] = useState<string | null>(null);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className={t.fontMono} style={{ fontSize: 14, color: t.muted, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {plainMode ? (
          <span style={{ fontSize: 14 }} data-testid="rollup-plain">{plainEntitySummary(sum)}</span>
        ) : (
          <span>
            {/* count is its own element so it reads as a clean "X/Y" token */}
            <span title="Steps whose acceptance check has passed"><span>{sum.done}/{sum.total}</span> pass</span>
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
          <Button onClick={onDrain} disabled={draining} mono
            style={{ opacity: draining ? 0.6 : 1, cursor: draining ? 'wait' : 'pointer' }}>
            {draining
              ? 'Running…'
              : plainMode
                ? `Run ${sum.deferred} waiting test${sum.deferred > 1 ? 's' : ''}`
                : `Run ${sum.deferred} deferred gate${sum.deferred > 1 ? 's' : ''}`}
          </Button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
        {steps.map((s) => {
          const a = byStep.get(s);
          const status = (a?.status ?? 'pending') as StatusKind;
          const tier = a?.tier ?? null;
          const color = COLOR(t, status);
          const label = statusAriaLabel(s, status, tier);
          const glyph = STATUS_GLYPH[status];
          const chipBody = <><span aria-hidden="true">{glyph}</span>{s}{tier ? ` · ${tier}` : ''}</>;

          // Pass / pending stay non-interactive (role="img") — the plain-language
          // label + glyph carry the status without relying on color (WCAG 1.4.1).
          if (status !== 'fail' && status !== 'deferred') {
            return (
              <Chip key={s} tone={STATUS_TONE[status]}
                role="img" aria-label={label} title={stepTooltip(s, a)}
                className={t.fontMono}
                style={{ color, borderColor: color }}>
                {chipBody}
              </Chip>
            );
          }

          // Fail / deferred are disclosure buttons that expand a detail region.
          const open = openStep === s;
          const regionId = `rollup-detail-${s.replace(/\W+/g, '-')}`;
          const testName = recoverTestName(a?.reason);
          return (
            <span key={s} style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--lab-s2)' }}>
              <button
                aria-label={label}
                aria-expanded={open}
                aria-controls={open ? regionId : undefined}
                onClick={() => setOpenStep(open ? null : s)}
                title={stepTooltip(s, a)}
                className={t.fontMono}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 'var(--lab-s1)',
                  fontSize: 'var(--lab-fs-xs)', padding: 'var(--lab-s1) var(--lab-s2)',
                  border: `1px solid ${color}`, color,
                  borderRadius: 'var(--lab-r-sm)', cursor: 'pointer', background: 'transparent',
                  whiteSpace: 'nowrap',
                }}
              >
                {chipBody}
              </button>
              {open && (
                <Panel id={regionId} role="region" aria-label={`${s} ${STATUS_WORD[status]} details`}
                  className={t.fontBody} radius="md"
                  style={{ fontSize: 13, color: 'var(--lab-text)', maxWidth: 320, display: 'grid', gap: 'var(--lab-s2)', padding: 'var(--lab-s3)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--lab-s2)' }}>
                    <span className={t.fontMono} style={{ color, fontSize: 13 }}>{STATUS_WORD[status]} · tier {tier ?? '—'}</span>
                    <button aria-label="Close details" onClick={() => setOpenStep(null)} className={t.fontMono}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lab-muted)', fontSize: 13 }}>✕</button>
                  </div>
                  {testName && <code className={t.fontMono} style={{ fontSize: 13, color: 'var(--lab-ink-deep)' }}>{testName}</code>}
                  {a?.reason && <p style={{ margin: 0, color: 'var(--lab-muted)', lineHeight: 1.5 }}>{a.reason}</p>}
                </Panel>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { summarizeEntity, type EntityRollup } from '@/lib/catalog/rollup';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { LabTheme } from './theme';
import {
  STATUS_GLOSSARY, TIER_GLOSSARY, TERM_GLOSSARY, plainEntitySummary,
} from './labGlossary';
import { STATUS_GLYPH, STATUS_WORD, statusAriaLabel, type StatusKind } from './statusLanguage';

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
        {steps.map((s) => {
          const a = byStep.get(s);
          const status = (a?.status ?? 'pending') as StatusKind;
          const tier = a?.tier ?? null;
          const color = COLOR(t, status);
          const label = statusAriaLabel(s, status, tier);
          const glyph = STATUS_GLYPH[status];
          const chipStyle: React.CSSProperties = {
            fontSize: 14, padding: '4px 8px', border: `1px solid ${color}`, color,
            borderRadius: t.glass ? 6 : 0, display: 'inline-flex', alignItems: 'center', gap: 6,
          };
          const chipBody = <><span aria-hidden="true">{glyph}</span>{s}{tier ? ` · ${tier}` : ''}</>;

          // Pass / pending stay non-interactive (role="img") — the plain-language
          // label + glyph carry the status without relying on color (WCAG 1.4.1).
          if (status !== 'fail' && status !== 'deferred') {
            return (
              <span key={s} role="img" aria-label={label} title={stepTooltip(s, a)} className={t.fontMono} style={chipStyle}>
                {chipBody}
              </span>
            );
          }

          // Fail / deferred are disclosure buttons that expand a detail region.
          const open = openStep === s;
          const regionId = `rollup-detail-${s.replace(/\W+/g, '-')}`;
          const testName = recoverTestName(a?.reason);
          return (
            <span key={s} style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
              <button
                aria-label={label}
                aria-expanded={open}
                aria-controls={open ? regionId : undefined}
                onClick={() => setOpenStep(open ? null : s)}
                title={stepTooltip(s, a)}
                className={t.fontMono}
                style={{ ...chipStyle, cursor: 'pointer', background: 'transparent' }}
              >
                {chipBody}
              </button>
              {open && (
                <div id={regionId} role="region" aria-label={`${s} ${STATUS_WORD[status]} details`} className={t.fontBody}
                  style={{ fontSize: 13, color: t.text, border: `1px solid ${t.line}`, borderRadius: t.glass ? 8 : 0, padding: 10, maxWidth: 320, display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <span className={t.fontMono} style={{ color, fontSize: 13 }}>{STATUS_WORD[status]} · tier {tier ?? '—'}</span>
                    <button aria-label="Close details" onClick={() => setOpenStep(null)} className={t.fontMono}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 13 }}>✕</button>
                  </div>
                  {testName && <code className={t.fontMono} style={{ fontSize: 13, color: t.inkDeep }}>{testName}</code>}
                  {a?.reason && <p style={{ margin: 0, color: t.muted, lineHeight: 1.5 }}>{a.reason}</p>}
                </div>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

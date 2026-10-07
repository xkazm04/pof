'use client';

import { MicroLabel } from '@/components/ui/MicroLabel';
import { StatusTag } from '@/components/ui/StatusTag';
import { BANDS } from '@/lib/judge/rubrics';
import { unverifiedReason } from '@/lib/catalog/acceptance/judgeBridge';
import { LabButton } from '../controls';
import { ChartPanel } from '../shared/ChartPanel';
import { STORED_FINDINGS_CAP, pointsShort, retiredByReproduce, weakestFirst, type ParsedFindings } from './judgeVerdictRecord';
import type { FixEffect } from '../ArchetypeStep';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { LabTheme } from '../../theme';

export interface JudgeVerdictPanelProps {
  t: LabTheme;
  verdict: JudgeVerdict;
  parsed: ParsedFindings;
  /** The step's own checker passed, so this verdict alone blocks it (read from the acceptance chain). */
  shapePassed: boolean;
  /** What the next Produce can do here (`fixEffectOf`), so the panel never promises a no-op. */
  fixEffect: FixEffect;
  liveEligible: boolean;
  seeded: boolean;
  onSeed: () => void;
}

const BAR = BANDS.shippable;

/** One sentence on what the next Produce will do with the seeded direction. */
export function nextProduceNote(fixEffect: FixEffect, liveEligible: boolean): string {
  if (fixEffect === 'live-produce') return 'Live produce is on: the next Produce sends this direction to the claude CLI.';
  if (fixEffect !== 'no-op') return 'The next Produce runs with this direction.';
  return liveEligible
    ? 'Live produce is off. The stub produce ignores the direction and rewrites the same text, so the verdict cannot move. Turn on live produce in the Produce panel before you dispatch.'
    : 'This step has no live produce path and its stub produce ignores the direction, so nothing in this panel can move the verdict.';
}

/** What a re-produce does to THIS verdict — derived, never assumed (see `retiredByReproduce`). */
export function afterReproduceNote(v: JudgeVerdict): string {
  return retiredByReproduce(v)
    ? `A re-produce makes this verdict STALE. It stops blocking, and the step reads UNJUDGED until a fresh judge run scores it. The judge passes at ${BAR} or above.`
    : `A re-produce does not retire this verdict, because ${unverifiedReason(v)}. It keeps blocking until a fresh judge run replaces it. The judge passes at ${BAR} or above.`;
}

/**
 * PROTOTYPE (`?ux=judge-verdict`): the stored judge verdict that blocks a text step, laid out
 * for the decision an operator has to make — how far below the bar it is, which rubric
 * dimension sinks it, what the judge found in full, the judge's own fix, and what the next
 * Produce would actually do. Display plus one input action (seed the Produce direction); it
 * never grades, never dispatches and cannot move a verdict.
 */
export function JudgeVerdictPanel({ t, verdict: v, parsed: p, shapePassed, fixEffect, liveEligible, seeded, onSeed }: JudgeVerdictPanelProps) {
  const short = pointsShort(v.score);
  const dims = weakestFirst(v.dimensions);
  const weakest = dims[0];
  const meta = [
    v.model || v.judge,
    p.rubric && `rubric ${p.rubric}${p.canon ? ' + canon' : ''}`,
    p.panel.length > 1 && `panel ${p.panel.join(' · ')}`,
    v.judgedAt,
  ].filter(Boolean).join('  ·  ');
  const prose = { fontSize: 14, lineHeight: 1.6, color: t.text, margin: 0, whiteSpace: 'pre-wrap' as const };
  const block = { display: 'grid', gap: 6 } as const;

  return (
    <div data-testid="judge-verdict-desk" style={{ display: 'grid', gap: 16 }}>
      <div style={block}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <StatusTag level="bad" word="JUDGE: FAIL" />
          <span data-testid="judge-score" className={t.fontMono} style={{ fontSize: 22, fontWeight: 700, color: t.inkDeep }}>
            {v.score}<span style={{ fontSize: 14, fontWeight: 400, color: t.muted }}> / {BAR} to pass</span>
          </span>
          {short > 0 && <span className={t.fontMono} style={{ fontSize: 14, color: t.warn }}>{short} short</span>}
        </div>
        <span className={t.fontMono} style={{ fontSize: 13, color: t.muted }}>{meta}</span>
        {shapePassed && (
          <span data-testid="judge-only-blocker" style={{ fontSize: 14, color: t.text }}>
            The shape check passes. This verdict is the only thing blocking the step.
          </span>
        )}
      </div>

      {weakest && (
        <div data-testid="judge-dimensions" style={block}>
          <MicroLabel mono uppercase tone="muted">Rubric dimensions · weakest first</MicroLabel>
          <ChartPanel t={t} variant="bars" max={100} labelWidth={120} ariaLabel="judge rubric dimension scores"
            rows={dims.map(([k, n], i) => ({ label: k, value: n, color: n >= BAR ? t.ok : t.warn, highlight: i === 0 }))} />
          <span data-testid="judge-weakest" style={{ fontSize: 14, color: t.text }}>
            Weakest: {weakest[0]} {weakest[1]}{pointsShort(weakest[1]) ? `, ${pointsShort(weakest[1])} below the bar` : ''}. The judge&apos;s overall score follows its weakest few dimensions.
          </span>
        </div>
      )}

      <div style={block}>
        <MicroLabel mono uppercase tone="muted">What the judge found</MicroLabel>
        <p data-testid="judge-critique" style={prose}>{p.critique}</p>
      </div>

      <div style={block}>
        <MicroLabel mono uppercase tone="muted">The judge&apos;s fix</MicroLabel>
        {p.fix ? (
          <p data-testid="judge-fix" style={prose}>{p.fix}{p.clipped ? ' …' : ''}</p>
        ) : (
          <p data-testid="judge-fix-missing" style={{ ...prose, color: t.muted }}>
            {p.clipped
              ? `No fix survived. The stored record stops at ${STORED_FINDINGS_CAP} characters, and the judge's fix is written last.`
              : 'This verdict records no separate fix. Its findings above are the whole record.'}
          </p>
        )}
        {p.fix && p.clipped && (
          <span style={{ fontSize: 13, color: t.muted }}>The fix is cut off where the stored record reaches {STORED_FINDINGS_CAP} characters.</span>
        )}
      </div>

      <div style={{ ...block, borderTop: `1px solid ${t.line}`, paddingTop: 12 }}>
        <MicroLabel mono uppercase tone="muted">Next move</MicroLabel>
        <div>
          <LabButton t={t} testId="judge-seed-direction" onClick={onSeed}>
            {p.fix ? 'Use the judge’s fix as the Produce direction' : 'Use the judge’s findings as the Produce direction'}
          </LabButton>
        </div>
        {seeded && (
          <span data-testid="judge-seeded" role="status" style={{ fontSize: 14, color: t.ok }}>
            ✓ Placed in the Produce direction box. Read it there before you dispatch.
          </span>
        )}
        <span data-testid="judge-next-produce" style={{ fontSize: 14, color: t.text, lineHeight: 1.5 }}>
          {nextProduceNote(fixEffect, liveEligible)}
        </span>
        <span data-testid="judge-after-reproduce" style={{ fontSize: 14, color: t.muted, lineHeight: 1.5 }}>
          {afterReproduceNote(v)}
        </span>
      </div>
    </div>
  );
}

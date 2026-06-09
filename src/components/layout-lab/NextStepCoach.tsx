'use client';

import { useMemo, useState } from 'react';
import type { LabTheme } from './theme';
import type { EntityRollup } from '@/lib/catalog/rollup';
import { pickNextActionableStep, type StepStatus } from './nextActionableStep';
import { plainEntitySummary, STATUS_GLOSSARY } from './labGlossary';
import { statusColor } from './statusLanguage';
import { Panel } from './ui/Panel';
import { Button } from './ui/Button';

interface NextStepCoachProps {
  t: LabTheme;
  steps: string[];
  statusByStep: (step: string, index: number) => StepStatus;
  rollup: EntityRollup;
  /** Jump to the recommended step. */
  onJump: (index: number) => void;
  /** When true, the coach also renders a one-sentence plain-language rollup summary. */
  plainMode: boolean;
  /** Toggle plain-language mode (also rendered by the coach). */
  onTogglePlainMode: () => void;
  /** Drain this entity's deferred L3/L4 gates (relocated here from the old in-canvas PipelineRollup). */
  onDrain?: () => void;
  draining?: boolean;
}

/**
 * Per-entity coach. Default state is ONE compact row — the next action + its
 * primary button — because the left pipeline sidebar already carries the full
 * per-step status. A disclosure toggle expands a "more" region with the
 * plain-language switch (+ summary) and the deferred-gate drainer. Reads the same
 * statuses PipelineRollup derives — no new truth source.
 */
export function NextStepCoach({
  t, steps, statusByStep, rollup, onJump, plainMode, onTogglePlainMode, onDrain, draining,
}: NextStepCoachProps) {
  const [expanded, setExpanded] = useState(false);
  const next = useMemo(
    () => pickNextActionableStep(steps, statusByStep),
    [steps, statusByStep],
  );

  const tint = next ? statusColor(next.status, t) : t.ok;
  const nextIsDeferred = next?.status === 'deferred';
  const canDrain = !!onDrain && rollup.deferred > 0;
  const drainLabel = draining
    ? 'Running…'
    : `Run ${rollup.deferred} deferred gate${rollup.deferred > 1 ? 's' : ''}`;

  const ctaStyle = {
    flexShrink: 0, fontWeight: 600,
    background: tint, color: 'var(--lab-on-accent)', border: `1px solid ${tint}`,
  } as const;

  return (
    <Panel
      role="status"
      aria-live="polite"
      data-testid="next-step-coach"
      glass={t.glass}
      style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--lab-s2)',
        padding: 'var(--lab-s2) var(--lab-s4)',
        marginBottom: 'var(--lab-s4)',
        borderLeft: `4px solid ${tint}`,
      }}
    >
      {/* Compact row (default). The message takes the slack so the CTA + disclosure sit at the right. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--lab-s3)', minWidth: 0 }}>
        <span
          className={t.fontMono}
          style={{
            fontSize: 'var(--lab-fs-xs)', letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--lab-muted)', flexShrink: 0,
          }}
        >
          What to do next
        </span>

        {next ? (
          <span
            title={`${next.actionWord}: ${next.step} — ${next.plainHint}`}
            style={{ flex: 1, minWidth: 0, fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            <strong style={{ color: 'var(--lab-ink-deep)', fontWeight: 600 }}>{next.actionWord}:</strong>{' '}
            <span data-testid="next-step-name">{next.step}</span>
            <span style={{ color: 'var(--lab-muted)' }}> &mdash; {next.plainHint}</span>
          </span>
        ) : (
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <strong style={{ color: 'var(--lab-ink-deep)', fontWeight: 600 }}>All done.</strong>{' '}
            <span style={{ color: 'var(--lab-muted)' }}>{STATUS_GLOSSARY.pass.plain}</span>
          </span>
        )}

        {/* Primary CTA: drain when the next step is itself deferred, otherwise jump to it. */}
        {next && (nextIsDeferred && canDrain ? (
          <Button
            onClick={onDrain}
            disabled={draining}
            data-testid="next-step-drain"
            ariaLabel={drainLabel}
            mono
            style={{ ...ctaStyle, opacity: draining ? 0.6 : 1, cursor: draining ? 'wait' : 'pointer' }}
          >
            {drainLabel}
          </Button>
        ) : (
          <Button
            onClick={() => onJump(next.index)}
            data-testid="next-step-jump"
            ariaLabel={`Jump to step ${next.step}`}
            mono
            style={ctaStyle}
          >
            Open this step &rarr;
          </Button>
        ))}

        {/* Disclosure: reveals the plain-language switch + drainer when there's more to see. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="next-step-coach-more"
          aria-label={expanded ? 'Hide details' : 'Show details'}
          data-testid="coach-expand"
          className={`focus-ring ${t.fontMono}`}
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--lab-s1)',
            fontSize: 'var(--lab-fs-xs)', padding: 'var(--lab-s1) var(--lab-s2)',
            border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)',
            background: 'transparent', color: 'var(--lab-muted)', cursor: 'pointer',
          }}
        >
          <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>{expanded ? 'less' : 'more'}
        </button>
      </div>

      {/* Expanded "more information" region. */}
      {expanded && (
        <div
          id="next-step-coach-more"
          data-testid="coach-more"
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--lab-s3)',
            paddingTop: 'var(--lab-s2)', borderTop: '1px dashed var(--lab-line)',
          }}
        >
          <Button
            onClick={onTogglePlainMode}
            data-testid="plain-mode-toggle"
            active={plainMode}
            title={plainMode ? 'Switch to technical labels' : 'Switch to plain-language labels'}
            mono
            style={{ flexShrink: 0 }}
          >
            {plainMode ? '✓ plain-language' : 'plain-language'}
          </Button>

          {/* Drain stays reachable here whenever it isn't already the compact CTA. */}
          {canDrain && !nextIsDeferred && (
            <Button
              onClick={onDrain}
              disabled={draining}
              data-testid="coach-drain"
              mono
              style={{ flexShrink: 0, opacity: draining ? 0.6 : 1, cursor: draining ? 'wait' : 'pointer' }}
            >
              {drainLabel}
            </Button>
          )}

          {plainMode && (
            <span
              data-testid="plain-summary"
              style={{ flexBasis: '100%', fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-text)', lineHeight: 1.5, paddingTop: 'var(--lab-s2)' }}
            >
              {plainEntitySummary(rollup)}
            </span>
          )}
        </div>
      )}
    </Panel>
  );
}

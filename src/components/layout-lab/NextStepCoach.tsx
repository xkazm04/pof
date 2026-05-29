'use client';

import { useMemo } from 'react';
import type { LabTheme } from './theme';
import type { EntityRollup } from '@/lib/catalog/rollup';
import { pickNextActionableStep, type StepStatus } from './nextActionableStep';
import { plainEntitySummary, STATUS_GLOSSARY } from './labGlossary';
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
}

const STATUS_TINT = (t: LabTheme, s: StepStatus): string =>
  s === 'fail' ? t.bad : s === 'deferred' ? t.muted : s === 'pass' ? t.ok : t.warn;

/**
 * Per-entity coach banner. Surfaces the next thing the user should do in plain
 * language with a one-click jump. Reads the same statuses PipelineRollup
 * derives -- no new truth source.
 */
export function NextStepCoach({
  t, steps, statusByStep, rollup, onJump, plainMode, onTogglePlainMode,
}: NextStepCoachProps) {
  const next = useMemo(
    () => pickNextActionableStep(steps, statusByStep),
    [steps, statusByStep],
  );

  const tint = next ? STATUS_TINT(t, next.status) : t.ok;
  const showCelebration = !next && rollup.total > 0 && rollup.deferred === 0;

  return (
    <Panel
      role="status"
      aria-live="polite"
      data-testid="next-step-coach"
      glass={t.glass}
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap',
        gap: 'var(--lab-s5)',
        padding: 'var(--lab-s4) var(--lab-s5)',
        marginBottom: 'var(--lab-s4)',
        borderLeft: `4px solid ${tint}`,
      }}
    >
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
        <>
          <span style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-text)', lineHeight: 1.4, minWidth: 0 }}>
            <strong style={{ color: 'var(--lab-ink-deep)', fontWeight: 600 }}>
              {next.actionWord}:
            </strong>{' '}
            <span data-testid="next-step-name">{next.step}</span>
            <span style={{ color: 'var(--lab-muted)' }}> &mdash; {next.plainHint}</span>
          </span>
          <Button
            onClick={() => onJump(next.index)}
            data-testid="next-step-jump"
            ariaLabel={`Jump to step ${next.step}`}
            mono
            style={{
              marginLeft: 'auto', fontWeight: 600, flexShrink: 0,
              background: tint, color: 'var(--lab-on-accent)',
              border: `1px solid ${tint}`,
            }}
          >
            Open this step &rarr;
          </Button>
        </>
      ) : showCelebration ? (
        <span style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-text)', lineHeight: 1.4 }}>
          <strong style={{ color: 'var(--lab-ink-deep)', fontWeight: 600 }}>All done.</strong>{' '}
          <span style={{ color: 'var(--lab-muted)' }}>{STATUS_GLOSSARY.pass.plain}</span>
        </span>
      ) : (
        <span style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-text)', lineHeight: 1.4 }}>
          <strong style={{ color: 'var(--lab-ink-deep)', fontWeight: 600 }}>Almost there.</strong>{' '}
          <span style={{ color: 'var(--lab-muted)' }}>
            Every step is finished or waiting on a live Unreal test &mdash; use
            &ldquo;Run deferred gates&rdquo; to send them.
          </span>
        </span>
      )}

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

      {plainMode && (
        <div
          data-testid="plain-summary"
          style={{
            flexBasis: '100%',
            fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-text)', lineHeight: 1.5,
            paddingTop: 'var(--lab-s3)',
            borderTop: '1px dashed var(--lab-line)',
          }}
        >
          {plainEntitySummary(rollup)}
        </div>
      )}
    </Panel>
  );
}

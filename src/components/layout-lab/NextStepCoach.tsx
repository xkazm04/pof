'use client';

import { useMemo } from 'react';
import type { LabTheme } from './theme';
import type { EntityRollup } from '@/lib/catalog/rollup';
import { pickNextActionableStep, type StepStatus } from './nextActionableStep';
import { plainEntitySummary, STATUS_GLOSSARY } from './labGlossary';

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
 * derives — no new truth source.
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
    <div
      role="status"
      aria-live="polite"
      data-testid="next-step-coach"
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14,
        padding: '12px 16px', marginBottom: 12,
        background: t.panel, border: `1px solid ${t.line}`,
        borderLeft: `4px solid ${tint}`,
        ...(t.glass ? { backdropFilter: 'blur(12px)', borderRadius: 10 } : {}),
      }}
    >
      <span
        className={t.fontMono}
        style={{
          fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: t.muted, flexShrink: 0,
        }}
      >
        What to do next
      </span>

      {next ? (
        <>
          <span style={{ fontSize: 15, color: t.text, lineHeight: 1.4, minWidth: 0 }}>
            <strong style={{ color: t.inkDeep, fontWeight: 600 }}>
              {next.actionWord}:
            </strong>{' '}
            <span data-testid="next-step-name">{next.step}</span>
            <span style={{ color: t.muted }}> — {next.plainHint}</span>
          </span>
          <button
            type="button"
            onClick={() => onJump(next.index)}
            data-testid="next-step-jump"
            aria-label={`Jump to step ${next.step}`}
            className={t.fontMono}
            style={{
              marginLeft: 'auto', fontSize: 13, padding: '6px 12px',
              cursor: 'pointer', background: tint, color: t.onAccent,
              border: `1px solid ${tint}`,
              borderRadius: t.glass ? 6 : 0, fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Open this step →
          </button>
        </>
      ) : showCelebration ? (
        <span style={{ fontSize: 15, color: t.text, lineHeight: 1.4 }}>
          <strong style={{ color: t.inkDeep, fontWeight: 600 }}>All done.</strong>{' '}
          <span style={{ color: t.muted }}>{STATUS_GLOSSARY.pass.plain}</span>
        </span>
      ) : (
        <span style={{ fontSize: 15, color: t.text, lineHeight: 1.4 }}>
          <strong style={{ color: t.inkDeep, fontWeight: 600 }}>Almost there.</strong>{' '}
          <span style={{ color: t.muted }}>
            Every step is finished or waiting on a live Unreal test — use
            “Run deferred gates” to send them.
          </span>
        </span>
      )}

      <button
        type="button"
        onClick={onTogglePlainMode}
        data-testid="plain-mode-toggle"
        aria-pressed={plainMode}
        title={plainMode ? 'Switch to technical labels' : 'Switch to plain-language labels'}
        className={t.fontMono}
        style={{
          fontSize: 13, padding: '4px 10px',
          background: plainMode ? t.accentBg : 'transparent',
          color: plainMode ? t.inkDeep : t.muted,
          border: `1px solid ${t.line}`,
          borderRadius: t.glass ? 6 : 0,
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        {plainMode ? '✓ plain-language' : 'plain-language'}
      </button>

      {plainMode && (
        <div
          data-testid="plain-summary"
          style={{
            flexBasis: '100%',
            fontSize: 14, color: t.text, lineHeight: 1.5,
            paddingTop: 8, borderTop: `1px dashed ${t.line}`,
          }}
        >
          {plainEntitySummary(rollup)}
        </div>
      )}
    </div>
  );
}

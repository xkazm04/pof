'use client';

import type { LabTheme } from './theme';
import { Button } from './ui/Button';

interface NextStepCoachMoreProps {
  t: LabTheme;
  plainMode: boolean;
  onTogglePlainMode: () => void;
  /** The drainer, when it is not already the compact CTA. */
  drain?: { onDrain: () => void; draining?: boolean; label: string };
  /** The plain-language rollup sentence (rendered only in plain mode). */
  summary: string;
  /** Steps nothing here can settle (UNGRADED) — the ladder skips them, so they are named here. */
  unsettleable: readonly string[];
}

/**
 * The per-entity coach's expanded "more" region: the plain-language switch (+ summary), the
 * deferred-gate drainer, and the rows the ladder skips because nothing here can settle them.
 * Display only — naming an unsettleable row never moves its status.
 */
export function NextStepCoachMore({ t, plainMode, onTogglePlainMode, drain, summary, unsettleable }: NextStepCoachMoreProps) {
  return (
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

      {drain && (
        <Button
          onClick={drain.onDrain}
          disabled={drain.draining}
          data-testid="coach-drain"
          mono
          style={{ flexShrink: 0, opacity: drain.draining ? 0.6 : 1, cursor: drain.draining ? 'wait' : 'pointer' }}
        >
          {drain.label}
        </Button>
      )}

      {unsettleable.length > 0 && (
        <span
          data-testid="coach-unsettleable"
          className={t.fontMono}
          style={{ flexBasis: '100%', fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', lineHeight: 1.5 }}
        >
          Nothing here can settle — UNGRADED: {unsettleable.join(', ')}
        </span>
      )}

      {plainMode && (
        <span
          data-testid="plain-summary"
          style={{ flexBasis: '100%', fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-text)', lineHeight: 1.5, paddingTop: 'var(--lab-s2)' }}
        >
          {summary}
        </span>
      )}
    </div>
  );
}

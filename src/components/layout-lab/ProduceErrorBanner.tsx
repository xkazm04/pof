'use client';

import { Button } from './ui/Button';
import type { LabTheme } from './theme';

interface ProduceErrorBannerProps {
  t: LabTheme;
  step: string;
  /** The recorded reason the last produce attempt failed (`LabStepArtifact.error`). */
  error: string;
  /** Whether the step still holds content produced by an EARLIER successful run. */
  hasContent: boolean;
  /** Dismiss the recorded failure (`labPipelineStore.clearError`). */
  onDismiss: () => void;
}

/**
 * Surfaces a step's recorded produce failure (Rule 4) in the work canvas, beside the
 * `DriftBanner` it is modelled on.
 *
 * `CliProduce` reports a failed dispatch inline — but only in the panel it was
 * dispatched from, and only until that panel unmounts. The store now records the reason
 * on the artifact (`labPipelineStore.fail`), so the failure survives a step switch, a
 * remount, and a reload; this banner is where it becomes visible again. The retry
 * affordance is deliberately NOT duplicated here: the Produce panel below owns the
 * prompt and already offers "Retry with same prompt" — this banner only states what
 * failed and lets the operator dismiss it.
 */
export function ProduceErrorBanner({ t, step, error, hasContent, onDismiss }: ProduceErrorBannerProps) {
  return (
    <div
      role="alert"
      data-testid="produce-error-banner"
      data-step={step}
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        padding: '10px 14px', margin: '0 0 16px',
        border: `1px solid ${t.bad}`, borderLeft: `3px solid ${t.bad}`,
        borderRadius: t.glass ? 8 : 0, background: 'var(--lab-panel)',
      }}
    >
      <span aria-hidden style={{ color: t.bad, fontWeight: 700 }}>✕</span>
      <span style={{ fontSize: 14, color: t.text, minWidth: 0 }}>
        <strong style={{ color: 'var(--lab-ink-deep)' }}>Last produce failed</strong> —{' '}
        <span data-testid="produce-error-reason">{error}</span>
        <span style={{ color: t.muted }}>
          {hasContent
            ? ' · the content from the previous successful run is still here.'
            : ' · nothing was produced for this step.'}
          {' '}Re-run Produce below to try again.
        </span>
      </span>
      <div style={{ marginLeft: 'auto' }}>
        <Button mono onClick={onDismiss} data-testid="produce-error-dismiss" ariaLabel={`Dismiss the produce failure for ${step}`}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

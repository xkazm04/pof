'use client';

import type { ReactNode } from 'react';
import { Wrench, Rocket, Hammer } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Button } from '@/components/ui/Button';
import type { NextStep, NextStepId } from './nextStep';

const STEP_ICON: Record<NextStepId, ReactNode> = {
  'install-tools': <Wrench className="w-4 h-4" />,
  'create-project': <Rocket className="w-4 h-4" />,
  'build-verify': <Hammer className="w-4 h-4" />,
};

interface NextStepBannerProps {
  step: NextStep;
  /** Fires the suggested step's action (install / create / build). */
  onAction: () => void;
  /** Disable the CTA (e.g. mid-scan, or prerequisites unmet). */
  disabled?: boolean;
  /** Show the CTA spinner while the step's CLI session is running. */
  loading?: boolean;
}

/**
 * The single, prominent "do this next" banner at the top of the Project Setup
 * content column. Accent-tinted so it reads as the one thing to act on, with a
 * plain one-line explanation and exactly one highlighted primary button.
 */
export function NextStepBanner({ step, onAction, disabled, loading }: NextStepBannerProps) {
  return (
    <SurfaceCard
      className="p-4 mb-6 bg-accent-medium"
      style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--setup)' }}
      data-testid="pof-setup-next-step-banner"
      data-step={step.id}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider text-accent-setup mb-1">
            Do this next
          </p>
          <h2 className="text-sm font-semibold text-text">{step.title}</h2>
          <p className="text-xs text-text-muted mt-0.5">{step.explanation}</p>
        </div>
        <Button
          data-testid="pof-setup-next-step-cta"
          intent="primary"
          onClick={onAction}
          disabled={disabled}
          loading={loading}
          leftIcon={STEP_ICON[step.id]}
        >
          {step.ctaLabel}
        </Button>
      </div>
    </SurfaceCard>
  );
}

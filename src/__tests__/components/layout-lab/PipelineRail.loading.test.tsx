import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PipelineRail } from '@/components/layout-lab/PipelineRail';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm', variable: '--m' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
afterEach(cleanup);

const steps = ['Concept Brief', 'Attributes', 'Economy'];
const baseProps = {
  steps, stepIdx: 0,
  isLive: () => true,
  tooltipFor: () => '', ariaFor: (s: string) => `${s}: x`,
  onSelectStep: () => {},
};

const dot = (c: HTMLElement, i: number) =>
  c.querySelector(`[data-testid="step-dot-stamp-${i}"]`)!.closest('[data-step-status]') as HTMLElement;

describe('PipelineRail loading state', () => {
  it('shimmers steps of unknown (pending) status while server verdicts load', () => {
    const { container } = render(
      <PipelineRail {...baseProps} loading displayStatus={() => 'pending'} />,
    );
    const d = dot(container, 0);
    expect(d.getAttribute('data-loading')).toBe('true');
    expect(d.className).toContain('lab-shimmer');
  });

  it('does NOT mask a locally-known status — a real pass/fail is truth, not loading', () => {
    const { container } = render(
      <PipelineRail {...baseProps} loading displayStatus={(_s, i) => (i === 0 ? 'pass' : 'pending')} />,
    );
    // Step 0 has a real status → no loading treatment; step 1 (pending) shimmers.
    expect(dot(container, 0).getAttribute('data-loading')).toBeNull();
    expect(dot(container, 1).getAttribute('data-loading')).toBe('true');
  });

  it('loading → real transition: once loaded, no step reads as loading', () => {
    const { container } = render(
      <PipelineRail {...baseProps} loading={false} displayStatus={() => 'pending'} />,
    );
    for (let i = 0; i < steps.length; i++) {
      expect(dot(container, i).getAttribute('data-loading')).toBeNull();
    }
  });
});

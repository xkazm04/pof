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

  it('shimmers unproduced steps too while server verdicts load (no real verdict yet)', () => {
    const { container } = render(
      <PipelineRail {...baseProps} loading displayStatus={() => 'unproduced'} />,
    );
    const d = dot(container, 0);
    expect(d.getAttribute('data-loading')).toBe('true');
    expect(d.className).toContain('lab-shimmer');
  });

  it('once loaded, an unproduced step reads as its honest status, not loading', () => {
    const { container } = render(
      <PipelineRail {...baseProps} loading={false} displayStatus={() => 'unproduced'} />,
    );
    const d = dot(container, 0);
    expect(d.getAttribute('data-loading')).toBeNull();
    expect(d.getAttribute('data-step-status')).toBe('unproduced');
  });

  it('does NOT mask a locally-known status — a real pass/fail is truth, not loading', () => {
    const { container } = render(
      <PipelineRail {...baseProps} loading displayStatus={(_s, i) => (i === 0 ? 'pass' : 'pending')} />,
    );
    // Step 0 has a real status → no loading treatment; step 1 (pending) shimmers.
    expect(dot(container, 0).getAttribute('data-loading')).toBeNull();
    expect(dot(container, 1).getAttribute('data-loading')).toBe('true');
  });

  it('the tooltip agrees with the shimmer: a loading dot never claims "not produced"', () => {
    // The caller's `tooltipFor` can only see the pre-fetch status, so the rail — which
    // owns the loading knowledge — must not let it contradict the visual.
    const { container } = render(
      <PipelineRail {...baseProps} loading displayStatus={() => 'unproduced'} tooltipFor={() => 'status: unproduced'} />,
    );
    const btn = container.querySelectorAll('[role="listitem"] button')[0] as HTMLElement;
    expect(btn.getAttribute('title')).toBe('Loading server status…');
    expect(btn.getAttribute('aria-label')).toContain('status loading');
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

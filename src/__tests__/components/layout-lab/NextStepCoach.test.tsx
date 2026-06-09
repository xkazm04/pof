import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { NextStepCoach } from '@/components/layout-lab/NextStepCoach';
import { pickNextActionableStep, type StepStatus } from '@/components/layout-lab/nextActionableStep';
import { LIGHT } from '@/components/layout-lab/theme';
import {
  TIER_GLOSSARY, STATUS_GLOSSARY, TERM_GLOSSARY, plainEntitySummary, lookupTerm,
} from '@/components/layout-lab/labGlossary';
import type { EntityRollup } from '@/lib/catalog/rollup';

afterEach(cleanup);

const rollup = (over: Partial<EntityRollup> = {}): EntityRollup => ({
  total: 5, done: 0, deferred: 0, pending: 5, failed: 0,
  highestTier: null, configComplete: false, ...over,
});

const steps = ['Concept', 'Art', 'Attributes', 'Economy', 'Gate'];

describe('pickNextActionableStep', () => {
  it('prefers the first failed step', () => {
    const next = pickNextActionableStep(steps, (_, i) => (i === 2 ? 'fail' : 'pass') as StepStatus);
    expect(next?.step).toBe('Attributes');
    expect(next?.actionWord).toBe('Fix');
  });

  it('falls back to the first pending step when nothing failed', () => {
    const next = pickNextActionableStep(
      steps,
      (_, i) => (i < 2 ? 'pass' : i === 2 ? 'pending' : 'deferred') as StepStatus,
    );
    expect(next?.step).toBe('Attributes');
    expect(next?.status).toBe('pending');
  });

  it('uses "Start here" label only on the very first pending step', () => {
    const allPending = pickNextActionableStep(steps, () => 'pending');
    expect(allPending?.index).toBe(0);
    expect(allPending?.actionWord).toBe('Start here');
  });

  it('falls back to the first deferred step when nothing failed or pending', () => {
    const next = pickNextActionableStep(
      steps,
      (_, i) => (i < 3 ? 'pass' : 'deferred') as StepStatus,
    );
    expect(next?.step).toBe('Economy');
    expect(next?.status).toBe('deferred');
  });

  it('returns null when every step is pass', () => {
    expect(pickNextActionableStep(steps, () => 'pass')).toBeNull();
  });
});

describe('labGlossary', () => {
  it('lookupTerm is case-insensitive and returns null for unknown terms', () => {
    expect(lookupTerm('DRAIN')?.short).toBe('run waiting tests');
    expect(lookupTerm('config-complete')).toEqual(TERM_GLOSSARY['config-complete']);
    expect(lookupTerm('not-a-real-term')).toBeNull();
  });

  it('covers every acceptance status and tier', () => {
    (['pass', 'fail', 'deferred', 'pending'] as const).forEach((s) => {
      expect(STATUS_GLOSSARY[s].plain.length).toBeGreaterThan(10);
    });
    (['L0', 'L1', 'L2', 'L3', 'L4'] as const).forEach((tier) => {
      expect(TIER_GLOSSARY[tier].short.length).toBeGreaterThan(0);
    });
  });

  it('plainEntitySummary celebrates a fully-done entity', () => {
    expect(plainEntitySummary(rollup({ done: 5, pending: 0, configComplete: true }))).toMatch(/all steps are done/i);
  });

  it('plainEntitySummary calls out work remaining when not config-complete', () => {
    const s = plainEntitySummary(rollup({ done: 2, pending: 2, failed: 1, total: 5 }));
    expect(s).toMatch(/2 of 5 done/i);
    expect(s).toMatch(/1 needs a fix/i);
    expect(s).toMatch(/2 not started/i);
  });
});

describe('<NextStepCoach />', () => {
  it('renders the next pending step name and a jump button that calls onJump with its index', () => {
    const onJump = vi.fn();
    const onToggle = vi.fn();
    render(
      <NextStepCoach
        t={LIGHT}
        steps={steps}
        statusByStep={(_, i) => (i < 2 ? 'pass' : 'pending') as StepStatus}
        rollup={rollup({ done: 2, pending: 3 })}
        onJump={onJump}
        plainMode={false}
        onTogglePlainMode={onToggle}
      />,
    );
    expect(screen.getByTestId('next-step-name').textContent).toBe('Attributes');
    fireEvent.click(screen.getByTestId('next-step-jump'));
    expect(onJump).toHaveBeenCalledWith(2);
  });

  it('shows the celebration state when every step has passed', () => {
    render(
      <NextStepCoach
        t={LIGHT}
        steps={steps}
        statusByStep={() => 'pass' as StepStatus}
        rollup={rollup({ done: 5, pending: 0, configComplete: true })}
        onJump={() => {}}
        plainMode={false}
        onTogglePlainMode={() => {}}
      />,
    );
    expect(screen.queryByTestId('next-step-jump')).toBeNull();
    expect(screen.getByText(/all done/i)).toBeTruthy();
  });

  it('is one compact row by default — plain-mode controls live behind the disclosure', () => {
    render(
      <NextStepCoach
        t={LIGHT}
        steps={steps}
        statusByStep={() => 'pending' as StepStatus}
        rollup={rollup()}
        onJump={() => {}}
        plainMode={false}
        onTogglePlainMode={() => {}}
      />,
    );
    // collapsed: the "more" region (and its plain-mode toggle) is not rendered yet.
    expect(screen.queryByTestId('coach-more')).toBeNull();
    expect(screen.queryByTestId('plain-mode-toggle')).toBeNull();
    // expanding reveals it.
    fireEvent.click(screen.getByTestId('coach-expand'));
    expect(screen.getByTestId('coach-more')).toBeTruthy();
    expect(screen.getByTestId('plain-mode-toggle')).toBeTruthy();
  });

  it('expanded: toggling plain mode reveals the plain-language summary line', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <NextStepCoach
        t={LIGHT}
        steps={steps}
        statusByStep={() => 'pending' as StepStatus}
        rollup={rollup()}
        onJump={() => {}}
        plainMode={false}
        onTogglePlainMode={onToggle}
      />,
    );
    fireEvent.click(screen.getByTestId('coach-expand'));
    expect(screen.queryByTestId('plain-summary')).toBeNull();

    fireEvent.click(screen.getByTestId('plain-mode-toggle'));
    expect(onToggle).toHaveBeenCalled();

    rerender(
      <NextStepCoach
        t={LIGHT}
        steps={steps}
        statusByStep={() => 'pending' as StepStatus}
        rollup={rollup()}
        onJump={() => {}}
        plainMode={true}
        onTogglePlainMode={onToggle}
      />,
    );
    // the disclosure stays open across the rerender, so the summary is visible.
    expect(screen.getByTestId('plain-summary').textContent).toMatch(/0 of 5 done|not started/i);
  });

  it('makes the deferred-gate drainer the primary CTA when the next step is deferred', () => {
    const onDrain = vi.fn();
    render(
      <NextStepCoach
        t={LIGHT}
        steps={steps}
        statusByStep={(_, i) => (i < 3 ? 'pass' : 'deferred') as StepStatus}
        rollup={rollup({ done: 3, pending: 0, deferred: 2, total: 5 })}
        onJump={() => {}}
        plainMode={false}
        onTogglePlainMode={() => {}}
        onDrain={onDrain}
        draining={false}
      />,
    );
    // a deferred next step can't be hand-edited — the CTA drains live gates instead of jumping.
    expect(screen.queryByTestId('next-step-jump')).toBeNull();
    fireEvent.click(screen.getByTestId('next-step-drain'));
    expect(onDrain).toHaveBeenCalled();
  });
});

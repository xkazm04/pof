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
  // Fixtures here are never-produced steps unless a case says otherwise: unproduced follows pending.
  unproduced: over.pending ?? 5,
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

  it('still says "All done." when every pass is backed by an audited fact', () => {
    render(
      <NextStepCoach
        t={LIGHT}
        steps={steps}
        statusByStep={() => 'pass' as StepStatus}
        rollup={rollup({ done: 5, pending: 0, configComplete: true })}
        onJump={() => {}}
        plainMode={false}
        onTogglePlainMode={() => {}}
        doneProvenance={{
          total: 5, solid: 5, weak: 0, shapeOnly: 0, unjudged: 0, unwired: 0, unaudited: 0, weakest: null,
        }}
      />,
    );
    expect(screen.getByTestId('coach-done').getAttribute('data-verified')).toBe('true');
    expect(screen.getByText(/all done/i)).toBeTruthy();
    expect(screen.queryByTestId('coach-weakest-jump')).toBeNull();
  });

  it('refuses to celebrate when the passes rest on shape-only checkers, and offers the weakest step', () => {
    const onJump = vi.fn();
    render(
      <NextStepCoach
        t={LIGHT}
        steps={steps}
        statusByStep={() => 'pass' as StepStatus}
        rollup={rollup({ done: 5, pending: 0, configComplete: true })}
        onJump={onJump}
        plainMode={false}
        onTogglePlainMode={() => {}}
        doneProvenance={{
          total: 5, solid: 1, weak: 4, shapeOnly: 4, unjudged: 2, unwired: 0, unaudited: 0,
          weakest: { step: 'Art', index: 1, reason: 'its checker only checks shape, not content' },
        }}
      />,
    );
    const done = screen.getByTestId('coach-done');
    expect(done.getAttribute('data-verified')).toBe('false');
    expect(screen.queryByText(/^All done\.$/)).toBeNull();
    expect(done.textContent).toContain('4 of 5');
    expect(screen.getByTestId('coach-done-detail').textContent).toContain('Art');

    fireEvent.click(screen.getByTestId('coach-weakest-jump'));
    expect(onJump).toHaveBeenCalledWith(1);
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

  it('surfaces the concrete checker reason for a failed next step (verbatim, over the generic hint)', () => {
    render(
      <NextStepCoach
        t={LIGHT}
        steps={steps}
        statusByStep={(_, i) => (i === 2 ? 'fail' : 'pass') as StepStatus}
        rollup={rollup({ done: 4, failed: 1, pending: 0, total: 5 })}
        onJump={() => {}}
        plainMode={false}
        onTogglePlainMode={() => {}}
        reasonForStep={(s) => (s === 'Attributes' ? 'price/power 1.43x out of band' : undefined)}
      />,
    );
    expect(screen.getByTestId('next-step-reason').textContent).toContain('price/power 1.43x out of band');
  });

  it('keeps the generic hint when no reason is available for the next step (never invents text)', () => {
    render(
      <NextStepCoach
        t={LIGHT}
        steps={steps}
        statusByStep={(_, i) => (i < 2 ? 'pass' : 'unproduced') as StepStatus}
        rollup={rollup({ done: 2, pending: 3 })}
        onJump={() => {}}
        plainMode={false}
        onTogglePlainMode={() => {}}
        reasonForStep={() => undefined}
      />,
    );
    // unproduced step, no reason → the plain-language hint stays.
    expect(screen.getByTestId('next-step-reason').textContent).toMatch(/not been produced yet/i);
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

describe('<NextStepCoach /> — the settling act (pipeline-acceptance-engine/B)', () => {
  const dialog = ['VO Script', 'Subtitles & Choices UI', 'Test Gate'];
  const dialogVerdicts: Record<string, { status: string; tier?: string; reason?: string }> = {
    'VO Script': { status: 'pending', tier: 'L0', reason: 'UNGRADED: content invariant "dialog-vo-line-length" is PoF law and is not law under canon profile "diablo1"' },
    'Subtitles & Choices UI': { status: 'pending', tier: 'L0', reason: 'SOURCED: seeded from Diablo I town dialog' },
    'Test Gate': { status: 'deferred', tier: 'L3' },
  };

  it('counts only the gates the live drain can settle: "Run 3 deferred gates", not 4', () => {
    const tiers = ['L2', 'L3', 'L4', undefined];
    const gates = ['Rules', 'Live', 'Look', 'Untiered'];
    render(
      <NextStepCoach
        t={LIGHT}
        steps={gates}
        statusByStep={() => 'deferred' as StepStatus}
        verdictOf={(s) => { const tier = tiers[gates.indexOf(s)]; return { status: 'deferred', ...(tier ? { tier } : {}) }; }}
        rollup={rollup({ done: 0, pending: 0, deferred: 4, total: 4 })}
        onJump={() => {}}
        plainMode={false}
        onTogglePlainMode={() => {}}
        onDrain={() => {}}
        draining={false}
      />,
    );
    // The L2 pick is settled by the settle passes, so the primary CTA jumps instead of draining.
    expect(screen.queryByTestId('next-step-drain')).toBeNull();
    fireEvent.click(screen.getByTestId('coach-expand'));
    expect(screen.getByTestId('coach-drain').textContent).toBe('Run 3 deferred gates');
    expect(screen.queryByText(/Run 4 deferred gates/)).toBeNull();
  });

  it("names the pick's settling act and lists the row nothing here can settle", () => {
    render(
      <NextStepCoach
        t={LIGHT}
        steps={dialog}
        statusByStep={(s) => dialogVerdicts[s].status as StepStatus}
        verdictOf={(s) => dialogVerdicts[s] ?? null}
        rollup={rollup({ done: 0, pending: 2, unproduced: 0, deferred: 1, total: 3 })}
        onJump={() => {}}
        plainMode={false}
        onTogglePlainMode={() => {}}
      />,
    );
    expect(screen.getByTestId('next-step-name').textContent).toBe('Subtitles & Choices UI');
    expect(screen.getByTestId('next-step-reason').textContent).toMatch(/seeded from a reference/i);
    fireEvent.click(screen.getByTestId('coach-expand'));
    const list = screen.getByTestId('coach-unsettleable');
    expect(list.textContent).toMatch(/nothing here can settle/i);
    expect(list.textContent).toContain('UNGRADED');
    expect(list.textContent).toContain('VO Script');
  });
});

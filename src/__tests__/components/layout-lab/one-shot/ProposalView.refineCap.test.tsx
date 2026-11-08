import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

/**
 * The refine box states the SAME turn cap the job store enforces (`incRefinementTurn`), read
 * from the store's exported constant — not a second, hand-typed `3`. Proven by moving the
 * constant: a view that re-typed the cap keeps disabling the box at 3 turns and printing
 * "(3/3 used)" while the store would still accept the next refine.
 */
vi.mock('@/stores/oneShotJobStore', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/stores/oneShotJobStore')>();
  return { ...real, REFINEMENT_TURN_CAP: 5 };
});

const { ProposalView } = await import('@/components/layout-lab/one-shot/ProposalView');
const { useOneShotJobStore } = await import('@/stores/oneShotJobStore');
const { LIGHT } = await import('@/components/layout-lab/theme');

const proposal = { name: 'Ember Wand', rationale: 'fills the caster gap', data: {} } as Parameters<typeof ProposalView>[0]['proposal'];

beforeEach(() => { useOneShotJobStore.getState().reset(); });
afterEach(cleanup);

describe('ProposalView — refine cap reads the store constant', () => {
  it('3 turns used of a 5-turn cap: the box stays open and the label names 5', () => {
    render(<ProposalView t={LIGHT} proposal={proposal} refinementTurns={3} onRefine={() => {}} onApprove={() => {}} />);
    expect(screen.getByText(/Refine direction/).textContent).toContain('(3/5 used)');
    const box = screen.getByLabelText(/Refine direction/) as HTMLTextAreaElement;
    expect(box.disabled).toBe(false);
    expect(screen.queryByText(/Force more refinements/)).toBeNull();
  });

  it('at the store cap the box closes and offers Force more', () => {
    render(<ProposalView t={LIGHT} proposal={proposal} refinementTurns={5} onRefine={() => {}} onApprove={() => {}} />);
    expect((screen.getByLabelText(/Refine direction/) as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getByText(/Force more refinements/)).toBeTruthy();
  });
});

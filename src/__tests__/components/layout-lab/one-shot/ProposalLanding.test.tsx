/**
 * pipeline-step-components/B — ProposalView shows where the proposal lands (on/off target) at
 * the 'Run pipeline' spend gate, and an off-target proposal is correctable in one click.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/components/layout-lab/steps/shared/useDispatchPlan', () => ({ useDispatchPlan: () => null }));

import '@/lib/catalog/pipelines/registry.generated';
import { ProposalView } from '@/components/layout-lab/one-shot/ProposalView';
import { useOneShotJobStore, type OneShotProposal } from '@/stores/oneShotJobStore';
import { proposalLanding, refineToTargetDirection } from '@/lib/catalog/gap-analysis/landing';
import type { CatalogDistribution } from '@/lib/catalog/gap-analysis';
import { LIGHT } from '@/components/layout-lab/theme';

const D: CatalogDistribution = {
  catalogId: 'characters',
  total: 10,
  byAttribute: { rarity: { Common: 6, Rare: 2, Uncommon: 2 }, type: { Weapon: 10 } },
  underrepresented: [{ attribute: 'rarity', value: 'Rare', count: 2, expected: 4 }],
  sample: [],
};
const TARGET = { catalogId: 'characters', attribute: 'rarity', value: 'Rare', count: 2, expected: 4, deficit: 2 };
const OFF: OneShotProposal = { name: 'Plain Blade', rationale: 'a sword', data: { rarity: 'Common', type: 'Weapon' } };

function renderView(turns = 0, proposal = OFF) {
  const onRefine = vi.fn();
  const onApprove = vi.fn();
  render(<ProposalView t={LIGHT} proposal={proposal} refinementTurns={turns} onRefine={onRefine} onApprove={onApprove} />);
  return { onRefine, onApprove };
}

describe('ProposalView — proposal landing at the spend gate', () => {
  beforeEach(() => {
    useOneShotJobStore.setState({ catalogId: 'characters', distribution: D, target: TARGET, stepModeOverrides: {} });
  });
  afterEach(() => { cleanup(); useOneShotJobStore.getState().reset(); });

  it("case 7: an off-target proposal reads 'off target'; 'Refine to target' sends the derived direction once; capped at 3 turns", () => {
    const { onRefine } = renderView(0);
    const panel = screen.getByTestId('proposal-landing');
    expect(panel.textContent).toMatch(/off target/i);
    fireEvent.click(within(panel).getByRole('button', { name: /refine to target/i }));
    const expected = refineToTargetDirection(proposalLanding(D, OFF.data, TARGET));
    expect(onRefine).toHaveBeenCalledTimes(1);
    expect(onRefine).toHaveBeenCalledWith(expected, false);
    cleanup();

    renderView(3);
    const capped = within(screen.getByTestId('proposal-landing')).getByRole('button', { name: /refine to target/i }) as HTMLButtonElement;
    expect(capped.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(capped.disabled).toBe(false);
  });

  it('case 7b: an on-target proposal reads on target with its before → after, and offers no refine-to-target', () => {
    renderView(0, { ...OFF, data: { rarity: 'Rare', type: 'Weapon' } });
    const panel = screen.getByTestId('proposal-landing');
    expect(panel.textContent).toMatch(/on target/i);
    expect(panel.textContent).toMatch(/2\s*→\s*3/);
    expect(within(panel).queryByRole('button', { name: /refine to target/i })).toBeNull();
  });

  it("case 8 [guard]: off target still runs — 'Run pipeline' calls onApprove once and keeps the model-dispatch suffix", () => {
    const { onApprove } = renderView(0);
    const run = screen.getByRole('button', { name: /run pipeline/i });
    expect(run.textContent).toMatch(/ · \d+ model dispatch(es)?/);
    fireEvent.click(run);
    expect(onApprove).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { ProposalIssues } from '@/components/layout-lab/one-shot/ProposalIssues';
import { issueRefineDirection } from '@/lib/one-shot/proposal-issues';
import { LIGHT } from '@/components/layout-lab/theme';

const ISSUES = [
  { field: 'rarity', message: 'rarity must be one of Common' },
  { field: 'type', message: "required field 'type' is missing" },
];

describe('ProposalIssues', () => {
  afterEach(cleanup);

  it('renders one row per issue and a Fix button that refines with the derived direction', () => {
    const onRefine = vi.fn();
    render(<ProposalIssues t={LIGHT} issues={ISSUES} refineDisabled={false} forceMore={false} onRefine={onRefine} />);
    expect(screen.getByTestId('proposal-issue-rarity')).toBeTruthy();
    expect(screen.getByTestId('proposal-issue-type')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fix 2 issues' }));
    expect(onRefine).toHaveBeenCalledWith(issueRefineDirection(ISSUES), false);
  });

  it('disables the button at the cap', () => {
    render(<ProposalIssues t={LIGHT} issues={ISSUES} refineDisabled forceMore={false} onRefine={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Fix 2 issues' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders nothing without issues', () => {
    const { container } = render(<ProposalIssues t={LIGHT} issues={[]} refineDisabled={false} forceMore={false} onRefine={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});

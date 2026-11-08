/**
 * The chip's visible label ("idle", "1 running", "unknown"…) sits inside a button whose
 * aria-label is the fixed question "What is running right now". An aria-label replaces the
 * descendant text, so the button's name never carried the answer — the same defect the
 * bridge strip beside it had (fixed in 5f1b78b2).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchDrainLease: vi.fn(async () => ({ held: false, scope: null, since: null, scopes: [] })),
}));

import { ActivityChip } from '@/components/layout-lab/ActivityChip';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabRunnerStore } from '@/components/layout-lab/labRunnerStore';

describe('ActivityChip button names what is running', () => {
  afterEach(cleanup);
  beforeEach(() => { useLabRunnerStore.setState({ runs: {}, localDrain: null }); });

  it('the accessible name includes the label the chip shows', async () => {
    render(<ActivityChip t={LIGHT} />);
    const chip = screen.getByTestId('lab-activity-chip');
    const shown = chip.querySelector('[role="status"]')?.textContent ?? '';
    expect(shown.length).toBeGreaterThan(0);
    const name = chip.getAttribute('aria-label') ?? '';
    expect(name).toMatch(/what is running right now/i);
    expect(name).toContain(shown);
  });
});

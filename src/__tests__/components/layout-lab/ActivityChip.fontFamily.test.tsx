/**
 * `LabTheme.fontMono` is a next/font CLASS NAME, not a font-family. The activity panel put it
 * in `style.fontFamily` at three sites (lane state word, lane title, blind-spot footnote), so
 * the browser read a class hash as a family name, matched nothing, and those lines fell back
 * to the inherited body face. Every other lab surface uses `var(--lab-font-mono)` in a style
 * (or `className={t.fontMono}`).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-class-hash', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchDrainLease: vi.fn(async () => ({ held: false, scope: null, since: null, scopes: [] })),
}));

import { ActivityChip } from '@/components/layout-lab/ActivityChip';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabRunnerStore } from '@/components/layout-lab/labRunnerStore';

describe('ActivityChip panel sets real font families', () => {
  afterEach(cleanup);
  beforeEach(() => { useLabRunnerStore.setState({ runs: {}, localDrain: null }); });

  it('no inline font-family in the panel is a font class name', async () => {
    render(<ActivityChip t={LIGHT} />);
    fireEvent.click(screen.getByTestId('lab-activity-chip'));
    const panel = await screen.findByTestId('lab-activity-panel');
    const families = Array.from(panel.querySelectorAll<HTMLElement>('*'))
      .map((el) => el.style.fontFamily)
      .filter(Boolean);
    expect(families.length).toBeGreaterThan(0);
    expect(families.filter((f) => f.includes('font-class-hash'))).toEqual([]);
    for (const f of families) expect(f).toBe('var(--lab-font-mono)');
  });
});

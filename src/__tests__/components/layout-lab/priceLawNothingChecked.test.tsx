import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { PriceLawPanel } from '@/components/layout-lab/steps/ux/PriceLawPanel';
import { checkPriceLaw } from '@/components/layout-lab/steps/ux/economyPriceLaw';
import { LAB_THEMES } from '@/components/layout-lab/theme';

/**
 * The Price law panel's agreement line must not certify agreement it never checked. An Economy
 * cell whose figures the law cannot derive (no law block, no breakdown, no ratio) leaves zero
 * terms at `agrees`/`contradicts`; the line used to read "✓ All 0 stored figures the law can
 * check agree with it." — a green tick over an empty set.
 */

const t = LAB_THEMES[0];
afterEach(cleanup);

describe('PriceLawPanel — nothing checkable', () => {
  it('a cell with no checkable figure says so instead of ticking "All 0 agree"', () => {
    const r = checkPriceLaw({ economy: {} });
    expect(r.terms.filter((x) => x.verdict === 'agrees' || x.verdict === 'contradicts')).toHaveLength(0);
    render(<PriceLawPanel t={t} r={r} seeded={false} onSeed={() => {}} />);
    const line = screen.getByTestId('price-law-agreement').textContent ?? '';
    expect(line).not.toContain('✓');
    expect(line).not.toMatch(/All 0/);
    expect(line).toBe('No stored figure on this cell can be checked against the law.');
  });

  it('a cell with checkable figures keeps the agreement count', () => {
    const r = checkPriceLaw({ economy: { powerScore: 10, powerBreakdown: { dpsPower: 5, implicitAccuracyPower: 2, affixPower: 3 } } });
    render(<PriceLawPanel t={t} r={r} seeded={false} onSeed={() => {}} />);
    expect(screen.getByTestId('price-law-agreement').textContent).toBe('✓ All 1 stored figures the law can check agree with it.');
  });
});

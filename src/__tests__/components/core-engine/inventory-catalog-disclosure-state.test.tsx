import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { AffixSlotPanels } from '@/components/modules/core-engine/sub_inventory/catalog/AffixSlotPanels';
import { SetBonusSection } from '@/components/modules/core-engine/sub_inventory/catalog/SetBonusSection';
import { ITEM_SETS } from '@/components/modules/core-engine/sub_inventory/_shared/data';

afterEach(cleanup);

/**
 * Disclosure and toggle buttons expose their state to assistive tech
 * (WCAG 4.1.2): a collapsible header carries aria-expanded, a filter toggle
 * aria-pressed — and the affix header keeps a visible focus indicator.
 */
describe('catalog disclosures expose state', () => {
  it('affix definitions header: aria-expanded flips, focus ring kept', () => {
    render(<AffixSlotPanels featureMap={new Map()} />);
    const btn = screen.getByText('Affix System Definitions').closest('button')!;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.className).not.toMatch(/(^|\s)focus:outline-none(\s|$)/);
    expect(btn.className).toContain('focus-ring-inset');
  });

  it('set headers carry aria-expanded; filters carry aria-pressed', () => {
    render(<SetBonusSection />);
    const first = screen.getByText(ITEM_SETS[0].name).closest('button')!;
    expect(first.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(first);
    expect(first.getAttribute('aria-expanded')).toBe('false');

    const all = screen.getByText('All').closest('button')!;
    const complete = screen.getByText('Complete').closest('button')!;
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(complete.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(complete);
    expect(complete.getAttribute('aria-pressed')).toBe('true');
  });
});

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));

import { TradingCard } from '@/components/modules/core-engine/sub_inventory/catalog/TradingCard';

afterEach(cleanup);

/**
 * ItemData.rarity is a free string (catalog entries arrive from seeds, Add Item and
 * generators). Every other rarity colour lookup in the catalog falls back to a
 * neutral token; the trading card did not, so an off-ladder rarity painted
 * `undefined26`-style colours — invalid CSS, so its border/badge/header vanished.
 */
describe('TradingCard with an off-ladder rarity', () => {
  it('paints no "undefined" colour', () => {
    const item: ItemData = {
      id: 'm', name: 'Odd Relic', type: 'Accessory', subtype: 'Ring', rarity: 'Mythic',
      stats: [{ label: 'Power', value: '9', numericValue: 9, maxValue: 10 }], description: 'odd',
    };
    const { container, getByText } = render(<TradingCard item={item} />);
    const styles = Array.from(container.querySelectorAll<HTMLElement>('[style]')).map((el) => el.getAttribute('style') ?? '');
    expect(styles.filter((s) => s.includes('undefined'))).toEqual([]);
    // jsdom silently DROPS an invalid colour, so also assert the badge got a real one.
    const badge = getByText('PWR').parentElement!;
    expect(badge.style.color).not.toBe('');
    expect(badge.style.borderColor).not.toBe('');
  });
});

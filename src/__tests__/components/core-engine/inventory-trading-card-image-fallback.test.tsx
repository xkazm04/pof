import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';

vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string; onError?: () => void }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.src} alt={p.alt} onError={p.onError} />
  ),
}));

import { TradingCard } from '@/components/modules/core-engine/sub_inventory/catalog/TradingCard';

afterEach(cleanup);

const item: ItemData = {
  id: 'user-frost-blade-x', name: 'Frost Blade', type: 'Weapon', subtype: 'Sword', rarity: 'Rare',
  stats: [{ label: 'Damage', value: '9', numericValue: 9, maxValue: 10 }], description: 'cold',
  imagePath: '/items/frost-blade-x.webp',
};

/**
 * Add Item sets imagePath before the CLI has written the file; the card must fall back to the
 * same Package placeholder an image-less item gets, not a broken image.
 */
describe('TradingCard image that does not load', () => {
  it('renders the image while it has not failed', () => {
    const { container } = render(<TradingCard item={item} />);
    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelector('svg.lucide-package')).toBeNull();
  });

  it('swaps to the Package placeholder when the image errors', () => {
    const { container } = render(<TradingCard item={item} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });
});

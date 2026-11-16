import { describe, it, expect } from 'vitest';
import { itemSlug } from '@/components/modules/core-engine/sub_inventory/catalog/createItemPrompt';

/**
 * Add Item derives the icon file name (public/items/<slug>.webp) from the item name.
 * Two items with the same name must not share one file, and a symbols-only name must
 * not produce an empty slug ("/items/.webp").
 */
describe('itemSlug', () => {
  it('gives same-named items distinct file slugs', () => {
    expect(itemSlug('Frost Blade', 'aaa')).not.toBe(itemSlug('Frost Blade', 'bbb'));
  });

  it('is never empty for a symbols-only name', () => {
    const slug = itemSlug('!!!', 'aaa');
    expect(slug.length).toBeGreaterThan(0);
    expect(`/items/${slug}.webp`).not.toBe('/items/.webp');
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('keeps the readable name part for ordinary names', () => {
    expect(itemSlug('Frost Blade', 'aaa')).toBe('frost-blade-aaa');
  });
});

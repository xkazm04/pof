import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CraftingRecipeSection } from '@/components/modules/core-engine/sub_inventory/economy/CraftingRecipeSection';

/**
 * scan-sweep inventory-genome-economy: the crafting card is a static preview. Its
 * "Simulate 100 Crafts" button had `onClick={() => { }}` with a pointer cursor and
 * hover state, so it looked and announced as a working action and did nothing.
 */

afterEach(cleanup);

describe('CraftingRecipeSection static action', () => {
  it('the unimplemented Simulate action is disabled, not a silent no-op', () => {
    render(<CraftingRecipeSection />);
    const btn = screen.getByRole('button', { name: /Simulate 100 Crafts/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.className.includes('cursor-pointer')).toBe(false);
  });
});

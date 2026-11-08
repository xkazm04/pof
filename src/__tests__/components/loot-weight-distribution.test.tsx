import { describe, it, expect, afterEach, vi } from 'vitest';
import type React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { WeightDistribution } from '@/components/modules/core-engine/sub_loot/core/WeightDistribution';

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

afterEach(cleanup);

const legendButton = (root: HTMLElement, name: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes(name))!;

// RARITY_TIERS weights split a DROP by rarity; they say nothing about drop chance per
// kill. The drill-down's count is therefore per 100 drops, and must not claim kills.
describe('WeightDistribution drill-down', () => {
  it('labels the rarity count per 100 drops, not per 100 kills', () => {
    const { container } = render(<WeightDistribution />);
    fireEvent.click(legendButton(container, 'Legendary'));
    expect(container.textContent).toContain('Avg per 100 drops');
    expect(container.textContent).not.toContain('per 100 kills');
  });

});

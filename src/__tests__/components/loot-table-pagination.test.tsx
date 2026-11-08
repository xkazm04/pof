import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import type { SetStateAction } from 'react';
import { LootTablePagination } from '@/components/modules/core-engine/sub_loot/affix/LootTablePagination';

afterEach(cleanup);

// The editor clamps a stale `page` to `safePage` for display (deleting rows shrinks
// totalPages without resetting page). The buttons must step from what is SHOWN, or
// Prev decrements the hidden stale page and the view does not move.
function resolve(arg: SetStateAction<number>, rawPage: number): number {
  return typeof arg === 'function' ? arg(rawPage) : arg;
}

describe('LootTablePagination steps from the displayed page', () => {
  it('Prev from displayed page 2/2 lands on page 1 even when the raw page is stale', () => {
    const setPage = vi.fn();
    const { container } = render(<LootTablePagination safePage={1} totalPages={2} totalCount={30} setPage={setPage} />);
    const [prev] = Array.from(container.querySelectorAll('button'));
    fireEvent.click(prev);
    // raw page left at 4 after rows were deleted; the view shows page index 1
    expect(resolve(setPage.mock.calls[0][0], 4)).toBe(0);
  });

  it('Next from displayed page 1/2 lands on page 2', () => {
    const setPage = vi.fn();
    const { container } = render(<LootTablePagination safePage={0} totalPages={2} totalCount={30} setPage={setPage} />);
    const buttons = Array.from(container.querySelectorAll('button'));
    fireEvent.click(buttons[1]);
    expect(resolve(setPage.mock.calls[0][0], 0)).toBe(1);
  });
});

/**
 * A craft prepends one log entry; the rows that were already on screen must keep
 * their DOM nodes (stable keys) rather than remount because their index shifted.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CraftLogSection } from '@/components/modules/core-engine/sub_loot/affix-workbench/CraftLogSection';
import type { CraftLogEntry } from '@/components/modules/core-engine/sub_loot/affix-workbench/types';

afterEach(() => cleanup());

// Newest first, as the kernel prepends; every entry shares timestamp 0 like a test clock-less run.
const entries = (n: number): CraftLogEntry[] => Array.from({ length: n }, (_, i) => ({
  action: 'augment' as const, timestamp: 1000 + (n - 1 - i), spent: { exalted: 1 }, success: true, detail: `craft ${n - i}`,
}));
const rows = (root: HTMLElement) => [...root.querySelectorAll('div.flex.gap-2.text-xs.font-mono')];

describe('CraftLogSection — row identity across one more craft', () => {
  it('keeps 7 of the 8 visible rows mounted when a 9th craft is prepended', () => {
    const { container, rerender } = render(<CraftLogSection craftLog={entries(8)} avgCraftCost={null} craftCount={8} />);
    const before = rows(container);
    expect(before.length).toBe(8);
    rerender(<CraftLogSection craftLog={entries(9)} avgCraftCost={null} craftCount={9} />);
    const after = rows(container);
    expect(after.length).toBe(8);
    const kept = after.filter((el) => before.includes(el)).length;
    expect(kept).toBe(7);
  });
});

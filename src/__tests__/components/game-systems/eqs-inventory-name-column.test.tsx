/**
 * eqs-squad-combat-spatial — a UPROPERTY name must fit its column in the
 * inventory's description list. jsdom has no layout, so width is the same
 * arithmetic the finding used: chars x 0.6em at the 10px mono size = 6px each.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { EQSComponentInventory } from '@/components/modules/game-systems/EQSComponentInventory';

afterEach(cleanup);

const MONO_PX_PER_CHAR = 6;
const classWidthPx = (cls: string): number | null => {
  const arbitrary = /(?:^|\s)w-\[(\d+)px\]/.exec(cls);
  if (arbitrary) return Number(arbitrary[1]);
  const scale = /(?:^|\s)w-(\d+)(?:\s|$)/.exec(cls);
  return scale ? Number(scale[1]) * 4 : null;
};

describe('EQSComponentInventory description name column', () => {
  it('every property name fits its column, or wraps instead of overrunning', () => {
    const { container } = render(<EQSComponentInventory />);
    const nameSpans = Array.from(
      container.querySelectorAll<HTMLElement>('div.flex.gap-2.items-start > span.font-mono.shrink-0'),
    );
    expect(nameSpans.length).toBeGreaterThan(20);
    const overruns = nameSpans.filter((el) => {
      const cls = el.getAttribute('class') ?? '';
      const width = classWidthPx(cls);
      const wraps = /\b(break-all|break-words|truncate)\b/.test(cls);
      return width === null || (!wraps && (el.textContent ?? '').length * MONO_PX_PER_CHAR > width);
    });
    expect(overruns.map((el) => el.textContent)).toEqual([]);
  });

  it('the name column is as wide as the property table above it (120px)', () => {
    const { container } = render(<EQSComponentInventory />);
    const el = container.querySelector<HTMLElement>('div.flex.gap-2.items-start > span.font-mono.shrink-0')!;
    expect(classWidthPx(el.getAttribute('class') ?? '')).toBe(120);
  });
});

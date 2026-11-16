import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ComparisonRow } from '@/components/modules/core-engine/sub_character/ai-feel/ComparisonRow';
import type { FeelComparison } from '@/lib/character-feel-optimizer';

afterEach(() => cleanup());

/* The A/B bars must stay inside 0..100%. A resolved stack (a 'set' or a large
 * negative 'pct' layer) can push a value below FEEL_FIELD_META's min, and a
 * negative CSS width is invalid — the bar silently vanishes. ValueRow already
 * clamps both ends; this row must agree. */

function item(valueA: number, valueB: number): FeelComparison {
  return {
    field: 'movement.maxWalkSpeed', label: 'Walk Speed', category: 'Movement', unit: 'cm/s',
    valueA, valueB, delta: valueB - valueA, deltaPct: 0,
  };
}

function barWidths(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div.absolute.top-0.left-0'))
    .map((el) => el.style.width);
}

describe('ComparisonRow bar widths', () => {
  it('clamps a value below the field min to 0% instead of a negative width', () => {
    // Walk Speed meta range is 200..600; 100 is below min.
    const { container } = render(<ComparisonRow item={item(100, 400)} colorA="red" colorB="blue" />);
    const widths = barWidths(container);
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBe('0%');
    expect(widths[1]).toBe('50%');
  });

  it('clamps a value above the field max to 100%', () => {
    const { container } = render(<ComparisonRow item={item(400, 900)} colorA="red" colorB="blue" />);
    expect(barWidths(container)).toEqual(['50%', '100%']);
  });
});

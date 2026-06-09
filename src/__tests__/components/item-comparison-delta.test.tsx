/**
 * Stat delta indicators in item comparison.
 *
 * The Item Comparison panel must not rely on bar colour alone: every stat value
 * carries an explicit numeric delta (+5 / -3 vs the best) and a direction glyph,
 * and the strongest item overall gets a winner marker.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ItemComparisonPanel } from '@/components/modules/core-engine/sub_inventory/catalog/ItemComparisonPanel';
import { buildComparison, formatDelta, describeDelta } from '@/components/modules/core-engine/sub_inventory/catalog/itemComparison';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';

afterEach(cleanup);

const item = (id: string, name: string, stats: ItemData['stats']): ItemData => ({
  id, name, type: 'Weapon', subtype: 'Sword', rarity: 'Common', stats, description: `${name} desc`,
});

const SWORD_A = item('a', 'Alpha Blade', [
  { label: 'Damage', value: '18', numericValue: 18, maxValue: 50 },
  { label: 'Speed', value: '0.8s', numericValue: 80, maxValue: 100 },
]);
const SWORD_B = item('b', 'Beta Blade', [
  { label: 'Damage', value: '15', numericValue: 15, maxValue: 50 },
  { label: 'Speed', value: '1.2s', numericValue: 48, maxValue: 100 },
]);

describe('buildComparison (pure model)', () => {
  it('returns empty when fewer than two items', () => {
    expect(buildComparison([SWORD_A])).toEqual({ rows: [], winnerIndex: -1, winCounts: [] });
  });

  it('computes signed deltas vs the best of the other items (2 items)', () => {
    const { rows } = buildComparison([SWORD_A, SWORD_B]);
    const dmg = rows.find(r => r.label === 'Damage')!;
    expect(dmg.values[0].delta).toBe(3);   // 18 leads 15 by +3
    expect(dmg.values[1].delta).toBe(-3);  // 15 trails 18 by -3
    expect(dmg.values[0].isLeader).toBe(true);
    expect(dmg.values[1].isTrailing).toBe(true);
  });

  it('marks a tie for best as delta 0 and not a leader (3 items)', () => {
    const tieC = item('c', 'Gamma', [{ label: 'Damage', value: '18', numericValue: 18, maxValue: 50 }]);
    const { rows } = buildComparison([SWORD_A, tieC, SWORD_B]);
    const dmg = rows[0];
    expect(dmg.values[0].delta).toBe(0);
    expect(dmg.values[0].isBest).toBe(true);
    expect(dmg.values[0].isLeader).toBe(false);
    expect(dmg.values[2].delta).toBe(-3);
  });

  it('picks the unique strongest item as winner, -1 when the lead is shared', () => {
    expect(buildComparison([SWORD_A, SWORD_B]).winnerIndex).toBe(0); // wins both rows
    const tie = buildComparison([SWORD_A, item('c', 'Clone', SWORD_A.stats)]);
    expect(tie.winnerIndex).toBe(-1); // identical stats → ambiguous
  });

  it('treats an all-zero row as having no meaningful comparison', () => {
    const z1 = item('z1', 'Z1', [{ label: 'X', value: '—', numericValue: 0, maxValue: 0 }]);
    const z2 = item('z2', 'Z2', [{ label: 'X', value: '—', numericValue: 0, maxValue: 0 }]);
    const v = buildComparison([z1, z2]).rows[0].values[0];
    expect(v.hasComparison).toBe(false);
    expect(formatDelta(v)).toBe('');
    expect(describeDelta(v)).toBe('');
  });

  it('formatDelta renders compact signed labels', () => {
    const { rows } = buildComparison([SWORD_A, SWORD_B]);
    const dmg = rows.find(r => r.label === 'Damage')!;
    expect(formatDelta(dmg.values[0])).toBe('+3');
    expect(formatDelta(dmg.values[1])).toBe('-3');
  });
});

describe('ItemComparisonPanel renders delta indicators', () => {
  function setupTwoSwords() {
    const result = render(<ItemComparisonPanel items={[SWORD_A, SWORD_B]} />);
    // choose the Weapon category, then pick both swords
    fireEvent.click(result.getByText('Weapon'));
    const selects = result.container.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'a' } });
    fireEvent.change(selects[1], { target: { value: 'b' } });
    return result;
  }

  it('shows explicit +/- deltas alongside the absolute values', () => {
    const { container } = setupTwoSwords();
    const text = container.textContent ?? '';
    expect(text).toContain('+3');   // Alpha Damage lead
    expect(text).toContain('-3');   // Beta Damage gap
  });

  it('surfaces a winner marker on the strongest item overall', () => {
    const { getByLabelText } = setupTwoSwords();
    expect(getByLabelText(/best overall/i)).toBeTruthy();
  });

  it('adds a screen-reader description so standing is not colour-only', () => {
    const { container } = setupTwoSwords();
    const srText = Array.from(container.querySelectorAll('.sr-only')).map(n => n.textContent ?? '');
    expect(srText.some(t => /ahead of next|behind best|tied/i.test(t))).toBe(true);
  });
});

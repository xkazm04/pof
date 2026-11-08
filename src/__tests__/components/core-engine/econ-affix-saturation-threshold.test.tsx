import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AffixTab } from '@/components/modules/core-engine/sub_inventory/economy-simulator/AffixAlertsTabs';
import { economyVerdicts } from '@/lib/economy/item-economy-verdicts';
import { runItemEconomySim, DEFAULT_ITEM_ECON_CONFIG, type ItemEconomyResult } from '@/lib/economy/item-economy-engine';
import { STATUS_WARNING } from '@/lib/chart-colors';

afterEach(cleanup);

/** jsdom normalises inline hex colours to rgb(). */
function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function withPool(pool: Record<string, number>): ItemEconomyResult {
  const base = runItemEconomySim({ ...DEFAULT_ITEM_ECON_CONFIG, playerCount: 20, maxHours: 20 });
  return { ...base, globalAffixSaturation: pool };
}

function labelColor(container: HTMLElement, label: string): string {
  const span = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === label);
  if (!span) throw new Error(`no row for ${label}`);
  return span.style.color;
}

describe('Global Affix Distribution saturation flag', () => {
  it('flags a stat as saturated on the same threshold the modifier-saturation verdict uses', () => {
    const result = withPool({ alpha: 0.17, beta: 0.25 });
    const verdict = economyVerdicts(result).find((v) => v.family === 'modifier-saturation')!;
    const { container } = render(<AffixTab result={result} saturationThreshold={verdict.threshold} />);
    // 17% is under the 20% verdict threshold: it must not be painted as a warning.
    expect(labelColor(container, 'alpha')).not.toBe(rgbOf(STATUS_WARNING));
    // 25% is over it: painted as a warning.
    expect(labelColor(container, 'beta')).toBe(rgbOf(STATUS_WARNING));
  });
});

import { describe, it, expect, vi } from 'vitest';

// Importing the step registry pulls bespoke step components that touch
// next/font/google at module scope — stub it so the import resolves headless.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import {
  expectedPrice,
  priceRatio,
  priceInBand,
  powerInBand,
  ITEM_STEP_SPECS,
} from '@/components/layout-lab/steps/itemsSteps';

/**
 * The Economy View badge (in-band / OUTLIER) and the derived Economy Acceptance
 * gate must read ONE price/power formula. They previously rounded the expected
 * price differently (gate: cost / (power * 1.4); view: cost / Math.round(power * 1.4)),
 * so at a band edge the badge could contradict the gate. These tests lock the
 * shared formula and assert the two can never disagree across the band edge.
 */
describe('Economy curve math — single source of truth', () => {
  it('expectedPrice rounds to whole gold', () => {
    expect(expectedPrice(100)).toBe(140); // 100 * 1.4 = 140
    expect(expectedPrice(103)).toBe(144); // 103 * 1.4 = 144.2 → 144
    expect(expectedPrice(102)).toBe(143); // 102 * 1.4 = 142.8 → 143
  });

  it('priceRatio divides by the rounded expected price', () => {
    expect(priceRatio(173, 103)).toBeCloseTo(173 / 144, 6);
    expect(priceRatio(143, 102)).toBeCloseTo(1, 6); // the demo item sits exactly on the curve
  });

  it('powerInBand enforces ±10% of the tier target', () => {
    expect(powerInBand(110, 100)).toBe(true);
    expect(powerInBand(111, 100)).toBe(false);
    expect(powerInBand(90, 100)).toBe(true);
    expect(powerInBand(89, 100)).toBe(false);
  });

  it('flags the band-edge case that the two old formulas disagreed on', () => {
    // power 103, cost 173: 1.2014× vs the rounded curve (144g) — OUTLIER — but only
    // 1.1997× vs the un-rounded curve (144.2g) — in band. The formulas straddled 1.2×.
    const power = 103, cost = 173, target = 100;
    expect(priceInBand(cost, power)).toBe(false); // view: OUTLIER
    const gate = ITEM_STEP_SPECS.Economy.accept({ power, target, cost, rarity: 'Uncommon' });
    expect(gate.status).toBe('fail'); // gate: agrees
  });

  it('view OUTLIER badge matches the gate across the whole band edge (power in tier)', () => {
    const target = 100;
    for (let power = 95; power <= 105; power++) {
      for (let cost = 100; cost <= 200; cost++) {
        const viewOutlier = !priceInBand(cost, power);
        // power stays within ±10% here, so the gate's only failing lever is the price band
        const gateFails = ITEM_STEP_SPECS.Economy.accept({ power, target, cost }).status === 'fail';
        expect(gateFails).toBe(viewOutlier);
      }
    }
  });
});

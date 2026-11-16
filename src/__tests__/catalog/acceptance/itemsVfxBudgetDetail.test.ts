import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { itemsVfxWithinBudget } from '@/lib/catalog/acceptance/itemsBespokeCheckers';

afterEach(cleanup);

// The VFX checker's detail/reason printed the cost with toFixed(1), so 0.85 ms against a 0.8 ms
// cap read "0.8 / 0.8 ms" under a pending verdict. Only as many decimals as it takes to tell the
// cost from the cap.
describe('itemsVfxWithinBudget never prints an over-budget cost as its cap', () => {
  const over = itemsVfxWithinBudget({ variants: [['idle', 'Niagara']], cost: 0.85, cap: 0.8 });

  it('is pending when over budget', () => {
    expect(over.status).toBe('pending');
  });

  it('detail shows 0.85, not the cap', () => {
    expect(over.detail).toBe('0.85 / 0.8 ms');
  });

  it('reason names the real cost', () => {
    expect(over.reason).toBe('VFX cost 0.85 ms exceeds the 0.8 ms budget');
  });

  it('an in-budget cost keeps its short form', () => {
    const ok = itemsVfxWithinBudget({ variants: [['idle', 'Niagara']], cost: 0.5, cap: 0.8 });
    expect(ok.status).toBe('pass');
    expect(ok.detail).toBe('0.5 / 0.8 ms');
  });
});

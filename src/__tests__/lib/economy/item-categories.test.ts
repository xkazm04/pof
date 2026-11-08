import { describe, it, expect } from 'vitest';
import { ITEM_CATEGORIES } from '@/types/economy-simulator';
import { CATEGORY_COLORS } from '@/components/modules/evaluator/EconomySimulatorView/constants';
import { runSimulation } from '@/lib/economy/simulation-engine';
import { DEFAULT_ITEMS } from '@/lib/economy/definitions';
import type { SimulationConfig } from '@/types/economy-simulator';

const CONFIG = { agentCount: 5, maxLevel: 3, maxPlayHours: 5, seed: 1, philosophy: 'balanced' } as SimulationConfig;

describe('item categories have one enumeration', () => {
  it('ITEM_CATEGORIES covers every CATEGORY_COLORS key', () => {
    expect([...ITEM_CATEGORIES].sort()).toEqual(Object.keys(CATEGORY_COLORS).sort());
  });

  it('the engine buckets a recipe item into supply/demand', () => {
    DEFAULT_ITEMS.push({ id: 'recipe-seed', name: 'Seed Recipe', category: 'recipe', rarity: 'common', buyPrice: 10, sellPrice: 3, levelScaling: 1, dropWeight: 10, minLevel: 1 });
    try {
      const result = runSimulation(CONFIG);
      expect(result.supplyDemand.some((p) => p.category === 'recipe')).toBe(true);
    } finally {
      DEFAULT_ITEMS.pop();
    }
  });
});

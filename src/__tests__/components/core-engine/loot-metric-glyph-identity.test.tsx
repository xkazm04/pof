import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { resetLootTuning } from '@/components/modules/core-engine/sub_loot/_shared/lootTuningStore';

// Metric identity: lootMetricsView is the Feature Map's ONE read model, so every
// number a glyph prints must be the view's reading - not a second count the glyph
// file computes from the same constant at import time. The view is overridden with
// sentinel values here; a glyph that prints its own count instead fails.

const SENTINEL_BASE = 9001;

vi.mock('@/components/modules/core-engine/sub_loot/metrics/lootMetricsView', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/modules/core-engine/sub_loot/metrics/lootMetricsView')>();
  return {
    ...actual,
    lootMetricsView: (input: Parameters<typeof actual.lootMetricsView>[0]) => {
      const real = actual.lootMetricsView(input);
      const out = { ...real };
      actual.LOOT_SECTION_IDS.forEach((id, i) => {
        out[id] = { ...real[id], value: SENTINEL_BASE + i, unit: `unit-${id}` };
      });
      return out;
    },
  };
});

const { renderLootMetric } = await import('@/components/modules/core-engine/sub_loot/metrics');
const { LOOT_SECTION_IDS } = await import('@/components/modules/core-engine/sub_loot/metrics/lootMetricsView');

beforeEach(() => resetLootTuning());
afterEach(cleanup);

/** Sections whose glyph prints a number (weights / treemap are pure diagrams). */
const PRINTING = ['pipeline', 'world-items', 'histogram', 'simulator', 'co-occurrence', 'timer', 'drought', 'beacon', 'impact'] as const;

describe('loot Feature Map glyphs print the view, not their own counts', () => {
  for (const id of PRINTING) {
    it(`${id} prints the view's value and unit`, () => {
      const { container } = render(<>{renderLootMetric(id)}</>);
      const text = container.textContent ?? '';
      const sentinel = String(SENTINEL_BASE + LOOT_SECTION_IDS.indexOf(id));
      expect(text, id).toContain(sentinel);
      expect(text, id).toContain(`unit-${id}`);
    });
  }

  it('the pipeline fixture tooltip names the actual stage flow, and is not shadowed by an inner title', () => {
    const { container } = render(<>{renderLootMetric('pipeline')}</>);
    const titled = Array.from(container.querySelectorAll('[title]')).map((el) => el.getAttribute('title') ?? '');
    expect(titled).toHaveLength(1);
    expect(titled[0]).toContain('WeightedRandom');
    expect(titled[0]).toContain('sample data');
  });
});

import { describe, it, expect } from 'vitest';
import { parseGridFractions, estimateSlotDimensions, computeSpatialBudget } from '../spatial';
import { LAYOUT_TEMPLATES } from '../templates';

describe('parseGridFractions', () => {
  it('handles single "1fr"', () => {
    expect(parseGridFractions('1fr')).toEqual([1.0]);
  });

  it('handles "1fr 2fr"', () => {
    const result = parseGridFractions('1fr 2fr');
    expect(result[0]).toBeCloseTo(1 / 3);
    expect(result[1]).toBeCloseTo(2 / 3);
  });

  it('handles "3fr 2fr"', () => {
    const result = parseGridFractions('3fr 2fr');
    expect(result[0]).toBeCloseTo(3 / 5);
    expect(result[1]).toBeCloseTo(2 / 5);
  });

  it('handles clamp() by averaging min/max', () => {
    // clamp(200px, 18vw, 280px) 1fr => avg(200,280)=240px treated as fixed
    const result = parseGridFractions('clamp(200px, 18vw, 280px) 1fr');
    expect(result).toHaveLength(2);
    // First fraction represents 240px out of total, second is remainder
    // These are proportional fractions that sum to 1
    expect(result[0] + result[1]).toBeCloseTo(1.0);
    expect(result[0]).toBeLessThan(result[1]); // clamp portion < 1fr remainder
  });

  it('handles "300px 1fr"', () => {
    const result = parseGridFractions('300px 1fr');
    expect(result).toHaveLength(2);
    expect(result[0] + result[1]).toBeCloseTo(1.0);
  });

  it('handles "1fr 1fr"', () => {
    const result = parseGridFractions('1fr 1fr');
    expect(result[0]).toBeCloseTo(0.5);
    expect(result[1]).toBeCloseTo(0.5);
  });

  it('handles repeat(auto-fill, ...) as single fraction', () => {
    const result = parseGridFractions('repeat(auto-fill, minmax(200px, 1fr))');
    expect(result).toHaveLength(1);
    expect(result[0]).toBeCloseTo(1.0);
  });

  it('handles three-column with clamp values', () => {
    // triptych: clamp(200px, 18vw, 250px) 1fr clamp(200px, 18vw, 280px)
    const result = parseGridFractions('clamp(200px, 18vw, 250px) 1fr clamp(200px, 18vw, 280px)');
    expect(result).toHaveLength(3);
    expect(result[0] + result[1] + result[2]).toBeCloseTo(1.0);
    expect(result[1]).toBeGreaterThan(result[0]); // center 1fr is largest
  });
});

describe('estimateSlotDimensions', () => {
  it('returns correct pixel dimensions for split-2 at 1920x1080', () => {
    const split2 = LAYOUT_TEMPLATES.find((t) => t.id === 'split-2')!;
    const dims = estimateSlotDimensions(split2, 1920, 1080);

    expect(dims).toHaveLength(2);
    // split-2: 3fr 2fr columns, 1fr row
    // slot 0: 3/5 * 1920 = 1152, 1080
    // slot 1: 2/5 * 1920 = 768, 1080
    expect(dims[0].width).toBeCloseTo(1152, -1);
    expect(dims[0].height).toBeCloseTo(1080, -1);
    expect(dims[1].width).toBeCloseTo(768, -1);
    expect(dims[1].height).toBeCloseTo(1080, -1);
  });

  it('returns correct pixel dimensions for single at 1920x1080', () => {
    const single = LAYOUT_TEMPLATES.find((t) => t.id === 'single')!;
    const dims = estimateSlotDimensions(single, 1920, 1080);

    expect(dims).toHaveLength(1);
    expect(dims[0].width).toBeCloseTo(1920, -1);
    expect(dims[0].height).toBeCloseTo(1080, -1);
  });

  it('returns correct pixel dimensions for grid-4 at 1920x1080', () => {
    const grid4 = LAYOUT_TEMPLATES.find((t) => t.id === 'grid-4')!;
    const dims = estimateSlotDimensions(grid4, 1920, 1080);

    expect(dims).toHaveLength(4);
    // grid-4: 1fr 1fr columns, 1fr 1fr rows
    expect(dims[0].width).toBeCloseTo(960, -1);
    expect(dims[0].height).toBeCloseTo(540, -1);
  });

  it('handles studio template with fixed pixel rows', () => {
    const studio = LAYOUT_TEMPLATES.find((t) => t.id === 'studio')!;
    const dims = estimateSlotDimensions(studio, 1920, 1080);

    expect(dims).toHaveLength(5);
    // Row 1: 42px, Row 2: 1fr, Row 3: 160px
    // The primary slot (row 2, col 2) should be the largest
    const primarySlot = dims[2]; // slot index 2 is primary in studio
    expect(primarySlot.width).toBeGreaterThan(500);
    expect(primarySlot.height).toBeGreaterThan(500);
  });
});

describe('computeSpatialBudget', () => {
  it('returns spatial options for all provided templates', () => {
    const viewport = { width: 1920, height: 1080 };
    const budget = computeSpatialBudget(viewport, LAYOUT_TEMPLATES);

    expect(budget.viewport).toEqual(viewport);
    expect(budget.options).toHaveLength(LAYOUT_TEMPLATES.length);
  });

  it('each option has template id and slot dimensions', () => {
    const viewport = { width: 1920, height: 1080 };
    const budget = computeSpatialBudget(viewport, LAYOUT_TEMPLATES);

    for (const option of budget.options) {
      expect(option.templateId).toBeDefined();
      expect(option.slots.length).toBeGreaterThan(0);
      for (const slot of option.slots) {
        expect(slot.width).toBeGreaterThan(0);
        expect(slot.height).toBeGreaterThan(0);
      }
    }
  });
});

/** Heatmap cell counts carry a text label, not hue alone (WCAG 1.4.1). */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { CellData } from '@/components/modules/evaluator/AggregateQualityDashboard/types';
import type { SubModuleId } from '@/types/modules';
import { HeatmapGrid } from '@/components/modules/evaluator/AggregateQualityDashboard/HeatmapGrid';

afterEach(cleanup);

const cell: CellData = {
  moduleId: 'arpg-combat' as SubModuleId, label: 'Combat', total: 10, implemented: 2, improved: 6, partial: 1,
  missing: 1, unknown: 0, avgQuality: 2, lastReviewedAt: null, daysSinceReview: null, pctComplete: 0.8, pctReviewed: 1,
};

describe('HeatmapGrid status counts', () => {
  it('names done, partial and missing for assistive tech', () => {
    const { container } = render(
      <HeatmapGrid cells={[cell]} historyMap={{}} hoveredModule={null} selectedModule={null} customStaleDays={7} playEntrance={false} fetchData={vi.fn()} setHoveredModule={vi.fn()} setSelectedModule={vi.fn()} />,
    );
    const text = container.querySelector('[data-testid="heatmap-cell-arpg-combat"]')?.textContent ?? '';
    const labelled = ['Done 8', 'Partial 1', 'Missing 1'].filter((l) => text.includes(l));
    expect(labelled).toEqual(['Done 8', 'Partial 1', 'Missing 1']);
  });
});

/**
 * scan-sweep (cross-module-features/B): a zero-count heatmap cell was a plain
 * `<div aria-label>`; ARIA 1.2 prohibits naming role=generic, so the label was
 * dropped by assistive tech. The row button already announces every count, so
 * the empty cell is aria-hidden and carries no name.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { HeatmapGrid } from '@/components/modules/evaluator/CrossModuleFeatureDashboard/HeatmapGrid';
import type { CellData } from '@/components/modules/evaluator/CrossModuleFeatureDashboard/types';
import type { SubModuleId } from '@/types/modules';

afterEach(cleanup);

const CELL: CellData = {
  moduleId: 'arpg-combat' as SubModuleId, label: 'Combat', category: 'Core Engine',
  total: 4, implemented: 1, improved: 0, partial: 0, missing: 3, unknown: 0, pctComplete: 0.25,
};
const TOTALS = { total: 4, implemented: 1, improved: 0, partial: 0, missing: 3, unknown: 0 };

describe('HeatmapGrid — zero-count cells', () => {
  it('names no generic element (div[aria-label]:not([role]) count is 0)', () => {
    const { container } = render(
      <HeatmapGrid
        cells={[CELL]} totals={TOTALS} overallPct={25} sortBy="completion" setSortBy={() => {}}
        categoryGroups={{ 'Core Engine': [CELL] }} hoveredCell={null}
        setHoveredCell={() => {}} handleCellClick={() => {}} selectedCell={null} onSelectCell={() => {}}
      />,
    );
    expect(container.querySelectorAll('div[aria-label]:not([role])').length).toBe(0);
    expect(container.querySelectorAll('div[aria-hidden="true"].h-7').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('button[aria-label^="Combat: 3/4 missing"]').length).toBe(1);
  });
});

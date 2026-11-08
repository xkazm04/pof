/**
 * scan-sweep (cross-module-features): a hovered heatmap count drew its own
 * role="tooltip" AND carried a native `title`, so the browser stacked a second,
 * differently worded tooltip on top of the first. One hover, one tooltip; the
 * button keeps its aria-label for assistive tech.
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

describe('HeatmapGrid — one tooltip per hovered count', () => {
  it('the hovered count shows its tooltip and no native title', () => {
    const { container } = render(
      <HeatmapGrid
        cells={[CELL]} totals={TOTALS} overallPct={25} sortBy="completion" setSortBy={() => {}}
        categoryGroups={{ 'Core Engine': [CELL] }} hoveredCell={{ module: 'arpg-combat', status: 'missing' }}
        setHoveredCell={() => {}} handleCellClick={() => {}} selectedCell={null} onSelectCell={() => {}}
      />,
    );
    const tooltips = container.querySelectorAll('[role="tooltip"]');
    const btn = container.querySelector<HTMLButtonElement>('button[aria-label^="Combat: 3/4 missing"]')!;
    expect(tooltips.length).toBe(1);
    expect(btn.hasAttribute('title')).toBe(false);
    expect(btn.getAttribute('aria-label')).toContain('Show features');
  });
});

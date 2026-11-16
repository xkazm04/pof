/**
 * scan-sweep (cross-module-features): one "done %" colour rule, three copies. The
 * heatmap rows used >=80 green / >=40 amber / >0 red / 0 muted; the footer dropped
 * the 0 → muted branch (0% project read red while every 0% row read muted); the
 * 'Lowest Completion' panel dropped the >=80 → green branch (an 85% module read
 * amber). All three now read the one helper.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { completionColor } from '@/components/modules/evaluator/CrossModuleFeatureDashboard/helpers';
import { HeatmapGrid } from '@/components/modules/evaluator/CrossModuleFeatureDashboard/HeatmapGrid';
import { BottomPanels } from '@/components/modules/evaluator/CrossModuleFeatureDashboard/BottomPanels';
import type { CellData } from '@/components/modules/evaluator/CrossModuleFeatureDashboard/types';
import type { SubModuleId } from '@/types/modules';

afterEach(cleanup);

const MUTED = 'var(--text-muted)';

/** jsdom normalises inline hex colours to rgb(). */
function rgbOf(hex: string): string {
  const n = hex.replace('#', '');
  return `rgb(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)})`;
}

function cell(pct: number): CellData {
  const total = 20;
  const implemented = Math.round((pct / 100) * total);
  return {
    moduleId: 'arpg-combat' as SubModuleId, label: 'Combat', category: 'Core Engine',
    total, implemented, improved: 0, partial: 0, missing: total - implemented, unknown: 0,
    pctComplete: implemented / total,
  };
}

const ZERO_TOTALS = { total: 20, implemented: 0, improved: 0, partial: 0, missing: 20, unknown: 0 };

describe('completionColor — the one done-% colour rule', () => {
  it('maps the four bands', () => {
    expect(completionColor(0)).toBe(MUTED);
    expect(completionColor(10)).toBe(STATUS_ERROR);
    expect(completionColor(40)).toBe(STATUS_WARNING);
    expect(completionColor(80)).toBe(STATUS_SUCCESS);
  });

  it('heatmap footer reads a 0% project like a 0% row (muted, not red)', () => {
    const c = cell(0);
    const { getAllByText } = render(
      <HeatmapGrid
        cells={[c]} totals={ZERO_TOTALS} overallPct={0} sortBy="completion" setSortBy={() => {}}
        categoryGroups={{ 'Core Engine': [c] }} hoveredCell={null} setHoveredCell={() => {}}
        handleCellClick={() => {}} selectedCell={null} onSelectCell={() => {}}
      />,
    );
    const colours = getAllByText('0%').map((el) => el.style.color);
    expect(colours.length).toBe(2); // row + footer
    expect(new Set(colours)).toEqual(new Set([MUTED]));
  });

  it("'Lowest Completion' reads an 85% module green, as the heatmap row does", () => {
    const { getByText } = render(
      <BottomPanels lowestModules={[cell(85)]} buildable={[]} handleCellClick={() => {}} onBuild={() => {}} isBuilding={false} />,
    );
    expect(getByText('85%').style.color).toBe(rgbOf(STATUS_SUCCESS));
  });
});

/** `improved` is done (lib/feature-done): the counts beside the % must include it. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { CellData, Totals } from '@/components/modules/evaluator/AggregateQualityDashboard/types';
import type { SubModuleId } from '@/types/modules';
import { SummaryPanels } from '@/components/modules/evaluator/AggregateQualityDashboard/SummaryPanels';
import { WorstModulesPanel } from '@/components/modules/evaluator/AggregateQualityDashboard/WorstModulesPanel';
import { HeatmapGrid } from '@/components/modules/evaluator/AggregateQualityDashboard/HeatmapGrid';
import { ModuleDetailPanel } from '@/components/modules/evaluator/AggregateQualityDashboard/ModuleDetailPanel';

afterEach(cleanup);

const cell: CellData = {
  moduleId: 'arpg-combat' as SubModuleId, label: 'Combat', total: 10, implemented: 2, improved: 6, partial: 1,
  missing: 1, unknown: 0, avgQuality: 2, lastReviewedAt: null, daysSinceReview: null, pctComplete: 0.8, pctReviewed: 1,
};
const totals: Totals = { total: 10, implemented: 2, improved: 6, partial: 1, missing: 1, unknown: 0, reviewed: 1 };

describe('Quality tab done counts', () => {
  it('the summary says 8 of 10 beside its 80%', () => {
    const { container } = render(
      <SummaryPanels overallPct={80} totals={totals} overallQuality={2} cells={[cell]} worstModules={[]} staleModules={[]} customStaleDays={7} />,
    );
    expect(container.textContent).toContain('8 / 10 features');
    expect(container.textContent).toContain('8 done / 1 partial');
  });

  it('the needs-attention row counts improved features', () => {
    const { container } = render(<WorstModulesPanel worstModules={[cell]} setSelectedModule={vi.fn()} />);
    expect(container.textContent).toContain('8/10 done');
  });

  it('the heatmap bar and first count include improved', () => {
    const { container } = render(
      <HeatmapGrid cells={[cell]} historyMap={{}} hoveredModule={null} selectedModule={null} customStaleDays={7} playEntrance={false} fetchData={vi.fn()} setHoveredModule={vi.fn()} setSelectedModule={vi.fn()} />,
    );
    const bar = container.querySelector('.h-1.bg-black\\/30')?.firstElementChild as HTMLElement;
    expect(bar.style.width).toBe('80%');
    expect(bar.parentElement?.nextElementSibling?.firstElementChild?.textContent?.trim().endsWith('8')).toBe(true);
  });

  it('the detail panel row reads Done 8', () => {
    const { container } = render(<ModuleDetailPanel selected={cell} historyMap={{}} />);
    expect(container.textContent).toContain('Done8');
  });
});

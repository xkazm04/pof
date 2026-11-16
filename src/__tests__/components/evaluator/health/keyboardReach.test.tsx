/** Radar nodes and the module rows open their detail from the keyboard too. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { EvaluatorReport } from '@/types/evaluator';
import type { SubModuleId } from '@/types/modules';
import type { CellData } from '@/components/modules/evaluator/AggregateQualityDashboard/types';
import { HealthRadarChart } from '@/components/modules/evaluator/ProjectHealthDashboard/HealthRadarChart';
import { WorstModulesPanel } from '@/components/modules/evaluator/AggregateQualityDashboard/WorstModulesPanel';
import { StaleReviewsPanel } from '@/components/modules/evaluator/AggregateQualityDashboard/StaleReviewsPanel';

afterEach(cleanup);

const cell = {
  moduleId: 'arpg-combat' as SubModuleId, label: 'Combat', total: 1, implemented: 0, improved: 0, partial: 0,
  missing: 1, unknown: 0, avgQuality: 2, lastReviewedAt: null, daysSinceReview: null, pctComplete: 0, pctReviewed: 1,
} as CellData;

describe('keyboard reach', () => {
  it('a radar node is a named, focusable toggle that Enter activates', () => {
    const setSelectedModule = vi.fn();
    const datum = { moduleId: 'arpg-combat' as SubModuleId, score: 92, issues: [], angle: 0, label: 'Combat' };
    render(
      <HealthRadarChart
        lastScan={{ overallScore: 92 } as EvaluatorReport}
        radarData={[datum]} prevRadarData={null} radarPath="" prevRadarPath="" showHistoryOverlay={false}
        selectedModule={null} setSelectedModule={setSelectedModule} healthPulseColor="red"
      />,
    );
    const node = screen.getByRole('button', { name: 'Combat: 92 of 100' });
    expect(node.getAttribute('tabindex')).toBe('0');
    expect(node.getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(node, { key: 'Enter' });
    expect(setSelectedModule).toHaveBeenCalledWith('arpg-combat');
  });

  it('a needs-attention row is a button', () => {
    const setSelectedModule = vi.fn();
    render(<WorstModulesPanel worstModules={[cell]} setSelectedModule={setSelectedModule} />);
    fireEvent.click(screen.getByRole('button', { name: /Combat/ }));
    expect(setSelectedModule).toHaveBeenCalledWith('arpg-combat');
  });

  it('a stale-review row is a button', () => {
    const setSelectedModule = vi.fn();
    render(
      <StaleReviewsPanel
        staleModules={[cell]} customStaleDays={7} setCustomStaleDays={vi.fn()} handleBatchReview={vi.fn()}
        isBatchReviewing={false} reviewError={null} setSelectedModule={setSelectedModule}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Combat/ }));
    expect(setSelectedModule).toHaveBeenCalledWith('arpg-combat');
  });
});

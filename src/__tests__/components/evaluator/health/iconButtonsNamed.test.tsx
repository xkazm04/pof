/** Icon-only buttons need a name a screen reader can say. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import type { SubModuleId } from '@/types/modules';
import { RegressionAlerts } from '@/components/modules/evaluator/ProjectHealthDashboard/RegressionAlerts';
import { SelectedModuleDetail } from '@/components/modules/evaluator/ProjectHealthDashboard/SelectedModuleDetail';
import { HeatmapGrid } from '@/components/modules/evaluator/AggregateQualityDashboard/HeatmapGrid';

afterEach(cleanup);

describe('icon-only buttons', () => {
  it('names the alert dismiss after its alert', () => {
    render(<RegressionAlerts regressionAlerts={[{ id: 'a', message: 'Combat: +1 high', severity: 'high' }]} dismissAlert={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dismiss alert: Combat: +1 high' })).toBeTruthy();
  });

  it('names the module detail close', () => {
    render(
      <SelectedModuleDetail
        selectedDetail={{ moduleId: 'arpg-combat' as SubModuleId, score: 90, issues: [], recommendations: [], label: 'Combat' }}
        setSelectedModule={vi.fn()} handleFix={vi.fn()} fixCli={{ isRunning: false }} scanHistory={[]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Close Combat detail' })).toBeTruthy();
  });

  it('names the heatmap refresh', () => {
    render(
      <HeatmapGrid cells={[]} historyMap={{}} hoveredModule={null} selectedModule={null} customStaleDays={7} playEntrance={false} fetchData={vi.fn()} setHoveredModule={vi.fn()} setSelectedModule={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Refresh data' }).getAttribute('aria-label')).toBe('Refresh data');
  });
});

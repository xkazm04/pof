/** Rendering the top list must not reorder the report it was handed. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { EvaluatorReport, Recommendation } from '@/types/evaluator';
import type { SubModuleId } from '@/types/modules';
import { TopRecommendations } from '@/components/modules/evaluator/ProjectHealthDashboard/TopRecommendations';

afterEach(cleanup);

const rec = (id: string, priority: Recommendation['priority']): Recommendation => ({
  id, priority, moduleId: 'arpg-combat' as SubModuleId, title: id, description: '', suggestedPrompt: '',
});

describe('TopRecommendations', () => {
  it('sorts a copy and leaves the report untouched', () => {
    const recommendations = [rec('l', 'low'), rec('c', 'critical')];
    const report = { id: 'r', timestamp: 0, overallScore: 1, moduleScores: [], recommendations, summary: '' } as EvaluatorReport;
    const { container } = render(<TopRecommendations lastScan={report} handleFix={vi.fn()} fixCli={{ isRunning: false }} />);
    expect(recommendations.map((r) => r.id)).toEqual(['l', 'c']);
    expect(container.textContent?.indexOf('critical')).toBeLessThan(container.textContent?.indexOf('low') ?? -1);
  });
});

/** A selection the newest history cannot resolve must not blank the recommendations. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { PersistedScan } from '@/lib/evaluator/evaluator-results-db';
import type { SubModuleId } from '@/types/modules';
import { useProjectStore } from '@/stores/projectStore';

afterEach(cleanup);

const h = vi.hoisted(() => ({ tryApiFetch: vi.fn() }));
vi.mock('@/lib/api-utils', async (orig) => ({
  ...(await orig<typeof import('@/lib/api-utils')>()),
  tryApiFetch: h.tryApiFetch,
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), sendPrompt: vi.fn(), isRunning: false }),
}));

import { ProjectHealthDashboard } from '@/components/modules/evaluator/ProjectHealthDashboard';

function scan(moduleId: string): PersistedScan {
  const finding = {
    id: `f-${moduleId}`, scanId: 's', moduleId: moduleId as SubModuleId, pass: 'quality', category: 'gas',
    severity: 'high', file: 'A.cpp', line: 1, description: 'd', suggestedFix: 's', effort: 'small', timestamp: 0,
  } as EvalFinding;
  return {
    scanId: `s-${moduleId}`, projectId: '/p', scannedAt: new Date(1000).toISOString(), timestamp: 1000, durationMs: 0,
    modulesEvaluated: [moduleId], failedModules: [], totalFindings: 1,
    severityCounts: { critical: 0, high: 1, medium: 0, low: 0 }, findings: [finding],
  };
}

describe('ProjectHealthDashboard selection', () => {
  it('shows the recommendations again when the selected module is not in the open project', async () => {
    useProjectStore.setState({ projectPath: '/p' });
    h.tryApiFetch.mockResolvedValue({ ok: true, data: { scans: [scan('arpg-combat')] } });
    const { container } = render(<ProjectHealthDashboard />);
    await screen.findByText('Top Recommendations');
    fireEvent.click(container.querySelector('svg g.cursor-pointer') as Element);
    expect(screen.queryByText('Top Recommendations')).toBeNull();

    h.tryApiFetch.mockResolvedValue({ ok: true, data: { scans: [scan('arpg-loot')] } });
    await act(async () => { useProjectStore.setState({ projectPath: '/q' }); });
    await screen.findByText('Top Recommendations');
  });
});

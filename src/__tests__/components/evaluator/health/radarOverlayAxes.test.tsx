/** Compare Previous plots each module on that module's own axis, even when coverage grew. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { PersistedScan } from '@/lib/evaluator/evaluator-results-db';
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

const scan = (scanId: string, timestamp: number, modulesEvaluated: string[]): PersistedScan => ({
  scanId, projectId: '/p', scannedAt: new Date(timestamp).toISOString(), timestamp, durationMs: 0,
  modulesEvaluated, failedModules: [], totalFindings: 0,
  severityCounts: { critical: 0, high: 0, medium: 0, low: 0 }, findings: [],
});

describe('Compare Previous overlay', () => {
  it('keeps a module on its current axis when the newest scan added a module', async () => {
    useProjectStore.setState({ projectPath: '/p' });
    h.tryApiFetch.mockResolvedValue({
      ok: true,
      data: {
        scans: [
          scan('new', 2000, ['arpg-combat', 'arpg-loot', 'arpg-character', 'ai-behavior']),
          scan('old', 1000, ['arpg-combat', 'arpg-loot', 'arpg-character']),
        ],
      },
    });
    const { container } = render(<ProjectHealthDashboard />);
    fireEvent.click(await screen.findByText('Compare Previous'));
    const points = container.querySelector('polygon[stroke-dasharray]')?.getAttribute('points')?.split(' ') ?? [];
    expect(points).toHaveLength(3);
    // arpg-loot is the second of FOUR axes: 90 degrees, full score, so straight right of centre.
    const [x, y] = (points[1] ?? '0,0').split(',').map(Number);
    expect(x).toBeCloseTo(270);
    expect(y).toBeCloseTo(140);
  });
});

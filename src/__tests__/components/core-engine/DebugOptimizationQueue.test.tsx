import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { CLITask } from '@/lib/cli-task';
import type { PerformanceFinding, ProfileSourceType } from '@/types/performance-profiling';

/**
 * Acceptance for scan-sweep --challenge card debug-performance/B: a queue row
 * dispatches its finding's own fix prompt through useModuleCLI ONLY on click,
 * and a generated (synthetic) session never offers a Fix at all.
 */

const execute = vi.fn<(task: CLITask) => Promise<void>>(async () => {});
const useModuleCLISpy = vi.fn();
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: unknown) => { useModuleCLISpy(opts); return { execute, sendPrompt: vi.fn(), isRunning: false }; },
}));

import { OptimizationQueue } from '@/components/modules/core-engine/sub_debug/performance/OptimizationQueue';

afterEach(cleanup);
beforeEach(() => { execute.mockClear(); useModuleCLISpy.mockClear(); });

const FINDING: PerformanceFinding = {
  id: 'tick-freq-BP_Enemy', priority: 'critical', category: 'tick', title: 'BP_Enemy ticks at 60Hz unnecessarily',
  description: 'd', estimatedSavingsMs: 1.5, involvedClasses: ['BP_Enemy'],
  fixPrompt: 'Optimize BP_Enemy tick frequency: set PrimaryActorTick.TickInterval to 0.1f.',
  checklistLabel: 'Optimize BP_Enemy tick rate (60Hz -> 10Hz idle)', metric: 'tickFrequencyHz', metricValue: 60, metricThreshold: 10,
};

function latest(source: ProfileSourceType) {
  return {
    kind: 'ready' as const,
    session: { id: 's1', name: 'boss arena', source, importedAt: '2026-09-30T10:00:00.000Z' },
    triage: { sessionId: 's1', findings: [FINDING], overallScore: 40, bottleneck: 'game-thread' as const, generatedAt: 'x' },
    comparison: null,
  };
}

describe('OptimizationQueue', () => {
  it('Fix dispatches one feature-fix task under arpg-polish carrying the fixPrompt; the row then shows dispatched', async () => {
    render(<OptimizationQueue latest={latest('csv-stats')} />);
    expect(execute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /fix/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0];
    expect(task.type).toBe('feature-fix');
    expect(task.moduleId).toBe('arpg-polish');
    expect(task.prompt).toContain(FINDING.fixPrompt);
    expect(await screen.findByText(/dispatched/i)).toBeTruthy();
  });

  it('a generated sample session -> synthetic rows, no Fix button, a note to import a UE capture, execute never called', () => {
    render(<OptimizationQueue latest={latest('manual')} />);
    expect(screen.getByText(FINDING.title)).toBeTruthy();
    expect(screen.getAllByText(/synthetic/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /fix/i })).toBeNull();
    expect(screen.getByText(/import a UE capture/i)).toBeTruthy();
    expect(execute).not.toHaveBeenCalled();
  });

  it('no capture -> says so and shows no invented rows', () => {
    render(<OptimizationQueue latest={{ kind: 'no-capture' }} />);
    expect(screen.getByText(/no profiler capture/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /fix/i })).toBeNull();
  });
});

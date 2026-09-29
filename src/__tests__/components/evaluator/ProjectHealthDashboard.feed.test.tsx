/**
 * scan-sweep --challenge (project-health-dashboards/A): the Scanner tab's Project
 * Health dashboard reads the durable deep-eval history over
 * `GET /api/evaluator/results` (project-scoped) instead of `useEvaluatorStore`, a
 * store with no production writer. Empty history sends the user to Deep Eval; a
 * failed load is an explicit error with Retry (never the never-scanned empty state);
 * Fix dispatches the module-aware `generateFixPlan` prompt on the finding's module.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { PersistedScan } from '@/lib/evaluator/evaluator-results-db';
import type { SubModuleId } from '@/types/modules';
import { generateFixPlan } from '@/lib/evaluator/fix-plan-generator';
import { useProjectStore } from '@/stores/projectStore';

afterEach(cleanup);

const h = vi.hoisted(() => ({
  tryApiFetch: vi.fn(),
  sent: [] as { prompt: string; moduleId: string }[],
}));

vi.mock('@/lib/api-utils', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-utils')>();
  return { ...actual, tryApiFetch: h.tryApiFetch };
});
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { moduleId: string }) => ({
    execute: vi.fn(),
    sendPrompt: (prompt: string) => h.sent.push({ prompt, moduleId: opts.moduleId }),
    isRunning: false,
  }),
}));

import { ProjectHealthDashboard } from '@/components/modules/evaluator/ProjectHealthDashboard';

const CTX = { projectName: 'Did', projectPath: '/p', ueVersion: '5.5' };

const F1: EvalFinding = {
  id: 'f1',
  scanId: 's2',
  moduleId: 'arpg-combat' as SubModuleId,
  pass: 'quality',
  category: 'gas',
  severity: 'high',
  file: 'Source/X.cpp',
  line: 42,
  description: 'd',
  suggestedFix: 's',
  effort: 'small',
  timestamp: 0,
};

function persisted(scanId: string, t: number, findings: EvalFinding[]): PersistedScan {
  return {
    scanId,
    projectId: '/p',
    scannedAt: new Date(t).toISOString(),
    timestamp: t,
    durationMs: 0,
    modulesEvaluated: ['arpg-combat'],
    failedModules: [],
    totalFindings: findings.length,
    severityCounts: { critical: 0, high: findings.length, medium: 0, low: 0 },
    findings,
  };
}

beforeEach(() => {
  h.tryApiFetch.mockReset();
  h.sent.length = 0;
  useProjectStore.setState(CTX);
});

describe('ProjectHealthDashboard — durable scan feed', () => {
  it('no scans -> "No health data yet" sends the user to Deep Eval (no dead "Soon" scan button)', async () => {
    h.tryApiFetch.mockResolvedValue({ ok: true, data: { scans: [] } });
    const onNavigateTab = vi.fn();
    render(<ProjectHealthDashboard onNavigateTab={onNavigateTab} />);
    await screen.findByText('No health data yet');
    expect(screen.queryByText('Soon')).toBeNull();
    const [action] = screen.getAllByRole('button', { name: /Run Deep Eval/ });
    fireEvent.click(action);
    expect(onNavigateTab).toHaveBeenCalledWith('deep-eval');
  });

  it('fetches the project-scoped history and renders the newest report', async () => {
    h.tryApiFetch.mockResolvedValue({
      ok: true,
      data: { scans: [persisted('s2', 2000, [F1]), persisted('s1', 1000, [])] },
    });
    render(<ProjectHealthDashboard onNavigateTab={vi.fn()} />);
    await screen.findByText('2 scans');
    expect(h.tryApiFetch.mock.calls[0][0]).toBe('/api/evaluator/results?limit=10&project=%2Fp');
    // Gauge: newest report = arpg-combat with one high finding -> 100 - 8.
    expect(screen.getByText('/100').previousSibling?.textContent).toBe('92');
  });

  it("Fix sends generateFixPlan(finding, ctx).prompt through the finding's own module session", async () => {
    h.tryApiFetch.mockResolvedValue({ ok: true, data: { scans: [persisted('s2', 2000, [F1])] } });
    render(<ProjectHealthDashboard onNavigateTab={vi.fn()} />);
    await screen.findByText('Top Recommendations');
    fireEvent.click(screen.getByRole('button', { name: /Fix/ }));
    await waitFor(() => expect(h.sent).toHaveLength(1));
    expect(h.sent[0]).toEqual({ prompt: generateFixPlan(F1, CTX).prompt, moduleId: 'arpg-combat' });
  });

  it('[guard] a failed load reads as an error with Retry, never as a never-scanned project', async () => {
    h.tryApiFetch.mockResolvedValue({ ok: false, error: 'HTTP 500' });
    render(<ProjectHealthDashboard onNavigateTab={vi.fn()} />);
    await screen.findByText("Couldn't load scan history");
    expect(screen.queryByText('No health data yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(h.tryApiFetch).toHaveBeenCalledTimes(2));
  });
});

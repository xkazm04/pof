/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): a failing /api/evaluator/git-attribution call
 * was swallowed by an empty catch, so NEW findings lost their 'Introduced in' line with no log and
 * no reason - indistinguishable from 'no commits touched these files'.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent, waitFor } from '@testing-library/react';
import type { DeepEvalResult, EvalProgress } from '@/lib/evaluator/deep-eval-engine';
import type { DeepEvalJobSnapshot } from '@/lib/evaluator/deep-eval-job';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import { aggregateFindings } from '@/lib/evaluator/finding-collector';
import type { SubModuleId } from '@/types/modules';

const PROJECT = 'C:\Users\kazda\Documents\Unreal Projects\PoF';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ isRunning: false, sendPrompt: vi.fn(), sessionId: null }),
}));

import { logger } from '@/lib/logger';
import { useDeepEvalResults } from '@/components/modules/evaluator/DeepEvalResults/useDeepEvalResults';
import { useDeepEvalStore } from '@/stores/deepEvalStore';
import { useProjectStore } from '@/stores/projectStore';

function mk(id: string, moduleId: string): EvalFinding {
  return {
    id, scanId: 'scan', moduleId: moduleId as SubModuleId, pass: 'structure', category: 'General',
    severity: 'medium', file: `${id}.cpp`, line: 1, description: `finding ${id}`, suggestedFix: '',
    effort: 'small', timestamp: 0,
  };
}

function evalResult(scanId: string, findings: EvalFinding[], modules: string[]): DeepEvalResult {
  return {
    scanId,
    findings: aggregateFindings(findings, scanId),
    duration: 10,
    modulesEvaluated: modules,
    passesRun: ['structure'],
    failedModules: [],
    passStatuses: {} as DeepEvalResult['passStatuses'],
    passErrors: {},
  };
}

function job(result: DeepEvalResult): DeepEvalJobSnapshot {
  const progress: EvalProgress = {
    status: 'completed', currentModule: null, currentPass: null, completedSteps: 1, totalSteps: 1,
    passStatuses: {}, findings: [], error: null,
  };
  return {
    scanId: result.scanId, projectPath: PROJECT, status: 'completed', moduleIds: result.modulesEvaluated,
    progress, result, error: null, startedAt: 1, finishedAt: 2,
  };
}

let nextResult: DeepEvalResult;

function installFetch() {
  globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('/api/evaluator/git-attribution')) {
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ success: false, error: 'git exploded' }), text: () => Promise.resolve('') });
    }
    let data: unknown = { ok: true };
    if (u.includes('latest=1')) data = { scan: null };
    else if (u.startsWith('/api/evaluator/deep-eval') && init?.method === 'POST') {
      data = { scanId: nextResult.scanId, job: job(nextResult) };
    } else if (u.startsWith('/api/evaluator/deep-eval')) data = { job: null };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }), text: () => Promise.resolve('') });
  }) as unknown as typeof fetch;
}

function Harness() {
  const { handleRunEval } = useDeepEvalResults();
  return <button data-testid="run" onClick={() => { void handleRunEval(); }}>run</button>;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

beforeEach(() => {
  // A baseline exists, so the fresh finding is NEW and attribution is requested.
  useDeepEvalStore.setState({
    lastScan: { scanId: 'prev', timestamp: 1000, projectPath: PROJECT, findings: [mk('old', 'arpg-combat')] },
  });
  useProjectStore.setState({ projectPath: PROJECT, projectName: 'PoF' });
  installFetch();
});

describe('useDeepEvalResults - git attribution failures leave a trace', () => {
  it('logs one warning with the reason when the attribution route fails', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    nextResult = evalResult('scan-new', [mk('fresh', 'arpg-combat')], ['arpg-combat']);
    render(<Harness />);
    await act(async () => { fireEvent.click(screen.getByTestId('run')); });
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(String(warn.mock.calls[0][0])).toMatch(/attribution/i);
    expect(JSON.stringify(warn.mock.calls[0])).toContain('git exploded');
  });
});

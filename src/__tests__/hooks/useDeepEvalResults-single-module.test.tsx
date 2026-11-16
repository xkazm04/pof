/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): re-evaluating ONE module cleared the displayed
 * result and replaced it with a result holding only that module, so every other module's findings
 * vanished from the view (the merged baseline kept them, the view did not show them).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import type { DeepEvalResult, EvalProgress } from '@/lib/evaluator/deep-eval-engine';
import type { DeepEvalJobSnapshot } from '@/lib/evaluator/deep-eval-job';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import { aggregateFindings } from '@/lib/evaluator/finding-collector';
import type { SubModuleId } from '@/types/modules';

const PROJECT = 'C:\Users\kazda\Documents\Unreal Projects\PoF';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ isRunning: false, sendPrompt: vi.fn(), sessionId: null }),
}));

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
    let data: unknown = { ok: true };
    if (u.includes('latest=1')) data = { scan: null };
    else if (u.startsWith('/api/evaluator/deep-eval') && init?.method === 'POST') {
      data = { scanId: nextResult.scanId, job: job(nextResult) };
    } else if (u.startsWith('/api/evaluator/deep-eval')) data = { job: null };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }), text: () => Promise.resolve('') });
  }) as unknown as typeof fetch;
}

function Harness() {
  const { result, handleRunEval, handleRunSingle } = useDeepEvalResults();
  return (
    <div>
      <button data-testid="run" onClick={() => { void handleRunEval(); }}>run</button>
      <button data-testid="single" onClick={() => { void handleRunSingle('arpg-combat' as SubModuleId); }}>single</button>
      <span data-testid="modules">{result ? result.findings.modules.map((m) => m.moduleId).sort().join(',') : 'none'}</span>
      <span data-testid="total">{result ? result.findings.totalFindings : 'none'}</span>
      <span data-testid="evaluated">{result ? result.modulesEvaluated.join(',') : 'none'}</span>
    </div>
  );
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

beforeEach(() => {
  useDeepEvalStore.setState({ lastScan: null });
  useProjectStore.setState({ projectPath: PROJECT, projectName: 'PoF' });
  installFetch();
});

describe('useDeepEvalResults - single-module re-evaluation keeps the other modules', () => {
  it('shows both modules after a full run and a one-module re-evaluate', async () => {
    nextResult = evalResult('full', [mk('c1', 'arpg-combat'), mk('l1', 'arpg-loot')], ['arpg-combat', 'arpg-loot']);
    render(<Harness />);
    await act(async () => { fireEvent.click(screen.getByTestId('run')); });
    expect(screen.getByTestId('modules').textContent).toBe('arpg-combat,arpg-loot');

    nextResult = evalResult('single', [mk('c2', 'arpg-combat')], ['arpg-combat']);
    await act(async () => { fireEvent.click(screen.getByTestId('single')); });

    expect(screen.getByTestId('modules').textContent).toBe('arpg-combat,arpg-loot');
    // combat's section is the NEW one (c2 replaces c1); loot's finding is untouched
    expect(screen.getByTestId('total').textContent).toBe('2');
    expect(screen.getByTestId('evaluated').textContent).toBe('arpg-combat,arpg-loot');
  });
});

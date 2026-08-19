/**
 * The Deep Eval regression baseline belongs to exactly one project.
 *
 * NEW / PERSISTING / RESOLVED is a verdict surface. Before this change the baseline
 * carried no project identity and the hydration fetch was unscoped, so switching
 * projects diffed project B's scan against project A's findings: every B finding read
 * NEW, every A finding read RESOLVED, git attribution blamed B's commits for A's
 * findings, and `mergeBaseline` then welded both projects' findings into one blob that
 * was POSTed stamped with B's `projectId` — making the corruption durable server
 * history.
 *
 * RED against the pre-change code:
 *   • cross-project scan → `hasPrevious` true and `resolvedTotal` 1 (A's finding
 *     reported as resolved by B's scan);
 *   • hydration URL carried no `project=`;
 *   • the recorded baseline had no `projectPath`, and the POST merged A's finding in.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, act, fireEvent } from '@testing-library/react';
import type { DeepEvalResult } from '@/lib/evaluator/deep-eval-engine';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import { aggregateFindings } from '@/lib/evaluator/finding-collector';
import type { SubModuleId } from '@/types/modules';

const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const PROJECT_B = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';

// ── Module doubles ───────────────────────────────────────────────────────────

const runDeepEval = vi.fn();

vi.mock('@/lib/evaluator/deep-eval-engine', () => ({
  runDeepEval: (...args: unknown[]) => runDeepEval(...args),
  runSingleModuleEval: vi.fn(),
  cancelDeepEval: vi.fn(),
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ isRunning: false, sendPrompt: vi.fn(), sessionId: null }),
}));

import { useDeepEvalResults } from '@/components/modules/evaluator/DeepEvalResults/useDeepEvalResults';
import { useDeepEvalStore } from '@/stores/deepEvalStore';
import { useProjectStore } from '@/stores/projectStore';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function mk(id: string, moduleId = 'arpg-combat'): EvalFinding {
  return {
    id,
    scanId: 'scan',
    moduleId: moduleId as SubModuleId,
    pass: 'structure',
    category: 'General',
    severity: 'medium',
    file: `${id}.cpp`,
    line: 1,
    description: `finding ${id}`,
    suggestedFix: '',
    effort: 'small',
    timestamp: 0,
  };
}

function evalResult(findings: EvalFinding[]): DeepEvalResult {
  return {
    scanId: 'scan-current',
    findings: aggregateFindings(findings, 'scan-current'),
    duration: 10,
    modulesEvaluated: ['arpg-combat'],
    passesRun: ['structure'],
    failedModules: [],
  };
}

interface Call { url: string; init?: RequestInit }

function installFetch(latestScan: unknown = null): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const data = String(url).includes('latest=1') ? { scan: latestScan } : { ok: true };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data }),
      text: () => Promise.resolve(''),
    });
  }) as unknown as typeof fetch;
  return calls;
}

function posts(calls: Call[]): Record<string, unknown>[] {
  return calls
    .filter((c) => c.init?.method === 'POST' && c.url.includes('/api/evaluator/results'))
    .map((c) => JSON.parse(String(c.init?.body)) as Record<string, unknown>);
}

// ── Harness ──────────────────────────────────────────────────────────────────

function Harness() {
  const { diff, handleRunEval, taggingActive, discardedBaselineProject } = useDeepEvalResults();
  return (
    <div>
      <button data-testid="run" onClick={() => { void handleRunEval(); }}>run</button>
      <span data-testid="has-previous">{String(diff?.hasPrevious ?? 'none')}</span>
      <span data-testid="resolved">{diff ? diff.summary.resolvedTotal : 'none'}</span>
      <span data-testid="new">{diff ? diff.summary.newTotal : 'none'}</span>
      <span data-testid="tagging">{String(taggingActive)}</span>
      <span data-testid="discarded">{discardedBaselineProject ?? 'none'}</span>
    </div>
  );
}

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

beforeEach(() => {
  useDeepEvalStore.setState({ lastScan: null });
  useProjectStore.setState({ projectPath: PROJECT_B, projectName: 'jinx' });
  runDeepEval.mockReset();
  runDeepEval.mockResolvedValue(evalResult([mk('b1')]));
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useDeepEvalResults — the regression baseline is scoped to a project', () => {
  it('does not diff project B\'s scan against project A\'s baseline', async () => {
    installFetch();
    useDeepEvalStore.setState({
      lastScan: { scanId: 'a-1', timestamp: 1000, projectPath: PROJECT_A, findings: [mk('a1')] },
    });

    render(<Harness />);
    await act(async () => { fireEvent.click(screen.getByTestId('run')); });

    // A's finding is NOT reported as resolved by B's scan, and B has no baseline yet.
    expect(screen.getByTestId('resolved').textContent).toBe('0');
    expect(screen.getByTestId('has-previous').textContent).toBe('false');
    expect(screen.getByTestId('tagging').textContent).toBe('false');
  });

  it('says the discarded baseline belonged to another project', async () => {
    installFetch();
    useDeepEvalStore.setState({
      lastScan: { scanId: 'a-1', timestamp: 1000, projectPath: PROJECT_A, findings: [mk('a1')] },
    });

    render(<Harness />);
    await act(async () => { fireEvent.click(screen.getByTestId('run')); });

    expect(screen.getByTestId('discarded').textContent).toBe(PROJECT_A);
  });

  it('replaces the foreign baseline with this project\'s, instead of welding both together', async () => {
    const calls = installFetch();
    useDeepEvalStore.setState({
      lastScan: { scanId: 'a-1', timestamp: 1000, projectPath: PROJECT_A, findings: [mk('a1')] },
    });

    render(<Harness />);
    await act(async () => { fireEvent.click(screen.getByTestId('run')); });

    const stored = useDeepEvalStore.getState().lastScan;
    expect(stored?.projectPath).toBe(PROJECT_B);
    expect(stored?.findings.map((f) => f.id)).toEqual(['b1']);

    // …and the durable server row carries only B's findings, stamped with B.
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0].projectId).toBe(PROJECT_B);
    expect((posts(calls)[0].findings as EvalFinding[]).map((f) => f.id)).toEqual(['b1']);
  });

  it('still diffs against the baseline of the SAME project', async () => {
    installFetch();
    useDeepEvalStore.setState({
      lastScan: { scanId: 'b-0', timestamp: 1000, projectPath: PROJECT_B, findings: [mk('b0')] },
    });

    render(<Harness />);
    await act(async () => { fireEvent.click(screen.getByTestId('run')); });

    expect(screen.getByTestId('has-previous').textContent).toBe('true');
    expect(screen.getByTestId('resolved').textContent).toBe('1'); // b0 really is gone
    expect(screen.getByTestId('new').textContent).toBe('1');
    expect(screen.getByTestId('discarded').textContent).toBe('none');
  });

  it('discards a pre-scoping cached baseline rather than adopting it into this project', async () => {
    installFetch();
    useDeepEvalStore.setState({
      lastScan: { scanId: 'legacy', timestamp: 1000, findings: [mk('a1')] } as never,
    });

    render(<Harness />);
    await act(async () => { fireEvent.click(screen.getByTestId('run')); });

    expect(screen.getByTestId('has-previous').textContent).toBe('false');
    expect(screen.getByTestId('resolved').textContent).toBe('0');
  });
});

describe('useDeepEvalResults — baseline hydration is scoped too', () => {
  it('asks the server for THIS project\'s latest scan', async () => {
    const calls = installFetch();

    render(<Harness />);

    await waitFor(() => expect(calls.some((c) => c.url.includes('latest=1'))).toBe(true));
    const hydrate = calls.find((c) => c.url.includes('latest=1'))!;
    expect(hydrate.url).toContain('project=');
    expect(hydrate.url).toContain(encodeURIComponent(PROJECT_B));
  });

  it('records a hydrated server baseline stamped with the project it was scoped to', async () => {
    installFetch({
      scanId: 'server-b',
      projectId: PROJECT_B,
      scannedAt: '2026-08-19T00:00:00.000Z',
      timestamp: 500,
      durationMs: 0,
      modulesEvaluated: ['arpg-combat'],
      failedModules: [],
      totalFindings: 1,
      severityCounts: { critical: 0, high: 0, medium: 1, low: 0 },
      findings: [mk('b0')],
    });

    render(<Harness />);

    await waitFor(() =>
      expect(useDeepEvalStore.getState().baselineFor(PROJECT_B)?.scanId).toBe('server-b'),
    );
    expect(useDeepEvalStore.getState().lastScan?.projectPath).toBe(PROJECT_B);
  });

  it('refuses a server scan whose project does not match the one requested', async () => {
    installFetch({
      scanId: 'server-a',
      projectId: PROJECT_A,
      scannedAt: '2026-08-19T00:00:00.000Z',
      timestamp: 500,
      durationMs: 0,
      modulesEvaluated: ['arpg-combat'],
      failedModules: [],
      totalFindings: 1,
      severityCounts: { critical: 0, high: 0, medium: 1, low: 0 },
      findings: [mk('a1')],
    });

    render(<Harness />);

    // Give the hydration promise a turn to settle before asserting nothing landed.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(useDeepEvalStore.getState().lastScan).toBeNull();
  });
});

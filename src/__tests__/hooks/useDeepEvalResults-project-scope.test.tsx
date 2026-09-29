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
 *
 * Deep eval now runs as a server job (`/api/evaluator/deep-eval`, challenge-2026-09-28c
 * code-quality-evaluation/A): Run POSTs the job and the hook consumes the job snapshot it
 * gets back or polls for, so the scans below arrive as a completed job's `result`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, act, fireEvent } from '@testing-library/react';
import type { DeepEvalResult, EvalProgress } from '@/lib/evaluator/deep-eval-engine';
import type { DeepEvalJobSnapshot } from '@/lib/evaluator/deep-eval-job';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import { aggregateFindings } from '@/lib/evaluator/finding-collector';
import type { SubModuleId } from '@/types/modules';

const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const PROJECT_B = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';

// ── Module doubles ───────────────────────────────────────────────────────────

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
    passStatuses: { 'arpg-combat': { structure: 'done' } } as unknown as DeepEvalResult['passStatuses'],
    passErrors: {},
  };
}

function progressOf(status: EvalProgress['status'], completedSteps: number): EvalProgress {
  return {
    status,
    currentModule: null,
    currentPass: null,
    completedSteps,
    totalSteps: 8,
    passStatuses: {},
    findings: [],
    error: null,
  };
}

function job(status: EvalProgress['status'], result: DeepEvalResult | null, completedSteps = 3): DeepEvalJobSnapshot {
  return {
    scanId: 'scan-current',
    projectPath: PROJECT_B,
    status,
    moduleIds: ['arpg-combat'],
    progress: progressOf(status, completedSteps),
    result,
    error: null,
    startedAt: 1,
    finishedAt: status === 'running' ? null : 2,
  };
}

interface Call { url: string; init?: RequestInit }

/** Default job the Run POST answers with: the scan already completed with `scanResult`. */
let scanResult: DeepEvalResult;

function installFetch(latestScan: unknown = null, jobPolls: (DeepEvalJobSnapshot | null)[] = []): Call[] {
  const calls: Call[] = [];
  let poll = 0;
  globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    let data: unknown = { ok: true };
    if (u.includes('latest=1')) data = { scan: latestScan };
    else if (u.startsWith('/api/evaluator/deep-eval') && init?.method === 'POST') {
      data = { scanId: 'scan-current', job: job('completed', scanResult) };
    } else if (u.startsWith('/api/evaluator/deep-eval')) {
      data = { job: jobPolls.length ? jobPolls[Math.min(poll++, jobPolls.length - 1)] : null };
    }
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

function deepEvalStarts(calls: Call[]): Call[] {
  return calls.filter((c) => c.init?.method === 'POST' && c.url.startsWith('/api/evaluator/deep-eval'));
}

function Harness() {
  const { diff, handleRunEval, taggingActive, discardedBaselineProject, isRunning, progress } = useDeepEvalResults();
  return (
    <div>
      <span data-testid="running">{String(isRunning)}</span>
      <span data-testid="steps">{progress ? progress.completedSteps : 'none'}</span>
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
  scanResult = evalResult([mk('b1')]);
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

describe('useDeepEvalResults — a reload reattaches to the server job instead of losing it', () => {
  it('case 7: mounts onto a running job with no new start, then applies its result once on completion', async () => {
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');
    const done: DeepEvalResult = {
      ...evalResult([mk('b1'), mk('x1', 'audio')]),
      modulesEvaluated: ['arpg-combat', 'audio'],
      failedModules: ['audio'],
      passErrors: { audio: { quality: 'unparseable-output' } },
    };
    const calls = installFetch(null, [job('running', null, 3), job('completed', done, 8)]);

    render(<Harness />);

    // Reattach: the server snapshot drives progress, and no job was started.
    await waitFor(() => expect(screen.getByTestId('running').textContent).toBe('true'));
    expect(screen.getByTestId('steps').textContent).toBe('3');
    const reattach = calls.find((c) => c.url.startsWith('/api/evaluator/deep-eval?project='));
    expect(reattach?.url).toContain(encodeURIComponent(PROJECT_B));
    expect(deepEvalStarts(calls)).toHaveLength(0);

    // The poll runs on UI_TIMEOUTS.pollInterval; fire it by hand.
    const pollCall = intervalSpy.mock.calls.find((c) => c[1] === UI_TIMEOUTS.pollInterval);
    expect(pollCall).toBeDefined();
    const tick = pollCall![0] as () => void;
    await act(async () => { tick(); });

    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0].modulesEvaluated).toEqual(['arpg-combat']);
    expect(posts(calls)[0].failedModules).toEqual(['audio']);
    expect(screen.getByTestId('running').textContent).toBe('false');

    // A late extra tick (or a re-render) never records the same scan twice.
    await act(async () => { tick(); });
    await act(async () => { await Promise.resolve(); });
    expect(posts(calls)).toHaveLength(1);
    expect(deepEvalStarts(calls)).toHaveLength(0);
  });

  it('Run starts exactly one server job for this project', async () => {
    const calls = installFetch();
    render(<Harness />);
    await act(async () => { fireEvent.click(screen.getByTestId('run')); });
    const starts = deepEvalStarts(calls);
    expect(starts).toHaveLength(1);
    const body = JSON.parse(String(starts[0].init?.body)) as Record<string, unknown>;
    expect(body.projectPath).toBe(PROJECT_B);
    expect(body.moduleIds).toEqual(expect.arrayContaining(['arpg-combat']));
  });
});

describe('ResultsSection — a failed module says why', () => {
  it('names each failed pass reason, and a pass a cancel cut short', async () => {
    const { ResultsSection } = await import('@/components/modules/evaluator/DeepEvalResults/ResultsSection');
    const r: DeepEvalResult = {
      ...evalResult([]),
      modulesEvaluated: ['arpg-combat'],
      failedModules: ['audio', 'materials'],
      passStatuses: {
        audio: { structure: 'error' },
        materials: { quality: 'pending' },
      } as unknown as DeepEvalResult['passStatuses'],
      passErrors: { audio: { structure: 'cli-error: Process exited with code 1' } },
    };
    render(
      <ResultsSection
        result={r} diff={null} view="all" setView={() => {}} attribution={{}}
        expandedModules={new Set()} expandedCategories={new Set()} taggingActive={false}
        discardedBaselineProject={null} activeFindings={r.findings} toggleModule={() => {}}
        toggleCategory={() => {}} onFix={() => {}} onBatchFix={() => {}} onRunSingle={() => {}}
        isFixRunning={false} fixTargetId={null}
      />,
    );
    const banner = screen.getByTestId('pof-deep-eval-failed-modules').textContent ?? '';
    expect(banner).toContain('audio: structure: cli-error: Process exited with code 1');
    expect(banner).toContain('materials: not finished (quality)');
  });
});

/**
 * Waiting tests UE lacks: see which, preview the scaffold, author via Claude
 * (ue5-build-bridge/B, acceptance cases 5-7).
 *
 *   5. mergeWaitingPresence puts presence + a primary action on each waiting row
 *      (not-in-source -> author; everything else -> run) and counts '<k> not in UE source';
 *   6. authorReducer: the CLI finishing is never the verdict — success leaves the row
 *      'authored-unverified'; only a runWaitingTest 'settled' outcome reaches 'verified';
 *   7. the tab dispatches ONLY on explicit clicks: execute is called 0 times after mount,
 *      0 times after Author (preview only), exactly once (label 'Scaffold <testName>') after
 *      Send to Claude; the bridge is untouched until Run; a remount re-derives presence
 *      from the source scan, not from the lost CLI callback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import type { GateJob } from '@/lib/test-gate-runner/types';
import type { SettleOutcome } from '@/lib/test-gate-runner/settleFromTest';

const execute = vi.fn(async () => {});
let lastOnComplete: ((success: boolean) => void) | undefined;
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { onComplete?: (success: boolean) => void }) => {
    lastOnComplete = opts.onComplete;
    return { execute, sendPrompt: vi.fn(), isRunning: false };
  },
}));
vi.mock('@/components/cli/InlineTerminal', () => ({
  InlineTerminal: ({ sessionId }: { sessionId: string }) => <div data-testid="inline-terminal">{sessionId}</div>,
}));

import {
  groupWaitingTests, mergeWaitingPresence, notInSourceLabel, authorReducer, AUTHOR_IDLE,
  type AuthorState,
} from '@/components/modules/project-setup/TestHarnessPanel/waitingTests';
import { WaitingTestsTab } from '@/components/modules/project-setup/TestHarnessPanel/WaitingTestsTab';
import { useProjectStore } from '@/stores/projectStore';

function job(p: Partial<GateJob>): GateJob {
  return { catalogId: 'items', entityId: 'e', step: 'Test Gate', tier: 'L3', ...p };
}

const JOBS: GateJob[] = [
  job({ testName: 'VSCodexUnlockTest', catalogId: 'codex', entityId: 'a' }),
  job({ testName: 'VSCodexUnlockTest', catalogId: 'codex', entityId: 'b' }),
  job({ testName: 'VSDialogBranchTest', catalogId: 'dialog', entityId: 'gillian' }),
  job({ testName: 'Quest.Diablo.Q_DIABLO.EndToEnd', catalogId: 'quests', entityId: 'q' }),
  job({ testName: 'PoF.Map.Placed', catalogId: 'zones', entityId: 'z' }),
];

describe('mergeWaitingPresence (case 5)', () => {
  it('gives every row presence + a primary action and counts the rows UE source lacks', () => {
    const planned = [
      { testName: 'VSCodexUnlockTest', presence: 'in-source' as const },
      { testName: 'VSCodexUnlockTest', presence: 'in-source' as const },
      { testName: 'VSDialogBranchTest', presence: 'not-in-source' as const },
      { testName: 'Quest.Diablo.Q_DIABLO.EndToEnd', presence: 'ambiguous' as const },
      // PoF.Map.Placed is absent from the planned list -> unknown -> run
    ];
    const view = mergeWaitingPresence(groupWaitingTests(JOBS), planned);
    expect(view.tests.map((t) => [t.testName, t.presence, t.action])).toEqual([
      ['VSCodexUnlockTest', 'in-source', 'run'],
      ['PoF.Map.Placed', 'unknown', 'run'],
      ['Quest.Diablo.Q_DIABLO.EndToEnd', 'ambiguous', 'run'],
      ['VSDialogBranchTest', 'not-in-source', 'author'],
    ]);
    expect(view.notInSource).toBe(1);
    expect(notInSourceLabel(view)).toBe('1 not in UE source');
  });

  it('without a source scan every row is unknown -> run, and no count is claimed', () => {
    const view = mergeWaitingPresence(groupWaitingTests(JOBS), null);
    expect(view.tests.every((t) => t.presence === 'unknown' && t.action === 'run')).toBe(true);
    expect(notInSourceLabel(view)).toBeNull();
  });
});

const SCAFFOLD = { suggestedPath: 'Source/PoF/Test/VSDialogBranchTest.cpp', code: 'IMPLEMENT_SIMPLE_AUTOMATION_TEST(...)' };
const TASK = { type: 'ask-claude' as const, moduleId: 'packaging' as const, prompt: `author\n${SCAFFOLD.code}`, label: 'Scaffold VSDialogBranchTest' };
const REQ = [{ catalogId: 'dialog', entityId: 'gillian', step: 'Test Gate' }];
const SETTLED: SettleOutcome = { matched: 1, settled: 1, passed: 0, failed: 1, deferred: 0, gates: [], note: '1 gate settled.' };

describe('authorReducer (case 6)', () => {
  const preview = authorReducer(AUTHOR_IDLE, {
    type: 'preview', testName: 'VSDialogBranchTest', scaffold: SCAFFOLD, requestedBy: REQ, task: TASK as never,
  });

  it('idle -> preview -> dispatched -> authored-unverified on CLI success (no pass reported)', () => {
    expect(preview.phase).toBe('preview');
    const dispatched = authorReducer(preview, { type: 'dispatch' });
    expect(dispatched.phase).toBe('dispatched');
    const done = authorReducer(dispatched, { type: 'cli-complete', success: true });
    expect(done.phase).toBe('authored-unverified');
    expect(done).not.toHaveProperty('settle');
  });

  it('CLI failure -> author-failed with a reason', () => {
    const failed = authorReducer(authorReducer(preview, { type: 'dispatch' }), { type: 'cli-complete', success: false });
    expect(failed.phase).toBe('author-failed');
    expect(failed.phase === 'author-failed' && failed.reason).toBeTruthy();
  });

  it("only a runWaitingTest 'settled' outcome reaches verified, with the settle counts", () => {
    const authored = authorReducer(authorReducer(preview, { type: 'dispatch' }), { type: 'cli-complete', success: true });
    const busy = authorReducer(authored, { type: 'run-outcome', testName: 'VSDialogBranchTest', outcome: { kind: 'busy', scope: '*|*', since: null } });
    expect(busy.phase).toBe('authored-unverified');
    const refused = authorReducer(authored, {
      type: 'run-outcome', testName: 'VSDialogBranchTest', outcome: { kind: 'settle-error', ran: true, bridgeResult: {}, error: 'drain in flight' },
    });
    expect(refused.phase).toBe('authored-unverified');
    const other = authorReducer(authored, { type: 'run-outcome', testName: 'VSCodexUnlockTest', outcome: { kind: 'settled', bridgeResult: {}, outcome: SETTLED } });
    expect(other.phase).toBe('authored-unverified');
    const verified = authorReducer(authored, { type: 'run-outcome', testName: 'VSDialogBranchTest', outcome: { kind: 'settled', bridgeResult: {}, outcome: SETTLED } });
    expect(verified.phase).toBe('verified');
    expect(verified.phase === 'verified' && verified.settle).toMatchObject({ settled: 1, passed: 0, failed: 1 });
  });

  it('a settle before the CLI finished (or before dispatch) is not a verification', () => {
    const early: AuthorState = authorReducer(preview, { type: 'run-outcome', testName: 'VSDialogBranchTest', outcome: { kind: 'settled', bridgeResult: {}, outcome: SETTLED } });
    expect(early.phase).toBe('preview');
    const dispatched = authorReducer(preview, { type: 'dispatch' });
    expect(authorReducer(dispatched, { type: 'run-outcome', testName: 'VSDialogBranchTest', outcome: { kind: 'settled', bridgeResult: {}, outcome: SETTLED } }).phase).toBe('dispatched');
    // A CLI completion with nothing dispatched changes nothing.
    expect(authorReducer(preview, { type: 'cli-complete', success: true }).phase).toBe('preview');
  });
});

// ── case 7: the tab ─────────────────────────────────────────────────────────────────────────

const originalFetch = global.fetch;
interface Call { url: string; method: string; body?: unknown }
let calls: Call[] = [];
let dialogPresence: 'in-source' | 'not-in-source' = 'not-in-source';

function reply(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
}

beforeEach(() => {
  calls = [];
  execute.mockClear();
  lastOnComplete = undefined;
  dialogPresence = 'not-in-source';
  useProjectStore.setState({ projectPath: 'C:/UE/PoF' });
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url === '/api/pipeline-artifacts/drain?tier=L3') return reply(JOBS);
    if (url.startsWith('/api/ue-test-scaffold?') && method === 'GET') {
      return reply([
        { catalogId: 'codex', entityId: 'a', step: 'Test Gate', tier: 'L3', testName: 'VSCodexUnlockTest', scaffoldAvailable: true, presence: 'in-source' },
        { catalogId: 'dialog', entityId: 'gillian', step: 'Test Gate', tier: 'L3', testName: 'VSDialogBranchTest', scaffoldAvailable: true, presence: dialogPresence },
      ]);
    }
    if (url === '/api/ue-test-scaffold' && method === 'POST') {
      return reply({ enqueued: false, tasks: [{ testName: 'VSDialogBranchTest', task: TASK, scaffold: SCAFFOLD, requestedBy: REQ }], note: '' });
    }
    if (url === '/api/pipeline-artifacts/drain/status') return reply({ held: false, scope: null, since: null, scopes: [] });
    if (url === '/api/pof-bridge/test') return reply({ status: 'failed', testId: 'FVSDialogBranchTest' });
    if (url === '/api/pipeline-artifacts/drain/settle-test') return reply(SETTLED);
    return new Response(JSON.stringify({ success: false, error: 'not stubbed' }), { status: 500 });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

const bridgeCalls = () => calls.filter((c) => c.url.includes('/api/pof-bridge/'));
const authorPosts = () => calls.filter((c) => c.url === '/api/ue-test-scaffold' && c.method === 'POST');

describe('WaitingTestsTab author flow (case 7)', () => {
  it('previews on Author, dispatches only on Send to Claude, and never reads CLI success as a pass', async () => {
    render(<WaitingTestsTab />);
    await screen.findByText(/1 not in UE source/);
    expect(calls.some((c) => c.url.startsWith('/api/ue-test-scaffold?') && c.url.includes('projectPath='))).toBe(true);
    // Run stays available on every row; Author only where UE source lacks the test.
    for (const name of ['VSCodexUnlockTest', 'VSDialogBranchTest', 'Quest.Diablo.Q_DIABLO.EndToEnd', 'PoF.Map.Placed']) {
      expect(screen.getByRole('button', { name: `Run ${name}` })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Author VSCodexUnlockTest' })).toBeNull();
    expect(execute).toHaveBeenCalledTimes(0);

    fireEvent.click(screen.getByRole('button', { name: 'Author VSDialogBranchTest' }));
    await screen.findByText(SCAFFOLD.suggestedPath);
    expect(screen.getByText(SCAFFOLD.code)).toBeTruthy();
    expect(screen.getByText('dialog/gillian/Test Gate')).toBeTruthy();
    expect(authorPosts()).toHaveLength(1);
    expect(authorPosts()[0].body).toEqual({ action: 'authoring-tasks', testName: 'VSDialogBranchTest' });
    expect(execute).toHaveBeenCalledTimes(0);

    fireEvent.click(screen.getByRole('button', { name: 'Send to Claude' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect((execute.mock.calls[0] as unknown[])[0]).toMatchObject({ label: 'Scaffold VSDialogBranchTest' });
    expect(authorPosts()).toHaveLength(1);
    expect(bridgeCalls()).toHaveLength(0);

    // The CLI finishing is not the verdict.
    act(() => lastOnComplete?.(true));
    await screen.findByText(/authored — not verified/i);
    expect(screen.queryByText(/verified by Run \+ settle/i)).toBeNull();
    expect(bridgeCalls()).toHaveLength(0);
    expect(execute).toHaveBeenCalledTimes(1);

    // Only Run + settle verifies — and the first run of a scaffold is observed failing.
    fireEvent.click(screen.getByRole('button', { name: 'Verify VSDialogBranchTest' }));
    await screen.findByText(/verified by Run \+ settle/i);
    expect(bridgeCalls()).toHaveLength(1);
  });

  it('a remount re-derives presence from the source scan, not from the lost CLI callback', async () => {
    const first = render(<WaitingTestsTab />);
    await screen.findByText(/1 not in UE source/);
    fireEvent.click(screen.getByRole('button', { name: 'Author VSDialogBranchTest' }));
    await screen.findByText(SCAFFOLD.suggestedPath);
    fireEvent.click(screen.getByRole('button', { name: 'Send to Claude' }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    first.unmount();

    // Claude wrote the file; the callback was lost with the unmount. The disk is the truth.
    dialogPresence = 'in-source';
    render(<WaitingTestsTab />);
    await screen.findByText(/0 not in UE source/);
    expect(screen.queryByRole('button', { name: 'Author VSDialogBranchTest' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Run VSDialogBranchTest' })).toBeTruthy();
    expect(screen.queryByText(SCAFFOLD.suggestedPath)).toBeNull();
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

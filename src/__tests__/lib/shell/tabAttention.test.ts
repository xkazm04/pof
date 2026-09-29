/**
 * Tab attention (scan-sweep --challenge, shared-utility-hooks/B): the browser tab is the
 * operator's only ambient signal while minutes-long work runs in another window. The pure
 * reducer turns "what ended, and how" into a title + favicon tone that tells a failure from
 * a success and HOLDS the outcome until the tab is actually seen.
 */
import { describe, it, expect } from 'vitest';
import type { CLISessionState } from '@/components/cli/store/cliPanelStore';
import { oneShotLane, summarizeActivity, type ActivitySummary } from '@/components/layout-lab/activityModel';
import type { OneShotPhase } from '@/stores/oneShotJobStore';
import {
  fromCliSessions,
  fromLabActivity,
  initialTabAttention,
  reduceTabAttention,
  type TabAttentionState,
  type TabSignal,
} from '@/lib/shell/tabAttention';

const LINGER = 4000;

function sess(id: string, patch: Partial<CLISessionState> = {}): CLISessionState {
  return {
    id, label: id, projectPath: null, claudeSessionId: null, currentExecutionId: null, currentTaskId: null,
    isRunning: false, lastTaskSuccess: null, lastCallbackStatus: null, accentColor: 'x',
    createdAt: 0, lastActivityAt: 0, enabledSkills: [], ...patch,
  };
}
const map = (...list: CLISessionState[]) => Object.fromEntries(list.map((s) => [s.id, s]));

/** Feed a sequence of CLI snapshots through adapter + reducer, visible unless told otherwise. */
function runCli(snaps: Record<string, CLISessionState>[], visible = true): TabAttentionState {
  let state = initialTabAttention('POF');
  let prev: Record<string, CLISessionState> | null = null;
  snaps.forEach((s, i) => {
    state = reduceTabAttention(state, fromCliSessions(prev, s), visible, 1000 + i, LINGER);
    prev = s;
  });
  return state;
}

const WITH_CALLBACK = { prompt: 'do it\n@@CALLBACK:checklist-abc\n{...}', taskType: 'checklist' };
const NO_CALLBACK = { prompt: 'just answer a question', taskType: 'interactive' };

describe('tabAttention — CLI source', () => {
  it('a failed run reads "(Failed) POF" with the error tone, never "(Done)"', () => {
    const s = runCli([
      map(sess('a', { isRunning: true })),
      map(sess('a', { isRunning: false, lastTaskSuccess: false })),
    ]);
    expect(s.title).toBe('(Failed) POF');
    expect(s.tone).toBe('error');
  });

  it('a run that exited 0 but whose asked-for callback failed or went missing reads "(Not landed) POF"', () => {
    for (const cb of ['failed', 'missing'] as const) {
      const s = runCli([
        map(sess('a', { isRunning: true, lastDispatch: WITH_CALLBACK })),
        map(sess('a', { isRunning: false, lastTaskSuccess: true, lastCallbackStatus: cb, lastDispatch: WITH_CALLBACK })),
      ]);
      expect(s.title, cb).toBe('(Not landed) POF');
      expect(s.tone, cb).toBe('attention');
    }
  });

  it('coordinator revision: "missing" on a run whose prompt asked for no callback is Done', () => {
    const s = runCli([
      map(sess('a', { isRunning: true, lastDispatch: NO_CALLBACK })),
      map(sess('a', { isRunning: false, lastTaskSuccess: true, lastCallbackStatus: 'missing', lastDispatch: NO_CALLBACK })),
    ]);
    expect(s.title).toBe('(Done) POF');
    expect(s.tone).toBe('success');
  });

  it('one failure among several sessions is counted while the others still run', () => {
    const s = runCli([
      map(sess('a', { isRunning: true }), sess('b', { isRunning: true })),
      map(sess('a', { isRunning: false, lastTaskSuccess: false }), sess('b', { isRunning: true })),
    ]);
    expect(s.title).toBe('(Running · 1 failed) POF');
  });

  it('[guard] the legacy strings are unchanged', () => {
    expect(runCli([{}]).title).toBe('POF');
    expect(runCli([map(sess('a'), sess('b'), sess('c'))]).title).toBe('(3 sessions) POF');
    expect(runCli([map(sess('a', { isRunning: true }))]).title).toBe('(Running) POF');
    expect(runCli([map(sess('a', { isRunning: true }), sess('b', { isRunning: true }))]).title).toBe('(2 running) POF');
  });

  it('a first snapshot is never an edge: a persisted failure does not re-announce on load', () => {
    expect(runCli([map(sess('a', { lastTaskSuccess: false }))]).title).toBe('POF');
  });
});

describe('tabAttention — latch until seen', () => {
  const failed: TabSignal = { running: 0, ended: ['failed'], rest: null };
  const quiet: TabSignal = { running: 0, ended: [], rest: null };

  it('an outcome that arrives while hidden holds past the linger, and lingers only once seen', () => {
    let s = reduceTabAttention(initialTabAttention('POF'), failed, false, 0, LINGER);
    expect(s.latched).toBe(true);
    s = reduceTabAttention(s, quiet, false, LINGER * 10, LINGER);
    expect(s.title).toBe('(Failed) POF');
    s = reduceTabAttention(s, quiet, true, LINGER * 10 + 1, LINGER);
    expect(s.latched).toBe(false);
    expect(s.title).toBe('(Failed) POF');
    s = reduceTabAttention(s, quiet, true, LINGER * 11 + 1, LINGER);
    expect(s.title).toBe('POF');
    expect(s.tone).toBe('none');
  });
});

describe('tabAttention — lab source (ActivitySummary)', () => {
  const lab = (phase: OneShotPhase): ActivitySummary => summarizeActivity({
    drain: { localDrain: null, lease: { held: false, scope: null, since: null, scopes: [] }, leaseProbe: 'ok' },
    oneShot: { phase, catalogId: 'spellbook', currentStepIndex: 0, totalSteps: 4, refinementTurns: 0 },
    forge: { activePolls: 0 },
  });
  function runLab(...phases: OneShotPhase[]): TabAttentionState {
    let state = initialTabAttention('Lab');
    let prev: ActivitySummary | null = null;
    phases.forEach((p, i) => {
      const next = lab(p);
      state = reduceTabAttention(state, fromLabActivity(prev, next), true, 1000 + i, LINGER);
      prev = next;
    });
    return state;
  }

  it('the one-shot lane still speaks the labels this adapter reads', () => {
    expect(oneShotLane({ phase: 'failed', catalogId: 'x', currentStepIndex: 0, totalSteps: 1, refinementTurns: 0 }).state).toBe('attention');
  });

  it('running-here -> attention with a failed one-shot lane reads "(Failed)"', () => {
    const s = runLab('running', 'failed');
    expect(s.title).toBe('(Failed) Lab');
    expect(s.tone).toBe('error');
  });

  it('running-here -> attention awaiting the operator reads "(Needs you)"', () => {
    const s = runLab('proposing', 'awaitingRun');
    expect(s.title).toBe('(Needs you) Lab');
    expect(s.tone).toBe('attention');
  });

  it('running-here -> idle reads "(Done)"', () => {
    expect(runLab('running', 'completed').title).toBe('(Done) Lab');
  });

  it('idle -> idle leaves the base title', () => {
    const s = runLab('idle', 'idle');
    expect(s.title).toBe('Lab');
    expect(s.tone).toBe('none');
  });
});

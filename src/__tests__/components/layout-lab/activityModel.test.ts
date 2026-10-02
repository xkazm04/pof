import { describe, it, expect } from 'vitest';
import {
  summarizeActivity,
  drainLane,
  oneShotLane,
  forgeLane,
  type ActivityInput,
  type DrainInput,
} from '@/components/layout-lab/activityModel';
import { fromLabActivity } from '@/lib/shell/tabAttention';
import { emptyBatchSummary, type BatchDrainSummary } from '@/components/layout-lab/batchDrainModel';
import type { DrainRun } from '@/components/layout-lab/labRunnerStore';

const IDLE_INPUT: ActivityInput = {
  drain: { localDrain: null, lease: { held: false, scope: null, since: null, scopes: [] }, leaseProbe: 'ok' },
  oneShot: { phase: 'idle', catalogId: null, currentStepIndex: 0, totalSteps: 0, refinementTurns: 0 },
  forge: { activePolls: 0 },
};

const withDrain = (drain: Partial<DrainInput>): ActivityInput => ({ ...IDLE_INPUT, drain: { ...IDLE_INPUT.drain, ...drain } });

describe('activityModel — the drain lane never fakes an idle editor', () => {
  it('is UNKNOWN before the first lease poll returns (the pre-first-poll window)', () => {
    // The regression this guards: the old chip initialised `lease = null` and rendered
    // "Runner · idle" — a free UE editor — while it had asked nobody yet.
    const lane = drainLane({ localDrain: null, lease: null, leaseProbe: 'unpolled' });
    expect(lane.state).toBe('unknown');
    expect(lane.label).toMatch(/not checked yet/i);
    expect(lane.label).not.toMatch(/free|available/i);
  });

  it('is UNKNOWN when the lease read failed, not idle', () => {
    // `fetchDrainLease` returns null on failure too — indistinguishable from "no lease"
    // unless the probe outcome is carried separately, which is why `leaseProbe` exists.
    const lane = drainLane({ localDrain: null, lease: null, leaseProbe: 'failed' });
    expect(lane.state).toBe('unknown');
    expect(lane.label).toMatch(/unreachable/i);
  });

  it('separates MY session draining from a lease this page did not start', () => {
    const mine = drainLane({ localDrain: 'items · 3 sets', lease: null, leaseProbe: 'unpolled' });
    expect(mine.state).toBe('running-here');
    expect(mine.label).toContain('items · 3 sets');

    const theirs = drainLane({
      localDrain: null,
      lease: { held: true, scope: 'items/item-1', since: null, scopes: ['items/item-1'] },
      leaseProbe: 'ok',
    });
    expect(theirs.state).toBe('running-elsewhere');
    expect(theirs.label).toContain('items/item-1');
    expect(theirs.state).not.toBe(mine.state);
  });

  it('reports idle ONLY when a successful poll said the lease is free', () => {
    const lane = drainLane({ localDrain: null, lease: { held: false, scope: null, since: null, scopes: [] }, leaseProbe: 'ok' });
    expect(lane.state).toBe('idle');
  });
});

describe('activityModel — one-shot and forge lanes', () => {
  it('maps every running one-shot phase to running-here with its progress', () => {
    const base = { catalogId: 'items', currentStepIndex: 2, totalSteps: 10, refinementTurns: 2 } as const;
    expect(oneShotLane({ ...base, phase: 'analyzing' })).toMatchObject({ state: 'running-here' });
    expect(oneShotLane({ ...base, phase: 'proposing' })).toMatchObject({ state: 'running-here' });
    expect(oneShotLane({ ...base, phase: 'refining' }).label).toContain('refine 2/3');
    expect(oneShotLane({ ...base, phase: 'running' }).label).toContain('step 3/10');
  });

  it('a failed or awaiting job needs the operator, a completed one does not', () => {
    const base = { catalogId: 'items', currentStepIndex: 0, totalSteps: 0, refinementTurns: 0 } as const;
    expect(oneShotLane({ ...base, phase: 'failed' }).state).toBe('attention');
    expect(oneShotLane({ ...base, phase: 'awaitingRun' }).state).toBe('attention');
    expect(oneShotLane({ ...base, phase: 'completed' }).state).toBe('idle');
    expect(oneShotLane({ ...base, phase: 'idle' }).state).toBe('idle');
  });

  it('counts the forge background polls that outlive their module', () => {
    expect(forgeLane({ activePolls: 0 }).state).toBe('idle');
    const one = forgeLane({ activePolls: 1 });
    expect(one.state).toBe('running-here');
    expect(one.label).toContain('1 background generation poll ');
    expect(forgeLane({ activePolls: 3 }).label).toContain('3 background generation polls');
  });

  it('every lane names what it cannot see', () => {
    for (const lane of summarizeActivity(IDLE_INPUT).lanes) {
      expect(lane.blindSpot.length).toBeGreaterThan(20);
    }
  });
});

describe('summarizeActivity — one answer for the whole lab', () => {
  it('covers both job systems in one read', () => {
    const ids = summarizeActivity(IDLE_INPUT).lanes.map((l) => l.id);
    expect(ids).toEqual(['drain', 'one-shot', 'forge']);
  });

  it('says "Nothing running" only when every lane is known and idle', () => {
    expect(summarizeActivity(IDLE_INPUT)).toMatchObject({ state: 'idle', label: 'Nothing running' });
  });

  it('an unknown lane outranks idle ones — the chip never reads idle while blind', () => {
    const s = summarizeActivity(withDrain({ lease: null, leaseProbe: 'unpolled' }));
    expect(s.state).toBe('unknown');
    expect(s.label).toMatch(/^Unknown/);
    expect(s.label).not.toContain('Nothing running');
  });

  it('a run in this session outranks everything else', () => {
    const s = summarizeActivity({
      ...withDrain({ localDrain: 'items · 2 sets' }),
      oneShot: { phase: 'running', catalogId: 'items', currentStepIndex: 1, totalSteps: 4, refinementTurns: 0 },
      forge: { activePolls: 2 },
    });
    expect(s.state).toBe('running-here');
    // Both engines are NAMED in the single collapsed line — that is the unification.
    expect(s.label).toContain('drain');
    expect(s.label).toContain('one-shot');
    expect(s.label).toContain('gen');
  });

  it('a lease held elsewhere outranks an unknown or failed lane', () => {
    const s = summarizeActivity({
      ...withDrain({ lease: { held: true, scope: 'spellbook/s1', since: null, scopes: [] }, leaseProbe: 'ok' }),
      oneShot: { phase: 'failed', catalogId: 'items', currentStepIndex: 0, totalSteps: 0, refinementTurns: 0 },
      forge: { activePolls: 0 },
    });
    expect(s.state).toBe('running-elsewhere');
    expect(s.detail).toContain('spellbook/s1');
    // The failed job is still readable in the per-lane detail — nothing is swallowed.
    expect(s.detail).toContain('failed');
  });
});

const FREE = { held: false, scope: null, since: null, scopes: [] };
const batchRun = (over: Partial<DrainRun> & { summary?: BatchDrainSummary | null }): DrainRun => ({
  id: 'batch:items', kind: 'batch', catalogId: 'items', entityIds: ['e1', 'e2'], scope: 'items · 2 sets',
  phase: 'done', cancelRequested: false, cancelEffect: null, summary: emptyBatchSummary(), startedAt: 1, ...over,
});

describe('drainLane — a finished drain is reported by its OUTCOME, not as idle', () => {
  it('a done batch with a failed gate needs you, names the catalog and reads as Failed in the tab', () => {
    const failedRun = batchRun({ summary: { ...emptyBatchSummary(), entitiesRun: 2, ran: 2, passed: 1, failed: 1 } });
    const lane = drainLane({ runs: [failedRun], lease: null, leaseProbe: 'ok' });
    expect(lane.state).toBe('attention');
    expect(lane.label).toContain('items');
    expect(lane.label).toMatch(/· failed$/);

    const running = summarizeActivity({ ...IDLE_INPUT, drain: { runs: [batchRun({ phase: 'running' })], lease: null, leaseProbe: 'ok' } });
    const ended = summarizeActivity({ ...IDLE_INPUT, drain: { runs: [failedRun], lease: null, leaseProbe: 'ok' } });
    expect(running.lanes[0].state).toBe('running-here');
    expect(fromLabActivity(running, ended).ended).toEqual(['failed']);
  });

  it('a done batch that ran 0 gates (all skipped) is attention saying 0 gates ran — never idle', () => {
    const lane = drainLane({ runs: [batchRun({ summary: { ...emptyBatchSummary(), ran: 0, skipped: 3 } })], lease: FREE, leaseProbe: 'ok' });
    expect(lane.state).toBe('attention');
    expect(lane.label).toMatch(/0 gates ran/);
    expect(lane.label).toMatch(/· failed$/);
  });

  it('a locked or errored batch is attention too', () => {
    expect(drainLane({ runs: [batchRun({ summary: { ...emptyBatchSummary(), entitiesLocked: 2 } })], lease: FREE, leaseProbe: 'ok' }).state).toBe('attention');
    expect(drainLane({ runs: [batchRun({ summary: { ...emptyBatchSummary(), entitiesErrored: 2 } })], lease: FREE, leaseProbe: 'ok' }).state).toBe('attention');
  });

  it('a clean done batch falls back to the lease (idle when free)', () => {
    const lane = drainLane({ runs: [batchRun({ summary: { ...emptyBatchSummary(), entitiesRun: 2, ran: 2, passed: 2 } })], lease: FREE, leaseProbe: 'ok' });
    expect(lane.state).toBe('idle');
  });

  it('a running batch with a registered cancel says so from the run flag', () => {
    const lane = drainLane({ runs: [batchRun({ phase: 'running', cancelRequested: true })], lease: null, leaseProbe: 'unpolled' });
    expect(lane.state).toBe('running-here');
    expect(lane.label).toContain('items · 2 sets');
    expect(lane.label).toContain('cancel requested');
  });

  it('a lease held elsewhere still outranks a finished local run', () => {
    const failedRun = batchRun({ summary: { ...emptyBatchSummary(), ran: 1, failed: 1 } });
    const lane = drainLane({ runs: [failedRun], lease: { held: true, scope: 'spellbook/s1', since: null, scopes: [] }, leaseProbe: 'ok' });
    expect(lane.state).toBe('running-elsewhere');
  });
});

import { describe, it, expect } from 'vitest';
import {
  summarizeActivity,
  drainLane,
  oneShotLane,
  forgeLane,
  type ActivityInput,
  type DrainInput,
} from '@/components/layout-lab/activityModel';

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

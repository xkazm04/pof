/**
 * scan-sweep --challenge (core-engine-planning-shell/B): a time budget becomes a
 * dependency-safe build session. The plan already knows every remaining
 * feature's effort, impact and prerequisites but could only build one row at a
 * time, and could not queue a feature that becomes ready only after another
 * feature in the same run lands.
 *
 * `planBuildSession` picks greedily by impact per minute among ready features,
 * re-evaluating readiness after every pick (isFeatureDone), so in-session unlocks
 * are eligible; its projection is RECOMPUTED over the hypothetical statuses.
 * `advanceBuildSession` is the run reducer: it advances only on a confirmed
 * landing and stops, naming the step and the failure, on anything else.
 */
import { describe, it, expect } from 'vitest';
import { buildDependencyMap } from '@/lib/feature-definitions';
import { generatePlan } from '@/lib/implementation-planner/plan-generator';
import { isFeatureDone } from '@/lib/constellation/layout';
import type { FeatureStatus } from '@/types/feature-matrix';
import {
  planBuildSession,
  advanceBuildSession,
  type BuildSessionState,
} from '@/lib/implementation-planner/build-session';

const depMap = buildDependencyMap();
const doneIn = (s: ReadonlyMap<string, string>, key: string) =>
  isFeatureDone((s.get(key) ?? 'unknown') as FeatureStatus);
const readyCount = (s: Map<string, string>) => generatePlan(s).items.filter((i) => i.isReady).length;

describe('planBuildSession — budgeted, dependency-safe run', () => {
  it('fits the budget and orders every step after its prerequisites', () => {
    const s = new Map<string, string>();
    const session = planBuildSession(s, { budgetMinutes: 120 });
    expect(session.steps.length).toBeGreaterThan(0);
    expect(session.steps.reduce((sum, st) => sum + st.minutes, 0)).toBeLessThanOrEqual(120);
    expect(session.totalMinutes).toBe(session.steps.reduce((sum, st) => sum + st.minutes, 0));
    session.steps.forEach((step, i) => {
      const earlier = new Set(session.steps.slice(0, i).map((st) => st.key));
      for (const dep of depMap.get(step.key)?.deps ?? []) {
        expect(doneIn(s, dep.key) || earlier.has(dep.key)).toBe(true);
      }
    });
  });

  it('a large budget queues a feature that becomes ready inside the session', () => {
    const session = planBuildSession(new Map(), { budgetMinutes: 600 });
    const unlocked = session.steps
      .map((st, i) => ({ st, i }))
      .filter(({ st }) => st.unlockedBy !== undefined);
    expect(unlocked.length).toBeGreaterThan(0);
    for (const { st, i } of unlocked) {
      const earlierKeys = session.steps.slice(0, i).map((e) => e.key);
      expect(earlierKeys).toContain(st.unlockedBy);
    }
  });

  it('projected.readyAfter is recomputed over the hypothetical statuses', () => {
    const s = new Map<string, string>();
    const session = planBuildSession(s, { budgetMinutes: 600 });
    const after = new Map(s);
    for (const st of session.steps) after.set(st.key, 'implemented');
    expect(session.projected.readyBefore).toBe(readyCount(s));
    expect(session.projected.readyAfter).toBe(readyCount(after));
    expect(session.projected.doneAfter).toBe(generatePlan(after).implementedCount);
  });

  it('deselecting a step drops it and every step that waited on it', () => {
    const s = new Map<string, string>();
    const full = planBuildSession(s, { budgetMinutes: 600 });
    const k = full.steps.find((st) => st.unlockedBy !== undefined)!.unlockedBy!;
    const trimmed = planBuildSession(s, { budgetMinutes: 600, exclude: [k] });
    expect(trimmed.steps.map((st) => st.key)).not.toContain(k);
    for (const st of trimmed.steps) {
      expect((depMap.get(st.key)?.deps ?? []).map((d) => d.key)).not.toContain(k);
      expect(st.unlockedBy).not.toBe(k);
    }
  });

  it('a budget below the cheapest ready task yields no steps and says why', () => {
    const session = planBuildSession(new Map(), { budgetMinutes: 10 });
    expect(session.steps).toEqual([]);
    expect(session.emptyReason).toBe('Budget is below the cheapest ready task (15m)');
  });
});

describe('advanceBuildSession — advance on confirmed landing, stop on failure', () => {
  const steps = planBuildSession(new Map(), { budgetMinutes: 240 }).steps;
  const running = (index: number): BuildSessionState => ({ phase: 'running', index, steps });

  it('a confirmed landing advances and emits the next step; the last one finishes', () => {
    expect(steps.length).toBeGreaterThan(1);
    const next = advanceBuildSession(running(0), { type: 'complete', success: true, callbackStatus: 'confirmed' });
    expect(next.state).toMatchObject({ phase: 'running', index: 1 });
    expect(next.emit).toBe(steps[1]);
    const last = advanceBuildSession(running(steps.length - 1), {
      type: 'complete', success: true, callbackStatus: 'confirmed',
    });
    expect(last.state).toMatchObject({ phase: 'done', built: steps.length });
    expect(last.emit).toBeNull();
  });

  it('a failed run or a missing callback stops at that step with a named reason', () => {
    const failed = advanceBuildSession(running(1), { type: 'complete', success: false });
    expect(failed.state).toMatchObject({ phase: 'stopped', index: 1 });
    expect(failed.emit).toBeNull();
    const reason = (failed.state as Extract<BuildSessionState, { phase: 'stopped' }>).reason;
    expect(reason).toContain(steps[1].featureName);
    expect(reason).toContain('run failed');

    const missing = advanceBuildSession(running(0), { type: 'complete', success: true, callbackStatus: 'missing' });
    expect(missing.state).toMatchObject({ phase: 'stopped', index: 0 });
    expect(missing.emit).toBeNull();
    const why = (missing.state as Extract<BuildSessionState, { phase: 'stopped' }>).reason;
    expect(why).toContain(steps[0].featureName);
    expect(why).toContain('callback missing');
  });
});

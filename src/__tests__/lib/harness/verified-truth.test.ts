import { describe, it, expect } from 'vitest';
import {
  updatePlanStats,
  selfReportedRatePct,
  verifiedRatePct,
  planRatePct,
} from '@/lib/harness/plan-builder';
import { createDefaultConfig } from '@/lib/harness/orchestrator';
import type { GamePlan, PlannedFeature, ModuleArea, AreaStatus } from '@/lib/harness/types';

// ── fixtures ─────────────────────────────────────────────────────────────────

function feat(
  name: string,
  status: PlannedFeature['status'] = 'pending',
  verified?: boolean,
): PlannedFeature {
  return { id: `mod::${name}`, name, status, quality: null, lastSession: null, ...(verified != null ? { verified } : {}) };
}

function area(id: string, status: AreaStatus, features: PlannedFeature[]): ModuleArea {
  return {
    id, moduleId: 'arpg-combat' as never, label: id, description: '',
    checklistItemIds: [], featureNames: [], dependsOn: [], status, features,
  };
}

function makePlan(areas: ModuleArea[]): GamePlan {
  return {
    game: 'P', projectPath: '', ueVersion: '5.8', iteration: 1,
    totalFeatures: areas.reduce((n, a) => n + a.features.length, 0),
    passingFeatures: 0, createdAt: '', updatedAt: '', areas,
  };
}

// ── verified vs self-reported numerators ─────────────────────────────────────

describe('updatePlanStats — verified vs self-reported numerators', () => {
  it('counts a gate-verified pass in BOTH numerators', () => {
    const plan = makePlan([area('core', 'completed', [feat('x', 'pass', true), feat('y', 'pass', true)])]);
    updatePlanStats(plan);
    expect(plan.passingFeatures).toBe(2);
    expect(plan.verifiedFeatures).toBe(2);
  });

  it('a self-reported pass with verified:false counts only in passingFeatures', () => {
    // e.g. a UE tree with no env → required compile gate unverifiable → not verified.
    const plan = makePlan([area('core', 'failed', [feat('x', 'pass', false), feat('y', 'pass', false)])]);
    updatePlanStats(plan);
    expect(plan.passingFeatures).toBe(2);
    expect(plan.verifiedFeatures).toBe(0);
  });

  it('treats a missing verified flag as NOT verified (conservative)', () => {
    const plan = makePlan([area('core', 'completed', [feat('x', 'pass')])]);
    updatePlanStats(plan);
    expect(plan.passingFeatures).toBe(1);
    expect(plan.verifiedFeatures).toBe(0);
  });

  it('excludes completed-with-gaps areas from BOTH numerators', () => {
    const plan = makePlan([
      area('core', 'completed', [feat('x', 'pass', true)]),
      area('ai', 'completed-with-gaps', [feat('z', 'pass', true)]),
    ]);
    updatePlanStats(plan);
    expect(plan.passingFeatures).toBe(1); // only core
    expect(plan.verifiedFeatures).toBe(1); // only core
  });
});

// ── rate math ────────────────────────────────────────────────────────────────

describe('rate math', () => {
  const plan = makePlan([
    area('a', 'completed', [feat('x', 'pass', true), feat('y', 'pass', false)]),
    area('b', 'failed', [feat('z', 'pass', false), feat('w', 'fail', false)]),
  ]);
  updatePlanStats(plan); // passing=3, verified=1, total=4

  it('selfReportedRatePct counts every reported pass', () => {
    expect(selfReportedRatePct(plan)).toBe(75); // 3/4
  });

  it('verifiedRatePct counts only gate-backed passes', () => {
    expect(verifiedRatePct(plan)).toBe(25); // 1/4
  });

  it('planRatePct selects the basis; verified is the default lens', () => {
    expect(planRatePct(plan, 'verified')).toBe(25);
    expect(planRatePct(plan, 'self-reported')).toBe(75);
  });

  it('zero-feature plan rates to 0, not NaN', () => {
    const empty = makePlan([]);
    updatePlanStats(empty);
    expect(verifiedRatePct(empty)).toBe(0);
    expect(selfReportedRatePct(empty)).toBe(0);
  });
});

// ── config flag ──────────────────────────────────────────────────────────────

describe('createDefaultConfig — passRateBasis', () => {
  const base = { projectPath: 'C:/p', projectName: 'P', ueVersion: '5.8' };

  it('defaults to verified', () => {
    expect(createDefaultConfig({ ...base }).passRateBasis).toBe('verified');
  });

  it('preserves an explicit self-reported opt-out', () => {
    expect(createDefaultConfig({ ...base, passRateBasis: 'self-reported' }).passRateBasis).toBe('self-reported');
  });
});

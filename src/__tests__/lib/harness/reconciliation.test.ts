import { describe, it, expect } from 'vitest';
import {
  normalizeFeatureKey,
  buildFeatureIndex,
  matchFeature,
  reconcileReportedFeatures,
  markUnreportedUnverified,
  type ReconcilableFeature,
  type ReportedFeature,
} from '@/lib/harness/feature-match';
import { updatePlanStats } from '@/lib/harness/plan-builder';
import type { GamePlan, PlannedFeature, ModuleArea, AreaStatus } from '@/lib/harness/types';

function feat(name: string, status: PlannedFeature['status'] = 'pending'): PlannedFeature {
  return { id: `mod::${name}`, name, status, quality: null, lastSession: null };
}

function report(name: string, status: 'pass' | 'fail' = 'pass'): ReportedFeature {
  return { name, status, quality: 4, notes: status === 'fail' ? 'broke' : '' };
}

// ── normalized matching (Direction 2, path 3: no more fuzzy substring) ───────

describe('normalizeFeatureKey', () => {
  it('folds case, punctuation, and whitespace', () => {
    expect(normalizeFeatureKey('Attack Combo!')).toBe('attack combo');
    expect(normalizeFeatureKey('  dodge_roll  ')).toBe('dodge roll');
    expect(normalizeFeatureKey('HUD/Health-Bar')).toBe('hud health bar');
  });
});

describe('matchFeature — exact/normalized only', () => {
  const features = [feat('Attack Combo'), feat('Dodge Roll')];
  const index = buildFeatureIndex(features);

  it('matches on a normalized name', () => {
    expect(matchFeature(index, 'attack  combo')?.name).toBe('Attack Combo');
    expect(matchFeature(index, 'ATTACK COMBO')?.name).toBe('Attack Combo');
  });

  it('matches on the moduleId::name id form', () => {
    expect(matchFeature(index, 'mod::Dodge Roll')?.name).toBe('Dodge Roll');
  });

  it('does NOT fuzzy-substring match (the mis-match bug)', () => {
    // "attack" is a substring of "Attack Combo" — the old matcher wrongly bound it.
    expect(matchFeature(index, 'attack')).toBeNull();
    expect(matchFeature(index, 'combo')).toBeNull();
  });

  it('returns null for a genuinely unknown feature', () => {
    expect(matchFeature(index, 'teleport')).toBeNull();
  });
});

// ── reconcile: no force-pass on mismatch (paths 1 + 3) ───────────────────────

describe('reconcileReportedFeatures', () => {
  it('applies pass/fail/quality to exactly-matched features', () => {
    const features = [feat('Attack Combo'), feat('Dodge Roll')];
    const res = reconcileReportedFeatures(features as ReconcilableFeature[], [report('Attack Combo'), report('Dodge Roll', 'fail')], 3);
    expect(res.matched).toBe(2);
    expect(res.unmatched).toEqual([]);
    expect(features[0].status).toBe('pass');
    expect(features[0].quality).toBe(4);
    expect(features[1].status).toBe('fail');
    expect(features[1].failReason).toBe('broke');
  });

  it('path 1: all-pass reports with ZERO matches force-pass NOTHING', () => {
    const features = [feat('Attack Combo'), feat('Dodge Roll')];
    // Model reports success for features whose names do not exist in the plan.
    const res = reconcileReportedFeatures(features as ReconcilableFeature[], [report('Fireball'), report('Ice Lance')], 3);
    expect(res.matched).toBe(0);
    expect(res.unmatched).toEqual(['Fireball', 'Ice Lance']);
    // Crucially: the planned features are UNTOUCHED (still pending, not pass q4).
    expect(features.every((f) => f.status === 'pending')).toBe(true);
    expect(features.every((f) => f.quality === null)).toBe(true);
  });

  it('path 3: a substring report does not bind a differently-named feature', () => {
    const features = [feat('Attack Combo')];
    const res = reconcileReportedFeatures(features as ReconcilableFeature[], [report('attack')], 3);
    expect(res.matched).toBe(0);
    expect(features[0].status).toBe('pending');
  });
});

describe('markUnreportedUnverified', () => {
  it('flips leftover pending features to unverified with a reason', () => {
    const features = [feat('a', 'pass'), feat('b', 'pending'), feat('c', 'fail')];
    const n = markUnreportedUnverified(features as ReconcilableFeature[]);
    expect(n).toBe(1);
    expect(features[1].status).toBe('unverified');
    expect(features[1].failReason).toBe('Not reported by executor session');
    // Terminal statuses untouched.
    expect(features[0].status).toBe('pass');
    expect(features[2].status).toBe('fail');
  });
});

// ── pass-rate exclusion for completed-with-gaps (path 4) ─────────────────────

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

describe('updatePlanStats — promote-with-gaps excluded from the numerator', () => {
  it('does NOT count passing features inside a completed-with-gaps area', () => {
    const plan = makePlan([
      area('core', 'completed', [feat('x', 'pass'), feat('y', 'pass')]),
      // This area was promoted-with-gaps; even though it has a genuinely-passing
      // feature, it must not inflate the pass-rate numerator.
      area('ai', 'completed-with-gaps', [feat('z', 'pass'), feat('w', 'unverified')]),
    ]);
    updatePlanStats(plan);
    expect(plan.passingFeatures).toBe(2); // only core's two, NOT ai's 'z'
    expect(plan.totalFeatures).toBe(4);   // denominator still counts all
  });

  it('counts passing features in genuinely-completed and even failed areas', () => {
    const plan = makePlan([
      area('core', 'completed', [feat('x', 'pass')]),
      area('ui', 'failed', [feat('a', 'pass'), feat('b', 'fail')]),
    ]);
    updatePlanStats(plan);
    expect(plan.passingFeatures).toBe(2); // core's x + ui's a (a real verified pass)
  });
});

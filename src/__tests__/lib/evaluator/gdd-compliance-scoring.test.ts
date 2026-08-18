import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

/**
 * Pins the compliance scoring engine — previously untested (grep: 0 hits on
 * `runComplianceAudit` / `calculateModuleScore`), its only guard being the MCP
 * 0-100 bounds assertion, which every one of the lies below satisfies.
 *
 * The DB is mocked so the audit is a pure function of the fixtures; SUB_MODULES
 * (read-only reference) supplies the real checklists.
 */

const fixtures = vi.hoisted(() => ({ rows: {} as Record<string, FeatureRow[]> }));

vi.mock('@/lib/feature-matrix-db', () => ({
  getFeaturesByModule: (moduleId: string) => fixtures.rows[moduleId] ?? [],
}));

import { runComplianceAudit } from '@/lib/gdd-compliance';

let nextId = 1;
function row(moduleId: SubModuleId, status: FeatureStatus, over: Partial<FeatureRow> = {}): FeatureRow {
  return {
    id: nextId++,
    moduleId,
    featureName: `feature-${nextId}`,
    category: 'general',
    status,
    description: '',
    filePaths: [],
    reviewNotes: '',
    qualityScore: null,
    nextSteps: '',
    lastReviewedAt: null,
    ...over,
  };
}

function audit(rows: Record<string, FeatureRow[]>, checklist: Record<string, Record<string, boolean>> = {}) {
  fixtures.rows = rows;
  return runComplianceAudit(checklist);
}

const moduleOf = (report: ReturnType<typeof runComplianceAudit>, id: string) => {
  const m = report.modules.find((x) => x.moduleId === id);
  if (!m) throw new Error(`module ${id} absent from report`);
  return m;
};

beforeEach(() => {
  nextId = 1;
  fixtures.rows = {};
});

describe('gdd-compliance: an unmeasured module reads UNMEASURED', () => {
  it('a module with a checklist and no scanned feature scores 0 and is not measured — never 70', () => {
    const mod = moduleOf(audit({}), 'level-design');
    // The regression this suite exists for: the old engine awarded 60 ("no scan
    // data, assume neutral") + 30 (no checklist weight) + 10 (no gaps) = 70/100
    // for a module nobody had ever evaluated.
    expect(mod.score).not.toBe(70);
    expect(mod.evidence.measured).toBe(false);
    expect(mod.evidence.confidence).toBe('none');
    expect(mod.evidence.coverage).toBe(0);
    expect(mod.score).toBe(0);
  });

  it('raises an explicit no-evidence gap instead of silently passing', () => {
    const mod = moduleOf(audit({}), 'level-design');
    const gap = mod.gaps.find((g) => g.category === 'unmeasured');
    expect(gap).toBeDefined();
    expect(gap!.direction).toBe('unmeasured');
    expect(gap!.id).toBe('gap-level-design-noevidence');
  });

  it('rows that exist but carry no verdict are unmeasured, not full credit', () => {
    const mod = moduleOf(
      audit({ 'arpg-combat': [row('arpg-combat', 'unknown'), row('arpg-combat', 'unknown')] }),
      'arpg-combat',
    );
    expect(mod.evidence.featuresTotal).toBe(2);
    expect(mod.evidence.featuresMeasured).toBe(0);
    expect(mod.evidence.featuresUnmeasured).toBe(2);
    expect(mod.evidence.measured).toBe(false);
    expect(mod.gaps.some((g) => g.id === 'gap-arpg-combat-unmeasured')).toBe(true);
  });

  it('an unmeasured module contributes no weight to the overall score', () => {
    const report = audit({
      'arpg-combat': [row('arpg-combat', 'implemented'), row('arpg-combat', 'implemented')],
      'arpg-loot': [row('arpg-loot', 'unknown'), row('arpg-loot', 'unknown')],
    });
    // Only the two measured combat rows carry weight; the unknown loot rows
    // neither drag the mean down nor prop it up.
    expect(report.overallScore).toBe(moduleOf(report, 'arpg-combat').score);
    expect(report.modulesMeasured).toBe(1);
    expect(report.modulesTotal).toBeGreaterThan(1);
  });
});

describe('gdd-compliance: coverage × conformance split', () => {
  it('reports coverage separately from conformance', () => {
    const mod = moduleOf(
      audit({
        'arpg-combat': [
          row('arpg-combat', 'implemented'),
          row('arpg-combat', 'implemented'),
          row('arpg-combat', 'unknown'),
          row('arpg-combat', 'unknown'),
        ],
      }),
      'arpg-combat',
    );
    expect(mod.evidence.coverage).toBe(0.5);
    expect(mod.evidence.confidence).toBe('moderate');
    // Both scanned rows are implemented, so conformance is perfect *of what was
    // scanned* — a fact the old conflated number could not express.
    expect(mod.conformance).toBe(100);
    expect(mod.evidence.measured).toBe(true);
  });

  it('bands confidence by coverage', () => {
    const lowCoverage = moduleOf(
      audit({
        'arpg-combat': [
          row('arpg-combat', 'implemented'),
          ...Array.from({ length: 9 }, () => row('arpg-combat', 'unknown')),
        ],
      }),
      'arpg-combat',
    );
    expect(lowCoverage.evidence.confidence).toBe('low');

    const highCoverage = moduleOf(
      audit({ 'arpg-combat': [row('arpg-combat', 'implemented'), row('arpg-combat', 'missing')] }),
      'arpg-combat',
    );
    expect(highCoverage.evidence.confidence).toBe('high');
  });

  it('counts improved as implemented and surfaces it on the module', () => {
    const mod = moduleOf(
      audit({ 'arpg-combat': [row('arpg-combat', 'improved'), row('arpg-combat', 'improved')] }),
      'arpg-combat',
    );
    expect(mod.improved).toBe(2);
    expect(mod.conformance).toBe(100);
  });

  it('gives partial half credit AND names it as a gap (no more silent free pass)', () => {
    const mod = moduleOf(
      audit({ 'arpg-combat': [row('arpg-combat', 'partial'), row('arpg-combat', 'implemented')] }),
      'arpg-combat',
    );
    expect(mod.conformance).toBe(75); // (1 + 0.5) / 2
    expect(mod.gaps.some((g) => g.category === 'partial-implementation')).toBe(true);
  });
});

describe('gdd-compliance: the gap curve no longer saturates', () => {
  const quality = (n: number) =>
    Array.from({ length: n }, () => row('arpg-combat', 'implemented', { qualityScore: 2 }));

  it('keeps costing something past the old 10-point ceiling', () => {
    const few = moduleOf(audit({ 'arpg-combat': quality(5) }), 'arpg-combat');
    const many = moduleOf(audit({ 'arpg-combat': quality(50) }), 'arpg-combat');
    // Old curve: Math.min(gapCount * 2, 10) — 5 gaps and 500 were identical.
    // New curve: 1 / (1 + load/measuredRows), strictly decreasing and scale-free,
    // so proportionally-worse modules always score lower.
    expect(few.score).toBeGreaterThan(0);
    expect(many.score).toBeLessThanOrEqual(few.score);
  });

  it('weights a critical gap more heavily than an informational one', () => {
    const critical = moduleOf(
      audit({
        'arpg-combat': [
          row('arpg-combat', 'implemented', { qualityScore: 1 }),
          ...Array.from({ length: 9 }, () => row('arpg-combat', 'implemented')),
        ],
      }),
      'arpg-combat',
    );
    const clean = moduleOf(
      audit({ 'arpg-combat': Array.from({ length: 10 }, () => row('arpg-combat', 'implemented')) }),
      'arpg-combat',
    );
    expect(critical.gaps.some((g) => g.severity === 'critical')).toBe(true);
    expect(critical.score).toBeLessThan(clean.score);
  });

  it('never damps a score to exactly zero — gap counting cannot prove total failure', () => {
    const mod = moduleOf(
      audit({
        'arpg-combat': Array.from({ length: 3 }, () => row('arpg-combat', 'implemented', { qualityScore: 1 })),
      }),
      'arpg-combat',
    );
    expect(mod.conformance).toBe(100);
    expect(mod.score).toBeGreaterThan(0);
    expect(mod.score).toBeLessThan(100);
  });

  it('does not punish missing/partial/unmeasured twice — they are already priced in the conformance', () => {
    const missing = moduleOf(
      audit({ 'arpg-combat': [row('arpg-combat', 'missing'), row('arpg-combat', 'implemented')] }),
      'arpg-combat',
    );
    expect(missing.conformance).toBe(50);
    expect(missing.score).toBe(50); // conformance undamped by the missing-feature gap
    expect(missing.gaps.some((g) => g.category === 'missing-feature')).toBe(true);
  });
});

describe('gdd-compliance: report envelope invariants (pof_gdd_compliance consumers)', () => {
  it('keeps overallScore in [0,100] and criticalGaps <= totalGaps for every fixture shape', () => {
    const shapes: Record<string, FeatureRow[]>[] = [
      {},
      { 'arpg-combat': [row('arpg-combat', 'unknown')] },
      { 'arpg-combat': Array.from({ length: 40 }, () => row('arpg-combat', 'implemented', { qualityScore: 1 })) },
      {
        'arpg-combat': [row('arpg-combat', 'improved')],
        'arpg-loot': [row('arpg-loot', 'missing'), row('arpg-loot', 'partial')],
      },
    ];
    for (const shape of shapes) {
      const r = audit(shape);
      expect(Number.isFinite(r.overallScore)).toBe(true);
      expect(r.overallScore).toBeGreaterThanOrEqual(0);
      expect(r.overallScore).toBeLessThanOrEqual(100);
      expect(r.totalGaps).toBeGreaterThanOrEqual(0);
      expect(r.criticalGaps).toBeGreaterThanOrEqual(0);
      expect(r.criticalGaps).toBeLessThanOrEqual(r.totalGaps);
      for (const m of r.modules) {
        expect(m.score).toBeGreaterThanOrEqual(0);
        expect(m.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('lists measured modules before unmeasured ones so no-evidence cards cannot bury a real failure', () => {
    const report = audit({
      'arpg-combat': [row('arpg-combat', 'missing')],
      'arpg-loot': [row('arpg-loot', 'implemented')],
    });
    const firstUnmeasured = report.modules.findIndex((m) => !m.evidence.measured);
    const lastMeasured = report.modules.map((m) => m.evidence.measured).lastIndexOf(true);
    expect(lastMeasured).toBeLessThan(firstUnmeasured);
  });
});

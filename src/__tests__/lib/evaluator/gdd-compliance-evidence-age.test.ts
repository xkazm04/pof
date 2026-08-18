import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { ComplianceEvidence } from '@/types/gdd-compliance';
import { evidenceAge, EVIDENCE_STALE_AFTER_DAYS } from '@/types/gdd-compliance';

/**
 * Evidence freshness: the audit timestamp is regenerated on every button press,
 * so it says nothing about the age of the feature verdicts the score was computed
 * from. These pin that the timestamps survive the audit and band honestly.
 */

const fixtures = vi.hoisted(() => ({ rows: {} as Record<string, FeatureRow[]> }));

vi.mock('@/lib/feature-matrix-db', () => ({
  getFeaturesByModule: (moduleId: string) => fixtures.rows[moduleId] ?? [],
}));

import { runComplianceAudit } from '@/lib/gdd-compliance';

const NOW = '2026-08-18T00:00:00.000Z';
const daysAgo = (n: number) => new Date(Date.parse(NOW) - n * 86_400_000).toISOString();

let nextId = 1;
function row(status: FeatureStatus, lastReviewedAt: string | null): FeatureRow {
  return {
    id: nextId++,
    moduleId: 'arpg-combat' as SubModuleId,
    featureName: `feature-${nextId}`,
    category: 'general',
    status,
    description: '',
    filePaths: [],
    reviewNotes: '',
    qualityScore: null,
    nextSteps: '',
    lastReviewedAt,
  };
}

const combat = (rows: FeatureRow[]) => {
  fixtures.rows = { 'arpg-combat': rows };
  const r = runComplianceAudit({});
  const m = r.modules.find((x) => x.moduleId === 'arpg-combat')!;
  return { report: r, module: m };
};

function ev(over: Partial<ComplianceEvidence> = {}): ComplianceEvidence {
  return {
    featuresTotal: 4, featuresMeasured: 4, featuresUnmeasured: 0,
    coverage: 1, confidence: 'high', measured: true,
    oldestEvidenceAt: daysAgo(3), newestEvidenceAt: daysAgo(1), undatedEvidence: 0,
    ...over,
  };
}

beforeEach(() => {
  nextId = 1;
  fixtures.rows = {};
});

describe('evidenceAge banding', () => {
  it('is fresh when every contributing review is inside the threshold', () => {
    const age = evidenceAge(ev(), NOW);
    expect(age.state).toBe('fresh');
    expect(Math.round(age.newestDays!)).toBe(1);
    expect(Math.round(age.oldestDays!)).toBe(3);
  });

  it('is stale when even the newest review is past the threshold', () => {
    const age = evidenceAge(
      ev({ oldestEvidenceAt: daysAgo(200), newestEvidenceAt: daysAgo(EVIDENCE_STALE_AFTER_DAYS + 1) }),
      NOW,
    );
    expect(age.state).toBe('stale');
  });

  it('is aging when some evidence is past the threshold but some is current', () => {
    const age = evidenceAge(ev({ oldestEvidenceAt: daysAgo(180), newestEvidenceAt: daysAgo(2) }), NOW);
    expect(age.state).toBe('aging');
  });

  it('is aging — never fresh — while any contributing row has no review date', () => {
    const age = evidenceAge(ev({ undatedEvidence: 1 }), NOW);
    expect(age.state).toBe('aging');
    expect(age.undated).toBe(1);
  });

  it('is unknown, not fresh, when nothing carries a review date at all', () => {
    const age = evidenceAge(
      ev({ oldestEvidenceAt: null, newestEvidenceAt: null, undatedEvidence: 4 }),
      NOW,
    );
    expect(age.state).toBe('unknown');
    expect(age.newestDays).toBeNull();
  });

  it('is unknown for an unmeasured scope — there is no evidence to age', () => {
    expect(
      evidenceAge(
        ev({ featuresMeasured: 0, measured: false, confidence: 'none', coverage: 0, oldestEvidenceAt: null, newestEvidenceAt: null }),
        NOW,
      ).state,
    ).toBe('unknown');
  });
});

describe('runComplianceAudit carries the evidence timestamps', () => {
  it('reports the oldest and newest review across the measured rows', () => {
    const { module } = combat([
      row('implemented', daysAgo(120)),
      row('implemented', daysAgo(5)),
      row('missing', daysAgo(40)),
    ]);
    expect(module.evidence.oldestEvidenceAt).toBe(daysAgo(120));
    expect(module.evidence.newestEvidenceAt).toBe(daysAgo(5));
    expect(module.evidence.undatedEvidence).toBe(0);
    expect(evidenceAge(module.evidence, NOW).state).toBe('aging');
  });

  it('counts measured rows with no review date instead of dropping them', () => {
    const { module } = combat([row('implemented', daysAgo(2)), row('implemented', null)]);
    expect(module.evidence.undatedEvidence).toBe(1);
    expect(evidenceAge(module.evidence, NOW).state).toBe('aging');
  });

  it('ignores timestamps on rows that carry no verdict — they are not evidence', () => {
    const { module } = combat([row('implemented', daysAgo(2)), row('unknown', daysAgo(900))]);
    expect(module.evidence.oldestEvidenceAt).toBe(daysAgo(2));
    expect(evidenceAge(module.evidence, NOW).state).toBe('fresh');
  });

  it('rolls the age envelope up to the project scope', () => {
    const { report } = combat([row('implemented', daysAgo(300)), row('implemented', daysAgo(1))]);
    expect(report.evidence.oldestEvidenceAt).toBe(daysAgo(300));
    expect(report.evidence.newestEvidenceAt).toBe(daysAgo(1));
    // The audit itself is brand new; the evidence under it is not.
    expect(Date.parse(report.generatedAt)).toBeGreaterThan(Date.parse(daysAgo(1)));
    expect(evidenceAge(report.evidence, report.generatedAt).state).toBe('aging');
  });
});

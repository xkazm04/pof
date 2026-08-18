import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useGDDComplianceStore } from '@/stores/gddComplianceStore';
import type {
  ComplianceEvidence, ComplianceReport, ModuleCompliance,
} from '@/types/gdd-compliance';
import { NO_CHECKLIST_MAPPING } from '@/types/gdd-compliance';
import { GDDComplianceView } from '@/components/modules/evaluator/GDDComplianceView';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const AUDITED_AT = '2026-08-18T00:00:00.000Z';
const daysBefore = (n: number) => new Date(Date.parse(AUDITED_AT) - n * 86_400_000).toISOString();

function evidence(over: Partial<ComplianceEvidence> = {}): ComplianceEvidence {
  return {
    featuresTotal: 8, featuresMeasured: 8, featuresUnmeasured: 0,
    coverage: 1, confidence: 'high', measured: true,
    oldestEvidenceAt: daysBefore(3), newestEvidenceAt: daysBefore(1), undatedEvidence: 0,
    ...over,
  };
}

function mount(ev: ComplianceEvidence) {
  const mod: ModuleCompliance = {
    moduleId: 'arpg-combat', moduleName: 'Combat', score: 80, conformance: 80,
    evidence: ev, totalFeatures: ev.featuresTotal, implemented: 8, improved: 0,
    partial: 0, missing: 0, unknown: ev.featuresUnmeasured,
    checklistTotal: 8, checklistDone: 5, gaps: [],
    checklistMapping: { ...NO_CHECKLIST_MAPPING, itemsTotal: 8, mapped: 8 }, unmappedItems: [],
  };
  const report: ComplianceReport = {
    generatedAt: AUDITED_AT, overallScore: 80, evidence: ev,
    modulesTotal: 1, modulesMeasured: ev.measured ? 1 : 0,
    modules: [mod], totalGaps: 0, criticalGaps: 0, suggestions: [],
    checklistMapping: { ...NO_CHECKLIST_MAPPING, itemsTotal: 8, mapped: 8 },
  };
  useGDDComplianceStore.setState({
    report, modules: [mod], suggestions: [],
    selectedModuleId: null, isAuditing: false, error: null,
  });
  render(<GDDComplianceView />);
}

describe('GDDComplianceView evidence freshness', () => {
  it('separates when the audit RAN from how old the evidence it ran over is', () => {
    mount(evidence({ oldestEvidenceAt: daysBefore(200), newestEvidenceAt: daysBefore(180) }));
    // The audit is stamped "now" — that was the only signal on screen before.
    expect(screen.getByText(/Audit ran:/i)).toBeTruthy();
    // …and the evidence under it is half a year old, which now says so.
    expect(screen.getAllByText(/Stale evidence/i).length).toBeGreaterThan(0);
  });

  it('names the staleness threshold it is judging against', () => {
    mount(evidence({ oldestEvidenceAt: daysBefore(200), newestEvidenceAt: daysBefore(180) }));
    expect(screen.getAllByText(/stale after 30 days/i).length).toBeGreaterThan(0);
  });

  it('reads "evidence age unknown" — never fresh — when no row carries a review date', () => {
    mount(evidence({ oldestEvidenceAt: null, newestEvidenceAt: null, undatedEvidence: 8 }));
    expect(screen.getAllByText(/Evidence age unknown/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Fresh evidence/i)).toBeNull();
  });

  it('reads fresh only when every contributing review is inside the threshold', () => {
    mount(evidence());
    expect(screen.getAllByText(/Fresh evidence/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Stale evidence/i)).toBeNull();
  });

  it('degrades to aging while part of the evidence is undated', () => {
    mount(evidence({ undatedEvidence: 2 }));
    expect(screen.getAllByText(/Aging evidence/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Fresh evidence/i)).toBeNull();
  });
});

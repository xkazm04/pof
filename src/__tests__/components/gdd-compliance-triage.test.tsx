import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGDDComplianceStore } from '@/stores/gddComplianceStore';
import type { ComplianceGap, ComplianceReport, ModuleCompliance } from '@/types/gdd-compliance';
import { NO_CHECKLIST_MAPPING } from '@/types/gdd-compliance';
import { GDDComplianceView } from '@/components/modules/evaluator/GDDComplianceView';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const evidence = {
  featuresTotal: 4, featuresMeasured: 4, featuresUnmeasured: 0,
  coverage: 1, confidence: 'high' as const, measured: true,
  oldestEvidenceAt: '2026-08-16T00:00:00.000Z', newestEvidenceAt: '2026-08-17T00:00:00.000Z',
  undatedEvidence: 0,
};

function gap(id: string, title: string, resolved: boolean): ComplianceGap {
  return {
    id, moduleId: 'arpg-combat', moduleName: 'Combat', category: 'missing-feature',
    title, description: '', direction: 'design-ahead', severity: 'major', effort: 'medium',
    designState: 'Designed', codeState: 'Not implemented', suggestion: 'Build it', resolved,
  };
}

function mount(gaps: ComplianceGap[], over: Partial<{ refreshFailed: boolean; error: string }> = {}) {
  const mod: ModuleCompliance = {
    moduleId: 'arpg-combat', moduleName: 'Combat', score: 60, conformance: 60, evidence,
    totalFeatures: 4, implemented: 2, improved: 0, partial: 0, missing: 2, unknown: 0,
    checklistTotal: 4, checklistDone: 2, gaps,
    checklistMapping: { ...NO_CHECKLIST_MAPPING, itemsTotal: 4, mapped: 4 }, unmappedItems: [],
  };
  const report: ComplianceReport = {
    generatedAt: '2026-08-18T00:00:00.000Z', overallScore: 60, evidence,
    modulesTotal: 1, modulesMeasured: 1, modules: [mod],
    totalGaps: gaps.filter((g) => !g.resolved).length, criticalGaps: 0, suggestions: [],
    checklistMapping: { ...NO_CHECKLIST_MAPPING, itemsTotal: 4, mapped: 4 },
  };
  useGDDComplianceStore.setState({
    report, modules: [mod], suggestions: [], selectedModuleId: 'arpg-combat',
    isAuditing: false, error: over.error ?? null, refreshFailed: over.refreshFailed ?? false,
  });
  render(<GDDComplianceView />);
}

beforeEach(() => {
  useGDDComplianceStore.setState({
    resolveGap: vi.fn(async () => {}),
    unresolveGap: vi.fn(async () => {}),
  });
});

describe('GDDComplianceView gap triage', () => {
  it('lists resolved gaps instead of only counting them', () => {
    mount([gap('g1', 'Dodge missing', false), gap('g2', 'Parry missing', true)]);
    expect(screen.getByText(/Resolved \(1\)/i)).toBeTruthy();
    expect(screen.getByText('Parry missing')).toBeTruthy();
  });

  it('lets a resolved gap be re-opened', () => {
    mount([gap('g2', 'Parry missing', true)]);
    const unresolve = useGDDComplianceStore.getState().unresolveGap;
    fireEvent.click(screen.getByRole('button', { name: /Re-open/i }));
    expect(unresolve).toHaveBeenCalledWith('g2');
  });

  it('shows no resolved section when nothing has been triaged', () => {
    mount([gap('g1', 'Dodge missing', false)]);
    expect(screen.queryByText(/Resolved \(/i)).toBeNull();
  });
});

describe('GDDComplianceView failed re-audit', () => {
  it('says the numbers are stale instead of leaving the failure invisible', () => {
    mount([gap('g1', 'Dodge missing', false)], { refreshFailed: true, error: 'audit exploded' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/Re-audit failed/i);
    expect(alert.textContent).toMatch(/audit exploded/i);
    // The stale report itself stays on screen — it is the last thing we knew.
    expect(screen.getByText('Dodge missing')).toBeTruthy();
  });

  it('shows no banner while the report is current', () => {
    mount([gap('g1', 'Dodge missing', false)]);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

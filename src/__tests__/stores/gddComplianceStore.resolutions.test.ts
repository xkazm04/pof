import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComplianceGap, ComplianceReport, ModuleCompliance } from '@/types/gdd-compliance';
import { NO_CHECKLIST_MAPPING } from '@/types/gdd-compliance';

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
const loggerError = vi.fn();
vi.mock('@/lib/logger', () => ({ logger: { error: (m: string) => loggerError(m), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { useGDDComplianceStore } from '@/stores/gddComplianceStore';

function gap(id: string, resolved = false): ComplianceGap {
  return {
    id, moduleId: 'arpg-combat', moduleName: 'Combat', category: 'missing-feature',
    title: id, description: '', direction: 'design-ahead', severity: 'critical',
    effort: 'medium', designState: '', codeState: '', suggestion: '', resolved,
  };
}

function report(gaps: ComplianceGap[]): ComplianceReport {
  const evidence = {
    featuresTotal: 2, featuresMeasured: 2, featuresUnmeasured: 0,
    coverage: 1, confidence: 'high' as const, measured: true,
    oldestEvidenceAt: null, newestEvidenceAt: null, undatedEvidence: 2,
  };
  const mod: ModuleCompliance = {
    moduleId: 'arpg-combat', moduleName: 'Combat', score: 50, conformance: 50, evidence,
    totalFeatures: 2, implemented: 1, improved: 0, partial: 0, missing: 1, unknown: 0,
    checklistTotal: 2, checklistDone: 1, gaps,
    checklistMapping: { ...NO_CHECKLIST_MAPPING, itemsTotal: 2, mapped: 2 }, unmappedItems: [],
  };
  return {
    generatedAt: '2026-08-18T00:00:00.000Z', overallScore: 50, evidence,
    modulesTotal: 1, modulesMeasured: 1, modules: [mod],
    totalGaps: gaps.filter((g) => !g.resolved).length,
    criticalGaps: gaps.filter((g) => !g.resolved).length,
    checklistMapping: { ...NO_CHECKLIST_MAPPING, itemsTotal: 2, mapped: 2 },
    suggestions: [],
  };
}

const bodyOf = (call: unknown[]) =>
  JSON.parse((call[1] as { body: string }).body) as Record<string, unknown>;

const heldGap = (id: string) =>
  useGDDComplianceStore.getState().report!.modules.flatMap((m) => m.gaps).find((g) => g.id === id)!;

beforeEach(() => {
  apiFetch.mockReset();
  loggerError.mockReset();
  useGDDComplianceStore.setState({
    report: null, modules: [], suggestions: [], isAuditing: false, error: null,
    reportProjectPath: null, reportChecklistHash: null, resolvedGapIds: {},
    refreshFailed: false, selectedModuleId: null,
  });
});

describe('gddComplianceStore gap triage persists', () => {
  it('POSTs the durable resolve and flips the gap optimistically', async () => {
    useGDDComplianceStore.setState({
      report: report([gap('g1')]), modules: report([gap('g1')]).modules,
      reportProjectPath: '/proj-A',
    });
    apiFetch.mockResolvedValue({ gapId: 'g1' });

    await useGDDComplianceStore.getState().resolveGap('g1', 'handled in the backlog');

    const sent = bodyOf(apiFetch.mock.calls[0]);
    expect(sent.action).toBe('resolve-gap');
    expect(sent.gapId).toBe('g1');
    expect(sent.projectPath).toBe('/proj-A');
    expect(sent.note).toBe('handled in the backlog');
    expect(heldGap('g1').resolved).toBe(true);
    expect(useGDDComplianceStore.getState().resolvedGapIds.g1).toBe(true);
    expect(useGDDComplianceStore.getState().report!.totalGaps).toBe(0);
  });

  it('un-resolves through the same path and re-opens the gap', async () => {
    useGDDComplianceStore.setState({
      report: report([gap('g1', true)]), modules: report([gap('g1', true)]).modules,
      resolvedGapIds: { g1: true }, reportProjectPath: '/proj-A',
    });
    apiFetch.mockResolvedValue({ gapId: 'g1', removed: true });

    await useGDDComplianceStore.getState().unresolveGap('g1');

    expect(bodyOf(apiFetch.mock.calls[0]).action).toBe('unresolve-gap');
    expect(heldGap('g1').resolved).toBe(false);
    expect(useGDDComplianceStore.getState().resolvedGapIds.g1).toBeUndefined();
  });

  it('rolls back and reports when the durable write fails', async () => {
    useGDDComplianceStore.setState({
      report: report([gap('g1')]), modules: report([gap('g1')]).modules,
    });
    apiFetch.mockRejectedValue(new Error('disk is full'));

    await useGDDComplianceStore.getState().resolveGap('g1');

    // A triage decision that did not persist must not sit on screen as if it had.
    expect(heldGap('g1').resolved).toBe(false);
    expect(useGDDComplianceStore.getState().resolvedGapIds.g1).toBeUndefined();
    expect(useGDDComplianceStore.getState().error).toBe('disk is full');
    expect(loggerError).toHaveBeenCalled();
  });

  it('rehydrates resolutions from a fresh audit — the reload path', async () => {
    // A brand-new store (nothing in memory) audits and the server returns gaps
    // already flagged resolved from SQLite; the local mirror must pick them up so
    // un-resolve and the counters keep working after a reload.
    expect(useGDDComplianceStore.getState().resolvedGapIds).toEqual({});
    apiFetch.mockResolvedValue(report([gap('g1', true), gap('g2')]));

    await useGDDComplianceStore.getState().runAudit({}, '/proj-A');

    expect(useGDDComplianceStore.getState().resolvedGapIds).toEqual({ g1: true });
    expect(heldGap('g1').resolved).toBe(true);
    expect(heldGap('g2').resolved).toBe(false);
    expect(bodyOf(apiFetch.mock.calls[0]).projectPath).toBe('/proj-A');
  });
});

describe('gddComplianceStore failed refresh is visible', () => {
  it('keeps the last good report, flags it stale and logs the reason', async () => {
    const good = report([gap('g1')]);
    useGDDComplianceStore.setState({ report: good, modules: good.modules, reportProjectPath: '/proj-A' });
    apiFetch.mockRejectedValue(new Error('audit exploded'));

    await useGDDComplianceStore.getState().runAudit({}, '/proj-A');

    const state = useGDDComplianceStore.getState();
    expect(state.report).toBe(good);       // the numbers we last actually knew
    expect(state.refreshFailed).toBe(true); // …labelled as not current
    expect(state.error).toBe('audit exploded');
    expect(loggerError).toHaveBeenCalled();
  });

  it('does not flag a stale report when there was never one to begin with', async () => {
    apiFetch.mockRejectedValue(new Error('audit exploded'));
    await useGDDComplianceStore.getState().runAudit({}, '/proj-A');
    expect(useGDDComplianceStore.getState().refreshFailed).toBe(false);
    expect(useGDDComplianceStore.getState().error).toBe('audit exploded');
  });

  it('clears the stale flag once a refresh succeeds', async () => {
    const good = report([gap('g1')]);
    useGDDComplianceStore.setState({ report: good, modules: good.modules, refreshFailed: true, error: 'old' });
    apiFetch.mockResolvedValue(report([gap('g1')]));

    await useGDDComplianceStore.getState().runAudit({}, '/proj-A');

    expect(useGDDComplianceStore.getState().refreshFailed).toBe(false);
    expect(useGDDComplianceStore.getState().error).toBeNull();
  });
});

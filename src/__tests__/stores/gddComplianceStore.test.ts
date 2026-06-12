import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { useGDDComplianceStore } from '@/stores/gddComplianceStore';

const report = () => ({ modules: [], suggestions: [], generatedAt: 't', overallScore: 0 });

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue(report());
  useGDDComplianceStore.setState({
    report: null, modules: [], suggestions: [], isAuditing: false, error: null,
    reportProjectPath: null, reportChecklistHash: null,
  });
});

const cp = (checked: boolean) => ({ 'arpg-combat': { 'ac-1': checked } });

describe('gddComplianceStore.ensureAudit invalidation', () => {
  it('audits once for a project, then no-ops for the same project + checklist', async () => {
    await useGDDComplianceStore.getState().ensureAudit(cp(false), '/proj-A');
    expect(apiFetch).toHaveBeenCalledTimes(1);
    await useGDDComplianceStore.getState().ensureAudit(cp(false), '/proj-A');
    expect(apiFetch).toHaveBeenCalledTimes(1); // unchanged → no re-audit
  });

  it('re-audits when the project changes (no stale report across a switch)', async () => {
    await useGDDComplianceStore.getState().ensureAudit(cp(false), '/proj-A');
    await useGDDComplianceStore.getState().ensureAudit(cp(false), '/proj-B');
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('re-audits when the checklist snapshot changes (late hydration / toggles)', async () => {
    await useGDDComplianceStore.getState().ensureAudit(cp(false), '/proj-A');
    await useGDDComplianceStore.getState().ensureAudit(cp(true), '/proj-A');
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('does not audit before a project is selected', async () => {
    await useGDDComplianceStore.getState().ensureAudit(cp(false), '');
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

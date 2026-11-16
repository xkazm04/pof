import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A project switch during an in-flight audit must still audit the new project, and
 * the old project's late response must not land over it.
 *
 * ensureAudit returned early on `isAuditing` alone, so switching A -> B while A's
 * audit ran never audited B; and runAudit had no latest-wins token (the sibling
 * useGameDesignDoc hook does), so A's report could land after B's.
 */

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { useGDDComplianceStore } from '@/stores/gddComplianceStore';

const report = (tag: string) => ({ modules: [], suggestions: [], generatedAt: tag, overallScore: 0 });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  apiFetch.mockReset();
  useGDDComplianceStore.setState({
    report: null, modules: [], suggestions: [], isAuditing: false, error: null,
    reportProjectPath: null, reportChecklistHash: null, resolvedGapIds: {},
  });
});

const cp = { 'arpg-combat': { 'ac-1': false } };

describe('gddComplianceStore — audit across a project switch', () => {
  it('a switch during an in-flight audit audits the new project, and the old reply never lands', async () => {
    const a = deferred<ReturnType<typeof report>>();
    const b = deferred<ReturnType<typeof report>>();
    apiFetch.mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise);

    const store = useGDDComplianceStore.getState();
    const first = store.ensureAudit(cp, '/proj-A');
    const second = store.ensureAudit(cp, '/proj-B');
    expect(apiFetch).toHaveBeenCalledTimes(2);

    b.resolve(report('B'));
    await second;
    a.resolve(report('A'));
    await first;

    const s = useGDDComplianceStore.getState();
    expect(s.reportProjectPath).toBe('/proj-B');
    expect(s.report?.generatedAt).toBe('B');
    expect(s.isAuditing).toBe(false);
  });

  it('a duplicate ensureAudit for the SAME in-flight project + checklist still no-ops', async () => {
    const a = deferred<ReturnType<typeof report>>();
    apiFetch.mockImplementationOnce(() => a.promise);
    const store = useGDDComplianceStore.getState();
    const first = store.ensureAudit(cp, '/proj-A');
    await store.ensureAudit(cp, '/proj-A');
    expect(apiFetch).toHaveBeenCalledTimes(1);
    a.resolve(report('A'));
    await first;
  });
});

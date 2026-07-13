import { describe, it, expect } from 'vitest';
import { genericFixCopy, withGenericFixCopy } from '@/components/layout-lab/steps/shared/genericFixCopy';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { StepSpec } from '@/lib/catalog/stepSpec';

const res = (status: AcceptanceResult['status'], reason?: string): AcceptanceResult => ({
  label: 'Some gate', status, tier: 'L0', detail: 'detail', reason,
});

describe('genericFixCopy', () => {
  it('pending: explains it has not produced and offers Run Produce', () => {
    const c = genericFixCopy(res('pending'));
    expect(c.why).toContain("hasn't produced");
    expect(c.suggestion).toContain('Run Produce');
    expect(c.fixDirection).toBeUndefined(); // no reason → no seeded direction
  });

  it('fail: composes the checker reason into why + a corrective fixDirection', () => {
    const c = genericFixCopy(res('fail', 'price/power 1.34× out of band'));
    expect(c.why).toContain('failing');
    expect(c.why).toContain('price/power 1.34× out of band'); // reason is surfaced, not invented
    expect(c.fixDirection).toContain('Correct the failing acceptance: price/power 1.34× out of band');
  });

  it('deferred: honest about the later gate and offers NO local fixDirection', () => {
    const c = genericFixCopy(res('deferred', 'runtime PIE check'));
    expect(c.why).toContain('deferred to a later gate');
    expect(c.why).toContain('runtime PIE check');
    expect(c.fixDirection).toBeUndefined();
  });

  it('invents no catalog content — every string is derived from status + reason only', () => {
    const c = genericFixCopy(res('fail')); // no reason
    expect(c.why).toBe("This step's acceptance is failing.");
    expect(c.fixDirection).toBeUndefined();
  });
});

describe('withGenericFixCopy', () => {
  const base = (status: AcceptanceResult['status'], reason?: string) =>
    ({ ...res(status, reason) });
  const spec = (copy?: StepSpec['copy']): StepSpec => ({
    archetype: 'brief', label: 'X', view: { kind: 'prose', field: 'x', emptyText: '' },
    produce: () => ({ data: {} }), accept: () => res('pending'), copy,
  });

  it('attaches nothing on pass (clean banner)', () => {
    const out = withGenericFixCopy(spec(), base('pass'), {});
    expect(out.why).toBeUndefined();
    expect(out.suggestion).toBeUndefined();
  });

  it('uses the generic fallback when the spec has no bespoke copy', () => {
    const out = withGenericFixCopy(spec(), base('fail', 'bad'), {});
    expect(out.why).toContain('failing');
    expect(out.fixDirection).toContain('bad');
  });

  it('prefers the spec bespoke copy when present', () => {
    const out = withGenericFixCopy(
      spec(() => ({ why: 'bespoke why', suggestion: 'bespoke fix', fixDirection: 'do X' })),
      base('fail', 'ignored reason'),
      {},
    );
    expect(out.why).toBe('bespoke why');
    expect(out.suggestion).toBe('bespoke fix');
    expect(out.fixDirection).toBe('do X');
  });
});

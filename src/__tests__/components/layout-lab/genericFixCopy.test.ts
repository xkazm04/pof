import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { fixDirectionFor, genericFixCopy, withGenericFixCopy } from '@/components/layout-lab/steps/shared/genericFixCopy';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { StepSpec } from '@/lib/catalog/stepSpec';

const res = (status: AcceptanceResult['status'], reason?: string): AcceptanceResult => ({
  label: 'Some gate', status, tier: 'L0', detail: 'detail', reason,
});
const aSpec = (over: Partial<StepSpec> = {}): StepSpec => ({
  archetype: 'brief', label: 'Concept Brief', view: { kind: 'prose', field: 'x', emptyText: '' },
  produce: () => ({ data: {} }), accept: () => res('pending'), ...over,
});

describe('genericFixCopy', () => {
  it('pending: explains it has not produced and previews the direction it will dispatch', () => {
    const c = genericFixCopy(res('pending'), aSpec());
    expect(c.why).toContain("hasn't produced");
    expect(c.fixDirection).toBeTruthy();
    // The direction is VISIBLE before dispatch — the suggestion quotes it verbatim.
    expect(c.suggestion).toContain('Produce fix will dispatch');
    expect(c.suggestion).toContain(c.fixDirection!);
  });

  it('fail: composes the checker reason into why AND into the corrective fixDirection', () => {
    const c = genericFixCopy(res('fail', 'price/power 1.34× out of band'), aSpec());
    expect(c.why).toContain('failing');
    expect(c.why).toContain('price/power 1.34× out of band'); // reason surfaced, not invented
    expect(c.fixDirection).toContain('price/power 1.34× out of band');
    expect(c.fixDirection).toContain('Concept Brief'); // names the step
    expect(c.fixDirection).toContain('Some gate');     // names the criterion that failed
  });

  it('fail with NO checker reason: still dispatches a real direction, saying there was none', () => {
    // The regression this direction fixes: `fixDirection` used to be undefined here, so
    // the one-click fix produced with an EMPTY instruction.
    const c = genericFixCopy(res('fail'), aSpec());
    expect(c.why).toBe("This step's acceptance is failing.");
    expect(c.fixDirection).toBeTruthy();
    expect(c.fixDirection).toContain('no further detail');
  });

  it('deferred: honest about the later gate and offers NO local fixDirection', () => {
    const c = genericFixCopy(res('deferred', 'runtime PIE check'), aSpec());
    expect(c.why).toContain('deferred to a later gate');
    expect(c.why).toContain('runtime PIE check');
    expect(c.fixDirection).toBeUndefined();
  });

  it('without a spec it stays a bare status/reason copy (no direction to preview)', () => {
    const c = genericFixCopy(res('fail', 'bad'));
    expect(c.fixDirection).toBeUndefined();
    expect(c.suggestion).toContain('corrective direction');
  });
});

describe('fixDirectionFor', () => {
  it("speaks the archetype's own deliverable language", () => {
    expect(fixDirectionFor(aSpec({ archetype: 'balance' }), res('fail', 'over budget')))
      .toContain('back inside its stated band');
    expect(fixDirectionFor(aSpec({ archetype: 'gallery' }), res('fail')))
      .toContain('Generate a fresh batch');
    expect(fixDirectionFor(aSpec({ archetype: 'manifest' }), res('fail')))
      .toContain('leave nothing null');
  });

  it('invents no target value — only the step, criterion and reason it was given', () => {
    const dir = fixDirectionFor(aSpec({ archetype: 'balance', label: 'Economy Budget' }), res('fail', 'gold/hour 210'));
    expect(dir).toContain('Economy Budget');
    expect(dir).toContain('gold/hour 210');
    expect(dir).toContain('invent no value');
  });
});

describe('withGenericFixCopy', () => {
  it('attaches nothing on pass (clean banner)', () => {
    const out = withGenericFixCopy(aSpec(), res('pass'), {});
    expect(out.why).toBeUndefined();
    expect(out.suggestion).toBeUndefined();
    expect(out.fixDirection).toBeUndefined();
  });

  it('uses the generic fallback when the spec has no bespoke copy', () => {
    const out = withGenericFixCopy(aSpec(), res('fail', 'bad'), {});
    expect(out.why).toContain('failing');
    expect(out.fixDirection).toContain('bad');
  });

  it('prefers the spec bespoke copy when present', () => {
    const out = withGenericFixCopy(
      aSpec({ copy: () => ({ why: 'bespoke why', suggestion: 'bespoke fix', fixDirection: 'do X' }) }),
      res('fail', 'ignored reason'), {},
    );
    expect(out.why).toBe('bespoke why');
    expect(out.suggestion).toBe('bespoke fix');
    expect(out.fixDirection).toBe('do X');
  });

  it('backfills a bespoke copy that omits (or blanks) fixDirection — defaultDirection first', () => {
    const withDefault = withGenericFixCopy(
      aSpec({ defaultDirection: 'house style: terse', copy: () => ({ why: 'w', suggestion: 's', fixDirection: '  ' }) }),
      res('fail', 'bad'), {},
    );
    expect(withDefault.fixDirection).toBe('house style: terse');

    const derived = withGenericFixCopy(
      aSpec({ copy: () => ({ why: 'w', suggestion: 's' }) }),
      res('fail', 'bad'), {},
    );
    expect(derived.fixDirection).toContain('bad');
  });

  it('keeps deferred free of a fix direction (a runtime gate is not locally fixable)', () => {
    const out = withGenericFixCopy(aSpec(), res('deferred', 'needs PIE'), {});
    expect(out.fixDirection).toBeUndefined();
  });
});

describe('fleet-wide guarantee: no step dispatches an empty direction', () => {
  it('covers every registered step in every non-pass, non-deferred status', () => {
    const pipelines = allCatalogPipelines();
    expect(pipelines.length).toBeGreaterThan(0);
    let steps = 0;
    for (const p of pipelines) {
      for (const spec of p.steps) {
        steps++;
        for (const status of ['fail', 'pending'] as const) {
          for (const reason of [undefined, 'the checker said this']) {
            const where = `${p.catalogId}::${spec.label} (${status})`;
            const out = withGenericFixCopy(spec, { ...res(status, reason), label: `${spec.label} gate` }, {});
            expect(out.fixDirection, where).toBeTruthy();
            expect((out.fixDirection ?? '').trim().length, where).toBeGreaterThan(20);
            // Situation-specific: names the step and, when the checker gave one, the reason.
            if (!spec.copy && !spec.defaultDirection) {
              expect(out.fixDirection, where).toContain(spec.label);
              if (reason) expect(out.fixDirection, where).toContain(reason);
            }
          }
        }
      }
    }
    expect(steps).toBeGreaterThan(300);
  });
});

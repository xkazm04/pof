import { describe, it, expect } from 'vitest';
import { describeBindOutcome } from '@/components/layout-lab/MatrixBindIcons';
import type { BindIconsSummary } from '@/lib/catalog/acceptance/bindIconsAll';

/**
 * `describeBindOutcome` words the bind-icons line of MatrixSettle's preview/apply: the route's
 * OWN counts (bound / skipped with reasons / verdict deltas / which scope bound), never a bare
 * "done", and "0 bound" as a first-class line with its top reason.
 */

const summary = (over: Partial<BindIconsSummary> = {}): BindIconsSummary => ({
  library: 3, examined: 2, bound: 1, changed: 1, skipped: 1, results: [], ...over,
});

const row = (over: Partial<BindIconsSummary['results'][number]> = {}) => ({
  catalogId: 'items', entityId: 'item-1', step: 'Icon 2D Art',
  from: 'deferred', to: 'pass', detail: '/api/visual-gen/icon/x.jpg', changed: true, ...over,
});

describe('describeBindOutcome', () => {
  it('reports 0 bound as a first-class line naming the top reason', () => {
    const out = describeBindOutcome(
      summary({ bound: 0, changed: 0, examined: 2, skipped: 2, results: [
        { ...row({ scope: undefined, changed: false, detail: 'no-history' }) },
        { ...row({ scope: undefined, changed: false, detail: 'no-history' }) },
      ] }),
      true,
    );
    expect(out.headline).toBe('0 bound — no-history.');
    expect(out.reasons[0]).toEqual({ reason: 'no-history', count: 2 });
  });

  it('names an EMPTY library rather than an anonymous zero', () => {
    const out = describeBindOutcome(summary({ library: 0, examined: 0, bound: 0, changed: 0, skipped: 0 }), true);
    expect(out.headline).toContain('the icon library is empty');
  });

  it('counts artifacts the library has no art for — they are never rows', () => {
    const out = describeBindOutcome(summary({ bound: 0, changed: 0, examined: 0, skipped: 5, results: [] }), false);
    expect(out.noArt).toBe(5);
    expect(out.headline).toContain('no art matching 5 artifacts');
    expect(out.headline).toContain('would bind');
  });

  it('separates entity art from the per-step icon standing in', () => {
    const out = describeBindOutcome(
      summary({ bound: 3, changed: 2, skipped: 0, results: [
        row({ scope: 'entity' }), row({ scope: 'step' }), row({ scope: 'step', changed: false }),
      ] }),
      true,
    );
    expect(out.scopes).toEqual({ entity: 1, step: 2 });
    expect(out.moved).toEqual([{ label: 'deferred → pass', count: 2 }]);
  });
});

// The MatrixBindIcons COMPONENT was unmounted when MatrixSettle replaced it (1ca344a5): its
// Bind POSTed '{}' — every catalog — from inside one catalog's header, and nothing rendered it
// after that. Only the pure wording (`describeBindOutcome`, read by MatrixSettle) remains, so
// the all-catalog POST cannot be re-mounted by accident.
describe('MatrixBindIcons module', () => {
  it('exports the bind wording only, no component', async () => {
    const mod = await import('@/components/layout-lab/MatrixBindIcons');
    expect(Object.keys(mod).sort()).toEqual(['describeBindOutcome']);
  });
});

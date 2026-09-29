/**
 * One hold-fold for both L2 sweeps. A sweep (verify-static, verify-packaging) is the ONE writer of a
 * stored status and folds the step's own content checker in; the fold's lattice is
 * fail > pending > deferred > pass, because `pending` is blocked on an AUTHOR and `deferred` on an
 * ENVIRONMENT — a content hold (declared gap, SOURCED, TEMPLATE) must never read as a deferral
 * (registry: content-acceptance-tiering · deferred-as-honest-progress). The winner's reason leads,
 * so a SOURCED:/TEMPLATE: marker stays the stored reason's prefix.
 */
import { describe, expect, it } from 'vitest';
import { foldContentHold, holdsBackAtDataTier, worstOf } from '@/lib/catalog/acceptance/combineVerdicts';
import { defaultPackagingVerifyDeps } from '@/lib/catalog/acceptance/packagingVerify';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';

const staticDefer: AcceptanceResult = {
  label: 'Stat Block', tier: 'L2', status: 'deferred', detail: 'UE root unavailable', reason: 'UE root not found — static check skipped',
};
const sourcedPending: AcceptanceResult = {
  label: 'Stat Block', tier: 'L0', status: 'pending', detail: 'seeded', reason: 'SOURCED: seeded from diablo1 monster table, not produced',
};

describe('foldContentHold — a content hold never reads as a deferral', () => {
  it('static deferred@L2 + content SOURCED pending@L0 → pending@L0, the SOURCED: marker leading', () => {
    const r = foldContentHold(staticDefer, sourcedPending);
    expect(r).toMatchObject({ status: 'pending', tier: 'L0' });
    expect(r.reason?.startsWith('SOURCED:')).toBe(true);
    expect(r.reason).toContain('UE root not found');
  });

  it('[guard] static fail + content TEMPLATE pending → fail (fail outranks every hold), naming both halves', () => {
    const r = foldContentHold(
      { label: 'Integration', tier: 'L2', status: 'fail', detail: '0/1', reason: 'Foo not found' },
      { label: 'Integration', tier: 'L0', status: 'pending', detail: 'stub', reason: 'TEMPLATE: exemplar template, not produced for this entity' },
    );
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('Foo not found');
    expect(r.reason).toContain('TEMPLATE:');
  });

  it('[guard] a content verdict that does not hold back at a data tier leaves the sweep verdict untouched', () => {
    expect(foldContentHold(staticDefer, null)).toBe(staticDefer);
    expect(foldContentHold(staticDefer, { label: 'S', tier: 'L2', status: 'pass', detail: 'ok' })).toBe(staticDefer);
    expect(foldContentHold(staticDefer, { label: 'S', tier: 'L3', status: 'deferred', detail: 'awaits drain' })).toBe(staticDefer);
  });

  it('[guard] worstOf over two sweep halves is unchanged (deferred still beats pass)', () => {
    expect(worstOf({ label: 'P', tier: 'L2', status: 'pass', detail: 'ok' }, staticDefer).status).toBe('deferred');
    expect(holdsBackAtDataTier(sourcedPending)).toBe(true);
  });
});

describe('defaultPackagingVerifyDeps — the server sweep folds the content hold by default', () => {
  it('wires a getContentVerdict reader', () => {
    expect(typeof defaultPackagingVerifyDeps().getContentVerdict).toBe('function');
  });
});

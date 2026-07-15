import { describe, it, expect, beforeEach } from 'vitest';
import { acquireLeases, releaseLeases, getLeaseState, scopeFromKey, leaseKeysForFilter, __resetLeases } from '@/lib/test-gate-runner/drain-lease';

describe('drain-lease registry', () => {
  beforeEach(() => __resetLeases());

  it('is idle with no leases held', () => {
    const s = getLeaseState();
    expect(s.held).toBe(false);
    expect(s.scope).toBeNull();
    expect(s.since).toBeNull();
    expect(s.scopes).toEqual([]);
  });

  it('reports a held lease with its scope + since after acquire', () => {
    expect(acquireLeases(['items|item-1']).ok).toBe(true);
    const s = getLeaseState();
    expect(s.held).toBe(true);
    expect(s.scope).toBe('items/item-1');
    expect(typeof s.since).toBe('string');
    expect(s.scopes).toEqual(['items/item-1']);
  });

  it('acquire is all-or-nothing: a conflict acquires none and names the conflict', () => {
    expect(acquireLeases(['items|item-1']).ok).toBe(true);
    const res = acquireLeases(['items|item-2', 'items|item-1']);
    expect(res).toEqual({ ok: false, conflict: 'items|item-1' });
    // item-2 must NOT have been acquired by the failed batch.
    expect(getLeaseState().scopes).toEqual(['items/item-1']);
  });

  it('release frees the lease back to idle', () => {
    acquireLeases(['items|item-1']);
    releaseLeases(['items|item-1']);
    expect(getLeaseState().held).toBe(false);
  });

  it('a batch holds one scope per entity; scope is the OLDEST holder', () => {
    acquireLeases(['items|a', 'items|b']);
    const s = getLeaseState();
    expect(s.held).toBe(true);
    expect(s.scopes.sort()).toEqual(['items/a', 'items/b']);
  });

  it('scopeFromKey maps the global key to "global"', () => {
    expect(scopeFromKey('*|*')).toBe('global');
    expect(scopeFromKey('items|item-1')).toBe('items/item-1');
  });

  it('the global lease is exclusive with EVERYTHING (worker vs a scoped route drain)', () => {
    // A held scoped lease blocks a global acquire (the worker can't sweep while an entity drains).
    acquireLeases(['items|item-1']);
    expect(acquireLeases(['*|*'])).toEqual({ ok: false, conflict: 'items|item-1' });
    releaseLeases(['items|item-1']);
    // A held global lease blocks every scoped acquire (a route drain can't start under the worker).
    expect(acquireLeases(['*|*']).ok).toBe(true);
    expect(acquireLeases(['items|item-1'])).toEqual({ ok: false, conflict: '*|*' });
  });

  it('scoped-vs-scoped is unchanged: disjoint entities may drain concurrently', () => {
    expect(acquireLeases(['items|a']).ok).toBe(true);
    expect(acquireLeases(['items|b']).ok).toBe(true); // different entity → no conflict
    expect(acquireLeases(['items|a'])).toEqual({ ok: false, conflict: 'items|a' });
  });

  it('leaseKeysForFilter mirrors the route: batch → per-entity keys, else single/global', () => {
    expect(leaseKeysForFilter({})).toEqual(['*|*']);
    expect(leaseKeysForFilter({ catalogId: 'items' })).toEqual(['items|*']);
    expect(leaseKeysForFilter({ catalogId: 'items', entityId: 'a' })).toEqual(['items|a']);
    expect(leaseKeysForFilter({ catalogId: 'items', entityIds: ['a', 'b'] })).toEqual(['items|a', 'items|b']);
  });
});

import { describe, it, expect } from 'vitest';
import { runtimeDeferred, visualDeferred } from '@/lib/catalog/acceptance/deferred';

describe('deferred checkers', () => {
  it('runtimeDeferred is L3 deferred with a reason', () => {
    const r = runtimeDeferred('VSGenSampleEffectTest', 'Functional test passes')();
    expect(r).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(r.reason).toContain('VSGenSampleEffectTest');
  });
  it('visualDeferred is L4 deferred', () => {
    expect(visualDeferred('Renders correctly')().tier).toBe('L4');
    expect(visualDeferred('Renders correctly')().status).toBe('deferred');
  });
});

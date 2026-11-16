import { describe, it, expect } from 'vitest';
import { registerCallback, getCallback, callbackRegistrySize, CALLBACK_REGISTRY_MAX } from '@/lib/cli-task';

const reg = () => registerCallback({ url: '/api/x', method: 'POST', staticFields: {}, schemaHint: '' });

describe('client callback registry bound', () => {
  it('stays at or below the cap across 1000 registrations and evicts the oldest first', () => {
    const first = reg();
    const ids = Array.from({ length: 1000 }, reg);
    expect(callbackRegistrySize()).toBeLessThanOrEqual(CALLBACK_REGISTRY_MAX);
    expect(getCallback(first)).toBeUndefined();
    expect(getCallback(ids[ids.length - 1])).toBeDefined();
  });
});

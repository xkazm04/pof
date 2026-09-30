/**
 * Pure half of the manifest feed: the tolerant checksum read the route and the
 * hook share, the cache key, and the sync decision. The stateful feed (one
 * interval, one flight, refcounted by visible holders) is pinned in
 * `src/__tests__/hooks/useManifest.feed.test.tsx`.
 */
import { describe, it, expect } from 'vitest';
import {
  readManifestChecksum,
  manifestKey,
  planManifestSync,
} from '@/lib/pof-bridge/manifest-feed';

describe('readManifestChecksum', () => {
  it('reads the declared plugin key, the legacy key, and nothing else', () => {
    expect(readManifestChecksum({ checksum: 'abc' })).toBe('abc');
    expect(readManifestChecksum({ checksumSha256: 'def' })).toBe('def');
    expect(readManifestChecksum({})).toBeNull();
  });

  it('never invents a checksum from a malformed body', () => {
    expect(readManifestChecksum(null)).toBeNull();
    expect(readManifestChecksum('abc')).toBeNull();
    expect(readManifestChecksum({ checksum: '' })).toBeNull();
    expect(readManifestChecksum({ checksum: 42 })).toBeNull();
  });
});

describe('manifestKey', () => {
  it('keys on every argument that changes the answer: port and editor project', () => {
    expect(manifestKey(30040, 'Did')).toBe('30040::Did');
    expect(manifestKey(30041, 'Did')).not.toBe(manifestKey(30040, 'Did'));
    expect(manifestKey(30040, null)).toBeNull();
    expect(manifestKey(30040, '')).toBeNull();
  });
});

describe('planManifestSync', () => {
  const base = {
    status: 'connected' as const,
    currentKey: '30040::Did',
    cachedKey: '30040::Did',
    hasManifest: true,
    cachedChecksum: 'c1',
  };

  it('does nothing while not connected, whatever is cached', () => {
    expect(planManifestSync({ ...base, status: 'disconnected' })).toBe('idle');
    expect(planManifestSync({ ...base, status: 'reconnecting', cachedKey: '30040::Other' })).toBe('idle');
  });

  it('clears then refetches when the cached entry belongs to another editor', () => {
    expect(planManifestSync({ ...base, cachedKey: '30040::A', currentKey: '30040::B' })).toBe('clear-then-fetch');
  });

  it('fetches in full when nothing is cached', () => {
    expect(planManifestSync({ ...base, hasManifest: false, cachedKey: null, cachedChecksum: null })).toBe('fetch-full');
  });

  it('asks for the checksum before deciding, then refetches only on a real change', () => {
    expect(planManifestSync(base)).toBe('check');
    expect(planManifestSync({ ...base, remoteChecksum: 'c1' })).toBe('keep');
    expect(planManifestSync({ ...base, remoteChecksum: 'c2' })).toBe('fetch-full');
    expect(planManifestSync({ ...base, remoteChecksum: null })).toBe('keep');
  });
});

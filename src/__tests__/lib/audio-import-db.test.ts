import { vi, describe, it, expect } from 'vitest';

// Own throwaway DB (and so its own `<dir>/audio` clip root) rather than the shared floor
// DB: audio persistence now goes through `getDb()`, and one more writer on the shared file
// is one more contender for its WAL. See audio-db-containment.test.ts.
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/audio-import-db-${process.pid}/pof.db`;
});
import { getLatestAudioImport, recordAudioImport } from '@/lib/audio-import-db';

describe('audio-import-db', () => {
  it('records and returns the latest run', () => {
    const r = recordAudioImport({ setName: `t-${Date.now()}`, assetsImported: 3, cuePath: '/Game/Audio/x/SC_x', wiredEvent: null });
    const latest = getLatestAudioImport();
    expect(latest?.id).toBeGreaterThanOrEqual(r.id);
    expect(latest?.assetsImported).toBe(3);
  });
});

describe('audio-import-db - same-millisecond ordering', () => {
  it('getLatestAudioImport resolves a createdAt tie to the later insert, like the per-set readers', () => {
    const frozen = Date.now() + 10_000_000; // later than every other row this file wrote
    const spy = vi.spyOn(Date, 'now').mockReturnValue(frozen);
    try {
      recordAudioImport({ setName: 'tie-set', assetsImported: 1 });
      const second = recordAudioImport({ setName: 'tie-set', assetsImported: 2 });
      expect(getLatestAudioImport()?.id).toBe(second.id);
    } finally {
      spy.mockRestore();
    }
  });
});

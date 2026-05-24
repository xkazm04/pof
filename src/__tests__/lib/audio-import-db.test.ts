import { describe, it, expect } from 'vitest';
import { getLatestAudioImport, recordAudioImport } from '@/lib/audio-import-db';

describe('audio-import-db', () => {
  it('records and returns the latest run', () => {
    const r = recordAudioImport({ setName: `t-${Date.now()}`, assetsImported: 3, cuePath: '/Game/Audio/x/SC_x', wiredEvent: null });
    const latest = getLatestAudioImport();
    expect(latest?.id).toBeGreaterThanOrEqual(r.id);
    expect(latest?.assetsImported).toBe(3);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { recordObservation } from '@/lib/observation/record';
import { makeObservation } from '@/lib/observation/types';

describe('recordObservation', () => {
  it('persists via the injected writer and stamps artifactRef', async () => {
    const writer = vi.fn().mockResolvedValue('artifact-123');
    const obs = makeObservation('pose', { isRefPose: true }, { capturedAt: 't' });
    const ref = await recordObservation(
      { catalogId: 'player-movement', entityId: 'v1', step: 'playable-gate' },
      obs,
      writer,
    );
    expect(writer).toHaveBeenCalledOnce();
    expect(ref).toBe('artifact-123');
    expect(obs.artifactRef).toBe('artifact-123');
  });
});

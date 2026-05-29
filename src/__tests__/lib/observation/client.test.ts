import { describe, it, expect, vi } from 'vitest';
import { observe } from '@/lib/observation/client';

describe('observe', () => {
  it('dispatches the verb module via runPython and returns the Observation', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: { kind: 'state', data: { sample_count: 11 }, capturedAt: 't' },
      }),
    });
    const obs = await observe('get_state', { asset_path: '/Game/X' }, { fetchImpl: fetchSpy as never });
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as { body: string }).body);
    expect(body.module).toBe('observation.get_state');
    expect(body.function).toBe('run');
    expect(obs.kind).toBe('state');
  });

  it('returns a metric error observation when the bridge call fails', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const obs = await observe('evaluate_pose', { mode: 'clip' }, { fetchImpl: fetchSpy as never });
    expect(obs.kind).toBe('metric');
    expect((obs.data as { error: string }).error).toMatch(/ECONNREFUSED|unreachable/);
  });
});

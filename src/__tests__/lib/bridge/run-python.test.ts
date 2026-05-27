import { describe, it, expect, vi, afterEach } from 'vitest';
import { runPython } from '@/lib/bridge/run-python';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runPython', () => {
  it('posts {module, function, args} to /pof/python/run and unwraps ok:true', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { built: 3 }, logs: ['hello'] }),
    });
    const result = await runPython(
      'player_movement.import_clips',
      'run',
      { raw_dir: '/tmp/mixamo' },
      { fetchImpl: fetchSpy as never },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:30040/pof/python/run',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as { body: string }).body);
    expect(body).toEqual({
      module: 'player_movement.import_clips',
      function: 'run',
      args: { raw_dir: '/tmp/mixamo' },
    });
    expect(result).toEqual({ ok: true, data: { built: 3 }, logs: ['hello'] });
  });

  it('passes ok:false through with error and logs', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: 'boom', logs: ['err line'] }),
    });
    const result = await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never });
    expect(result).toEqual({ ok: false, error: 'boom', logs: ['err line'] });
  });

  it('converts network errors to a structured RunPythonErr', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
    const result = await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/Bridge unreachable.*ECONNREFUSED/);
  });

  it('sends X-Pof-Auth-Token when authToken is provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: null }),
    });
    await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never, authToken: 'secret' });
    const headers = (fetchSpy.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(headers['X-Pof-Auth-Token']).toBe('secret');
  });

  it('honors bridgeUrl override', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: null }),
    });
    await runPython('m', 'fn', {}, {
      fetchImpl: fetchSpy as never,
      bridgeUrl: 'http://otherhost:9999/pof/python/run',
    });
    expect(fetchSpy.mock.calls[0][0]).toBe('http://otherhost:9999/pof/python/run');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  runPython,
  RUN_PYTHON_DEFAULT_TIMEOUT_MS,
  type RunPythonResult,
} from '@/lib/bridge/run-python';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A bridge that accepts the connection and never answers — the wedged-editor case. */
function neverAnswers() {
  return vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted')));
  }));
}

/** A response whose body is the JSON serialization of `payload`. */
function jsonResponse(payload: unknown, status = 200) {
  return { ok: status < 400, status, text: async () => JSON.stringify(payload) };
}

function asErr(result: RunPythonResult) {
  expect(result.ok).toBe(false);
  return result as Extract<RunPythonResult, { ok: false }>;
}

describe('runPython', () => {
  it('posts {module, function, args} to /pof/python/run and unwraps ok:true', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ok: true, data: { built: 3 }, logs: ['hello'] }));
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
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ok: false, error: 'boom', logs: ['err line'] }, 500));
    const result = await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never });
    expect(result).toEqual({ ok: false, error: 'boom', logs: ['err line'] });
    // No `kind`: the bridge answered and Python raised — not a transport failure.
    expect(asErr(result).kind).toBeUndefined();
  });

  it('converts network errors to a structured RunPythonErr', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
    const result = await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never });
    expect(asErr(result).error).toMatch(/Bridge unreachable.*ECONNREFUSED/);
    expect(asErr(result).kind).toBe('unreachable');
  });

  it('sends X-Pof-Auth-Token when authToken is provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: null }));
    await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never, authToken: 'secret' });
    const headers = (fetchSpy.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(headers['X-Pof-Auth-Token']).toBe('secret');
  });

  it('honors bridgeUrl override', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: null }));
    await runPython('m', 'fn', {}, {
      fetchImpl: fetchSpy as never,
      bridgeUrl: 'http://otherhost:9999/pof/python/run',
    });
    expect(fetchSpy.mock.calls[0][0]).toBe('http://otherhost:9999/pof/python/run');
  });

  // ── reachable-but-broken ───────────────────────────────────────────────────

  it('does NOT report a 200 with an unparseable body as unreachable', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'Internal Server Error (plain text, not JSON)',
    });

    const err = asErr(await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never }));

    expect(err.kind).toBe('malformed-body');
    expect(err.error).not.toMatch(/unreachable/i);
    expect(err.error).toMatch(/HTTP 200/);
    expect(err.error).toMatch(/plain text, not JSON/);
  });

  it('reports valid JSON that is not the bridge envelope as malformed, not as a result', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ result: 3 }));

    const err = asErr(await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never }));

    expect(err.kind).toBe('malformed-body');
    // The old cast produced `error: undefined` in the UI — the message must be real.
    expect(typeof err.error).toBe('string');
    expect(err.error).toMatch(/envelope/);
  });

  it('bounds the echoed body snippet', async () => {
    const huge = 'z'.repeat(5000);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => huge });

    const err = asErr(await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never }));

    expect(err.error).not.toContain('z'.repeat(201));
    expect(err.error.length).toBeLessThan(700);
  });

  it('reports a body that could not be read as a broken reply, not an unreachable bridge', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => {
        throw new Error('socket hang up');
      },
    });

    const err = asErr(await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never }));

    expect(err.kind).toBe('malformed-body');
    expect(err.error).toMatch(/socket hang up/);
    expect(err.error).not.toMatch(/unreachable/i);
  });

  // ── bounded waits ──────────────────────────────────────────────────────────

  it('rejects a never-answering bridge within the bound instead of hanging', async () => {
    const fetchSpy = neverAnswers();

    const err = asErr(
      await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never, timeoutMs: 20 }),
    );

    expect(err.kind).toBe('timeout');
    expect(err.error).toMatch(/timed out after 20ms/);
    // A timeout is never dressed up as a dead editor or a broken payload.
    expect(err.error).not.toMatch(/unreachable/i);
  });

  it('applies the default bound when the caller supplies neither signal nor timeoutMs', async () => {
    vi.useFakeTimers();
    const fetchSpy = neverAnswers();

    const pending = runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never });
    // The signal handed to fetch is ours, not undefined: the call IS bounded.
    expect((fetchSpy.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);

    await vi.advanceTimersByTimeAsync(RUN_PYTHON_DEFAULT_TIMEOUT_MS);

    const err = asErr(await pending);
    expect(err.kind).toBe('timeout');
    expect(err.error).toContain(String(RUN_PYTHON_DEFAULT_TIMEOUT_MS));
  });

  it('lets a caller-supplied signal win — no default bound is imposed on top of it', async () => {
    vi.useFakeTimers();
    const fetchSpy = neverAnswers();
    const controller = new AbortController();

    const pending = runPython('m', 'fn', {}, {
      fetchImpl: fetchSpy as never,
      signal: controller.signal,
    });
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(RUN_PYTHON_DEFAULT_TIMEOUT_MS * 2);
    expect(settled).toBe(false);

    controller.abort();
    const err = asErr(await pending);
    // The caller's own cancel is reported as such, not as an unreachable bridge.
    expect(err.kind).toBe('aborted');
    expect(err.error).not.toMatch(/unreachable/i);
  });

  it('composes a caller signal with an explicit timeoutMs — either one ends the call', async () => {
    vi.useFakeTimers();
    const fetchSpy = neverAnswers();
    const controller = new AbortController();

    const byTimeout = runPython('m', 'fn', {}, {
      fetchImpl: fetchSpy as never,
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(asErr(await byTimeout).kind).toBe('timeout');

    const byCaller = runPython('m', 'fn', {}, {
      fetchImpl: fetchSpy as never,
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    controller.abort();
    expect(asErr(await byCaller).kind).toBe('aborted');
  });

  it('treats timeoutMs: 0 as an explicit unbounded wait', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: null }));

    await runPython('m', 'fn', {}, { fetchImpl: fetchSpy as never, timeoutMs: 0 });

    expect((fetchSpy.mock.calls[0][1] as RequestInit).signal).toBeUndefined();
  });
});

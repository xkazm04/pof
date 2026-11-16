/**
 * `/api/packaging/preflight` — request validation.
 *
 * The route dispatches on `check`. Any value it did not recognise used to fall
 * through to the final `else` branch and spawn UnrealBuildTool for a 10-minute
 * editor compile, so a typo'd check (`'asset-validaton'`) silently started a
 * real UBT build. Unknown checks must be rejected before anything is spawned.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const spawnCapture = vi.fn();
const runFastPreflight = vi.fn();

vi.mock('@/lib/packaging/process-utils', () => ({
  spawnCapture: (...args: unknown[]) => spawnCapture(...args),
}));
vi.mock('@/lib/packaging/preflight-runner', () => ({
  runFastPreflight: (...args: unknown[]) => runFastPreflight(...args),
}));
vi.mock('@/lib/prompt-context', () => ({
  getEnginePath: () => 'C:/UE_5.8',
}));

import { POST } from '@/app/api/packaging/preflight/route';

const BASE = { projectPath: 'C:/Proj', projectName: 'PoF', ueVersion: '5.8' };

function post(body: unknown) {
  return POST(new Request('http://localhost/api/packaging/preflight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  spawnCapture.mockReset();
  spawnCapture.mockResolvedValue({ output: 'Result: Succeeded', spawnError: null });
  runFastPreflight.mockReset();
  runFastPreflight.mockResolvedValue({ results: [] });
});

describe('preflight route — check validation', () => {
  it.each(['bogus', 'asset-validaton', 'BUILD-VERIFY-EDITOR', 42])(
    'rejects unknown check %p with 400 and spawns nothing',
    async (check) => {
      const res = await post({ ...BASE, check });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(spawnCapture).not.toHaveBeenCalled();
    },
  );

  it('still runs the fast check when check is omitted', async () => {
    const res = await post(BASE);
    expect(res.status).toBe(200);
    expect(runFastPreflight).toHaveBeenCalledTimes(1);
    expect(spawnCapture).not.toHaveBeenCalled();
  });

  it.each(['build-verify-editor', 'build-verify-shipping', 'asset-validation'])(
    'accepts the known spawning check %s',
    async (check) => {
      const res = await post({ ...BASE, check });
      expect(res.status).toBe(200);
      expect(spawnCapture).toHaveBeenCalledTimes(1);
    },
  );
});

describe('preflight route - projectName is a UE project identifier', () => {
  it.each(['..\\x', '-Mode=Foo', 'a/b', '', 'My Game'])(
    'rejects crafted projectName %p with 400 and spawns nothing',
    async (projectName) => {
      const res = await post({ ...BASE, projectName, check: 'build-verify-editor' });
      expect(res.status).toBe(400);
      expect(spawnCapture).not.toHaveBeenCalled();
      expect(runFastPreflight).not.toHaveBeenCalled();
    },
  );

  it.each(['PoF', 'Jinx_5', 'MyGame2', '_Scratch'])(
    'accepts real project name %s',
    async (projectName) => {
      const res = await post({ ...BASE, projectName, check: 'build-verify-editor' });
      expect(res.status).toBe(200);
      expect(spawnCapture).toHaveBeenCalledTimes(1);
    },
  );
});

describe('preflight route - timeouts are named', () => {
  it.each(['build-verify-editor', 'build-verify-shipping', 'asset-validation'])(
    'reports a timed-out %s as a timeout, not a generic failure',
    async (check) => {
      spawnCapture.mockResolvedValue({ output: 'Result: Succeeded', spawnError: null, timedOut: true });
      const res = await post({ ...BASE, check });
      const json = await res.json();
      const r = json.data.results[0];
      expect(r.status).toBe('fail');
      expect(r.detail).toContain('timed out after');
    },
  );
});

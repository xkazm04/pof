import { describe, it, expect, vi } from 'vitest';
import {
  parseTasklistOutput,
  deriveGameImage,
  runSmokeTest,
  type SmokeTestOptions,
} from '@/lib/packaging/smoke-test';

describe('parseTasklistOutput', () => {
  const tasklistHit = [
    'Image Name                     PID Session Name        Session#    Mem Usage',
    '========================= ======== ================ =========== ============',
    'PoF-Win64-Shipping.exe        12345 Console                    1    512,300 K',
  ].join('\r\n');

  it('detects the image when present (case-insensitive)', () => {
    expect(parseTasklistOutput(tasklistHit, 'PoF-Win64-Shipping.exe')).toBe(true);
    expect(parseTasklistOutput(tasklistHit, 'pof-win64-shipping.exe')).toBe(true);
  });

  it('returns false when the image is absent', () => {
    expect(parseTasklistOutput('INFO: No tasks are running which match the specified criteria.', 'PoF-Win64-Shipping.exe')).toBe(false);
    expect(parseTasklistOutput('', 'PoF.exe')).toBe(false);
  });
});

describe('deriveGameImage', () => {
  it('decorates non-Development configs with platform + config', () => {
    expect(deriveGameImage('PoF', 'Win64', 'Shipping')).toBe('PoF-Win64-Shipping.exe');
    expect(deriveGameImage('PoF', 'Win64', 'Test')).toBe('PoF-Win64-Test.exe');
    expect(deriveGameImage('PoF', 'Win64', 'DebugGame')).toBe('PoF-Win64-DebugGame.exe');
  });

  it('uses the bare project name for Development (no decoration)', () => {
    expect(deriveGameImage('PoF', 'Win64', 'Development')).toBe('PoF.exe');
  });
});

// ── runSmokeTest orchestration (fully mocked — no real process spawned) ──────

function baseOptions(overrides: Partial<SmokeTestOptions> = {}): SmokeTestOptions {
  const fakeChild = { pid: 4242, on: vi.fn() } as unknown as ReturnType<NonNullable<SmokeTestOptions['spawnFn']>>;
  return {
    bootstrapExe: 'C:\\Stage\\PoF.exe',
    gameImage: 'PoF-Win64-Shipping.exe',
    observeMs: 25_000,
    spawnFn: vi.fn(() => fakeChild),
    tasklistFn: vi.fn(() => true),
    killImageFn: vi.fn(),
    killPidFn: vi.fn(),
    sleep: vi.fn(async () => {}),
    now: (() => { let t = 0; return () => (t += 1000); })(),
    ...overrides,
  };
}

describe('runSmokeTest', () => {
  it('passes when the game process is alive after the observe window', async () => {
    const opts = baseOptions();
    const result = await runSmokeTest(opts);
    expect(result.status).toBe('pass');
    expect(result.gameAlive).toBe(true);
    expect(opts.spawnFn).toHaveBeenCalledWith('C:\\Stage\\PoF.exe', expect.any(Array), expect.any(Object));
    expect(opts.sleep).toHaveBeenCalledWith(25_000);
  });

  it('fails when the game process is not alive', async () => {
    const opts = baseOptions({ tasklistFn: vi.fn(() => false) });
    const result = await runSmokeTest(opts);
    expect(result.status).toBe('fail');
    expect(result.gameAlive).toBe(false);
  });

  it('always cleans up the game image and the bootstrap pid', async () => {
    const opts = baseOptions();
    await runSmokeTest(opts);
    expect(opts.killImageFn).toHaveBeenCalledWith('PoF-Win64-Shipping.exe');
    expect(opts.killPidFn).toHaveBeenCalledWith(4242);
  });

  it('fails with a spawnError when the bootstrap cannot launch', async () => {
    const erroringChild = {
      pid: undefined,
      on: (event: string, cb: (arg: Error) => void) => {
        if (event === 'error') cb(new Error('ENOENT'));
      },
    } as unknown as ReturnType<NonNullable<SmokeTestOptions['spawnFn']>>;
    const opts = baseOptions({
      spawnFn: vi.fn(() => erroringChild),
      tasklistFn: vi.fn(() => false),
    });
    const result = await runSmokeTest(opts);
    expect(result.status).toBe('fail');
    expect(result.spawnError).toContain('ENOENT');
  });
});

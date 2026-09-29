import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseProcessProbeOutput,
  isUnderStageDir,
  deriveGameImage,
  runSmokeTest,
  type SmokeTestOptions,
  type ProbedProcess,
} from '@/lib/packaging/smoke-test';

describe('parseProcessProbeOutput', () => {
  it('reads a single CIM object and an array of them', () => {
    expect(parseProcessProbeOutput('{"ProcessId":12,"ExecutablePath":"C:\\\\out\\\\PoF.exe"}'))
      .toEqual([{ pid: 12, exePath: 'C:\\out\\PoF.exe' }]);
    expect(parseProcessProbeOutput('[{"ProcessId":1,"ExecutablePath":null},{"ProcessId":2,"ExecutablePath":"D:\\\\x.exe"}]'))
      .toEqual([{ pid: 1, exePath: null }, { pid: 2, exePath: 'D:\\x.exe' }]);
  });

  it('reads nothing running (empty output) and garbage as no processes', () => {
    expect(parseProcessProbeOutput('')).toEqual([]);
    expect(parseProcessProbeOutput('not json')).toEqual([]);
  });
});

describe('isUnderStageDir', () => {
  it('matches only paths inside the stage dir, in any slash or case spelling', () => {
    expect(isUnderStageDir('C:\\out\\PoF\\Binaries\\Win64\\PoF-Win64-Shipping.exe', 'C:/out')).toBe(true);
    expect(isUnderStageDir('c:/OUT/PoF.exe', 'C:\\out\\')).toBe(true);
    expect(isUnderStageDir('C:/outside/PoF.exe', 'C:/out')).toBe(false);
    expect(isUnderStageDir('D:/Games/PoF/PoF-Win64-Shipping.exe', 'C:/out')).toBe(false);
    expect(isUnderStageDir(null, 'C:/out')).toBe(false);
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

const BOOTSTRAP_PID = 4242;

function baseOptions(
  processes: ProbedProcess[] = [{ pid: 900, exePath: 'C:\\out\\PoF\\Binaries\\Win64\\PoF-Win64-Shipping.exe' }],
  overrides: Partial<SmokeTestOptions> = {},
): SmokeTestOptions {
  const fakeChild = { pid: BOOTSTRAP_PID, on: vi.fn() } as unknown as ReturnType<NonNullable<SmokeTestOptions['spawnFn']>>;
  return {
    bootstrapExe: 'C:\\out\\PoF.exe',
    gameImage: 'PoF-Win64-Shipping.exe',
    observeMs: 25_000,
    spawnFn: vi.fn(() => fakeChild),
    probeFn: vi.fn(() => processes),
    killPidFn: vi.fn(),
    sleep: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('runSmokeTest watches and kills only THIS build', () => {
  it('passes when a game process launched from the stage dir is alive; kills exactly it + the bootstrap tree', async () => {
    const opts = baseOptions();
    const result = await runSmokeTest(opts);
    expect(result.status).toBe('pass');
    expect(result.gameAlive).toBe(true);
    expect(result.gamePids).toEqual([900]);
    expect(opts.probeFn).toHaveBeenCalledWith('PoF-Win64-Shipping.exe');
    expect(opts.spawnFn).toHaveBeenCalledWith('C:\\out\\PoF.exe', expect.any(Array), expect.any(Object));
    expect(opts.sleep).toHaveBeenCalledWith(25_000);
    expect(vi.mocked(opts.killPidFn!).mock.calls.map((c) => c[0])).toEqual([900, BOOTSTRAP_PID]);
  });

  it('a same-named process elsewhere on the machine is NOT this build: fail, and it is never killed', async () => {
    const opts = baseOptions([{ pid: 777, exePath: 'D:/Games/PoF/PoF-Win64-Shipping.exe' }]);
    const result = await runSmokeTest(opts);
    expect(result.status).toBe('fail');
    expect(result.gameAlive).toBe(false);
    expect(result.ignoredPids).toEqual([777]);
    const killed = vi.mocked(opts.killPidFn!).mock.calls.map((c) => c[0]);
    expect(killed).not.toContain(777);
    expect(killed).toEqual([BOOTSTRAP_PID]);
  });

  it('a process whose path cannot be read is not positively identified, so it is neither counted nor killed', async () => {
    const opts = baseOptions([{ pid: 55, exePath: null }]);
    const result = await runSmokeTest(opts);
    expect(result.status).toBe('fail');
    expect(vi.mocked(opts.killPidFn!).mock.calls.map((c) => c[0])).not.toContain(55);
  });

  it('fails with a spawnError when the bootstrap cannot launch, and still kills no stranger', async () => {
    const erroringChild = {
      pid: undefined,
      on: (event: string, cb: (arg: Error) => void) => {
        if (event === 'error') cb(new Error('ENOENT'));
      },
    } as unknown as ReturnType<NonNullable<SmokeTestOptions['spawnFn']>>;
    const opts = baseOptions([{ pid: 777, exePath: 'D:/Games/PoF/PoF-Win64-Shipping.exe' }], {
      spawnFn: vi.fn(() => erroringChild),
    });
    const result = await runSmokeTest(opts);
    expect(result.status).toBe('fail');
    expect(result.spawnError).toContain('ENOENT');
    expect(opts.killPidFn).not.toHaveBeenCalled();
  });

  it('no by-image kill exists any more (fleet DECISION: never taskkill /IM)', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/packaging/smoke-test.ts'), 'utf-8');
    expect(src).not.toMatch(/['"]\/IM['"]/);
    expect(src).not.toMatch(/killImage/);
  });
});

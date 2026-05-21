import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { cookExecutor, type CookEvent } from '@/lib/packaging/cook-executor';
import type { BuildProfile } from '@/lib/packaging/build-profiles';

const FIXTURES = join(__dirname, 'fixtures');
const SUCCESS_LOG = readFileSync(join(FIXTURES, 'cook-success.log'), 'utf-8');
const FAIL_LOG = readFileSync(join(FIXTURES, 'cook-fail.log'), 'utf-8');

function makeFakeChild(stdout: string, exitCode: number, stderr: string = ''): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess;
  Object.assign(emitter, {
    stdout: Readable.from([stdout]),
    stderr: Readable.from(stderr ? [stderr] : []),
    stdin: null,
    pid: 1234,
    exitCode: null as number | null,
    kill: () => true,
  });
  queueMicrotask(() => {
    (emitter as unknown as { exitCode: number }).exitCode = exitCode;
    emitter.emit('exit', exitCode);
  });
  return emitter;
}

const baseProfile: BuildProfile = {
  id: 'test-profile',
  name: 'Test Win64 Shipping',
  platform: 'Win64',
  config: 'Shipping',
  isDefault: false,
  cookSettings: {
    mapsToInclude: [],
    pluginsToDisable: [],
    usePak: true,
    compressPak: true,
    encryptPak: false,
    useIoStore: false,
    iterativeCooking: false,
    cookOnTheFly: false,
    textureStreamingBudgetMB: 0,
    compressTextures: true,
  },
  platformSettings: {
    architecture: 'x64',
    customFlags: [],
  },
  outputDir: '',
  stage: true,
  archive: false,
  archiveDir: '',
  runAfterPackage: false,
  createdAt: '2026-05-19T00:00:00.000Z',
  updatedAt: '2026-05-19T00:00:00.000Z',
};

const baseOpts = {
  profile: baseProfile,
  projectPath: 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF',
  projectName: 'PoF',
  ueVersion: '5.7.3',
  now: () => 0,
};

describe('cookExecutor', () => {
  it('parses phase markers from a successful cook log', async () => {
    const events: CookEvent[] = [];
    for await (const ev of cookExecutor({ ...baseOpts, spawnFn: () => makeFakeChild(SUCCESS_LOG, 0) })) {
      events.push(ev);
    }
    const phases = events.filter((e): e is Extract<CookEvent, { type: 'phase' }> => e.type === 'phase').map((e) => e.phase);
    expect(phases).toContain('cook');
    expect(phases).toContain('stage');
    expect(phases).toContain('done');
  });

  it('emits progress events with percent values', async () => {
    const events: CookEvent[] = [];
    for await (const ev of cookExecutor({ ...baseOpts, spawnFn: () => makeFakeChild(SUCCESS_LOG, 0) })) {
      events.push(ev);
    }
    const progress = events.filter((e): e is Extract<CookEvent, { type: 'progress' }> => e.type === 'progress');
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.every((e) => e.percent >= 0 && e.percent <= 100)).toBe(true);
  });

  it('extracts staged exe path and emits done on success', async () => {
    const events: CookEvent[] = [];
    for await (const ev of cookExecutor({ ...baseOpts, spawnFn: () => makeFakeChild(SUCCESS_LOG, 0) })) {
      events.push(ev);
    }
    const done = events.find((e): e is Extract<CookEvent, { type: 'done' }> => e.type === 'done');
    expect(done).toBeDefined();
    expect(done!.exePath).toContain('PoF.exe');
    expect(done!.status).toBe('success');
  });

  it('emits error event on non-zero exit', async () => {
    const events: CookEvent[] = [];
    for await (const ev of cookExecutor({ ...baseOpts, spawnFn: () => makeFakeChild(FAIL_LOG, 1) })) {
      events.push(ev);
    }
    const last = events.at(-1);
    expect(last?.type).toBe('error');
    if (last?.type === 'error') {
      expect(last.status).toBe('failed');
      expect(last.message).toMatch(/code 1/);
    }
  });

  it('spawns cmd.exe with the command wrapped and verbatim args', async () => {
    let capturedArgs: string[] | undefined;
    let capturedOpts: SpawnOptions | undefined;
    const spawnFn = (_cmd: string, args: string[], optsArg?: SpawnOptions): ChildProcess => {
      capturedArgs = args;
      capturedOpts = optsArg;
      return makeFakeChild(SUCCESS_LOG, 0);
    };
    for await (const _ev of cookExecutor({ ...baseOpts, spawnFn })) { /* drain */ }
    expect(capturedArgs?.[0]).toBe('/c');
    // The command must be wrapped in an outer quote pair so `cmd /c` does not
    // strip the inner quotes off the embedded paths.
    expect(capturedArgs?.[1]).toMatch(/^".*"$/);
    expect(capturedOpts?.windowsVerbatimArguments).toBe(true);
  });

  it('includes the stderr tail in the error message on failure', async () => {
    const events: CookEvent[] = [];
    const stderr = 'RunUAT.bat is not recognized as an internal or external command';
    for await (const ev of cookExecutor({ ...baseOpts, spawnFn: () => makeFakeChild('', 1, stderr) })) {
      events.push(ev);
    }
    const last = events.at(-1);
    expect(last?.type).toBe('error');
    if (last?.type === 'error') {
      expect(last.message).toMatch(/code 1/);
      expect(last.message).toContain('is not recognized');
    }
  });

  it('forwards log lines through (at least the error/warning ones)', async () => {
    const events: CookEvent[] = [];
    for await (const ev of cookExecutor({ ...baseOpts, spawnFn: () => makeFakeChild(FAIL_LOG, 1) })) {
      events.push(ev);
    }
    const logs = events.filter((e): e is Extract<CookEvent, { type: 'log' }> => e.type === 'log');
    expect(logs.some((e) => /failed to load/i.test(e.line))).toBe(true);
  });
});

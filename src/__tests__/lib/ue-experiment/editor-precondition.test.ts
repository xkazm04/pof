/**
 * Direction 1 — "an experiment does not kill the operator's editor".
 *
 * Two forced-failure axes, both RED against the pre-fix code:
 *  1. the cleanup path issues an image-name kill (`taskkill /IM UnrealEditor.exe /F`) — proved
 *     absent here through an injected exec seam that records EVERY command;
 *  2. there was no precondition at all — a live editor was resolved by killing it, not by
 *     refusing with a reason.
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import {
  buildTasklistArgs,
  parseTasklistCsv,
  detectRunningEditors,
  editorPreconditionReason,
  leaseConflictReason,
  EDITOR_IMAGES,
  type EditorLease,
} from '@/lib/ue-experiment/editor-precondition';
import { killSpawnedTree, createExperimentRun, type ExecSeam } from '@/lib/ue-experiment/editor-process';
import { runExperiment } from '@/lib/ue-experiment/runner';

const ENV = { POF_UE_UPROJECT: 'C:/p/PoF.uproject' };
const freeLease: EditorLease = { acquire: () => ({ ok: true }), release: () => {} };

/** A fake spawned child that exits immediately (so the run resolves without a real editor). */
function fakeSpawn(pid = 4242) {
  const calls: { binary: string; args: string[] }[] = [];
  const spawnFn = ((binary: string, args: string[]) => {
    calls.push({ binary, args });
    const child = new EventEmitter() as unknown as ChildProcess & EventEmitter;
    (child as unknown as { pid: number }).pid = pid;
    setTimeout(() => child.emit('exit', 0), 0);
    return child;
  }) as unknown as typeof import('node:child_process').spawn;
  return { spawnFn, calls };
}

function recordingExec(): { exec: ExecSeam; commands: { cmd: string; args: string[] }[] } {
  const commands: { cmd: string; args: string[] }[] = [];
  return { exec: (cmd, args) => { commands.push({ cmd, args }); }, commands };
}

describe('cleanup kills only what this run spawned', () => {
  it('killSpawnedTree issues exactly one PID-scoped taskkill and NO image-name kill', () => {
    const { exec, commands } = recordingExec();
    killSpawnedTree(1234, exec);
    expect(commands).toHaveLength(1);
    expect(commands[0].cmd).toBe('taskkill');
    expect(commands[0].args).toEqual(['/PID', '1234', '/T', '/F']);
    expect(commands[0].args).not.toContain('/IM');
  });

  it('a missing pid kills NOTHING (never a broader sweep)', () => {
    const { exec, commands } = recordingExec();
    killSpawnedTree(undefined, exec);
    expect(commands).toHaveLength(0);
  });

  it('the run seam never names an Unreal process image in any command it issues', async () => {
    const { exec, commands } = recordingExec();
    const { spawnFn } = fakeSpawn(777);
    await createExperimentRun({ spawnFn, exec })('C:/UE/UnrealEditor.exe', ['-x'], 5_000);
    // The killed thing is our PID; no command may name an image (this is the whole hazard).
    expect(commands.every((c) => !c.args.includes('/IM'))).toBe(true);
    for (const image of EDITOR_IMAGES) {
      expect(commands.some((c) => c.args.includes(image))).toBe(false);
    }
    expect(commands.map((c) => c.args)).toEqual([['/PID', '777', '/T', '/F']]);
  });

  it('runExperiment cleanup issues no image-name kill end-to-end', async () => {
    const { exec, commands } = recordingExec();
    const { spawnFn } = fakeSpawn(99);
    await runExperiment(
      { python: 'pass' },
      {
        run: createExperimentRun({ spawnFn, exec }),
        fileExists: () => true,
        env: ENV,
        now: () => 1,
        detectEditors: () => [],
        editorLease: freeLease,
      },
    );
    expect(commands.flatMap((c) => c.args)).not.toContain('/IM');
  });
});

describe('no image-name kill survives anywhere in the subsystem', () => {
  // Static mirror of `ue-launch/capture.test.ts` — the behavioural tests above cover the seams
  // that exist, this one refuses a NEW `/IM` sweep being added anywhere in ue-experiment. It is
  // the assertion that is red against the pre-fix runner (which issued two of them in `done()`).
  const SRC = join(process.cwd(), 'src', 'lib', 'ue-experiment');

  /** Strip comments — the modules DOCUMENT the removed sweep so it is never reintroduced;
   *  only executable code may not name an image. */
  const code = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it.each(['runner.ts', 'editor-process.ts', 'editor-precondition.ts', 'job-store.ts', 'experiment-db.ts'])(
    '%s issues no taskkill /IM',
    (file) => {
      const src = code(readFileSync(join(SRC, file), 'utf-8'));
      expect(src).not.toMatch(/'\/IM'/);
      expect(src).not.toMatch(/taskkill[^\n]*\/IM/);
    },
  );
});

describe('tasklist probe (LIST, never kill)', () => {
  it('builds a filter that reads one image', () => {
    expect(buildTasklistArgs('UnrealEditor.exe')).toEqual(['/FI', 'IMAGENAME eq UnrealEditor.exe', '/NH', '/FO', 'CSV']);
  });

  it('parses CSV rows and ignores the no-match INFO line', () => {
    expect(parseTasklistCsv('"UnrealEditor.exe","12345","Console","1","2,048 K"')).toEqual([
      { image: 'UnrealEditor.exe', pid: 12345 },
    ]);
    expect(parseTasklistCsv('INFO: No tasks are running which match the specified criteria.')).toEqual([]);
    expect(parseTasklistCsv('')).toEqual([]);
  });

  it('detectRunningEditors probes both editor images and never throws on an unavailable probe', () => {
    const exec = vi.fn((_c: string, args: string[]) =>
      args[1].includes('UnrealEditor.exe"') || args[1] === 'IMAGENAME eq UnrealEditor.exe'
        ? '"UnrealEditor.exe","900","Console","1","1 K"'
        : 'INFO: No tasks are running which match the specified criteria.',
    );
    expect(detectRunningEditors(exec)).toEqual([{ image: 'UnrealEditor.exe', pid: 900 }]);
    expect(exec).toHaveBeenCalledTimes(EDITOR_IMAGES.length);

    const throwing = () => { throw new Error('tasklist: not found'); };
    expect(detectRunningEditors(throwing)).toEqual([]);
  });
});

describe('precondition refuses instead of killing', () => {
  it('names the running editor + PID and returns the decision to the user', () => {
    const reason = editorPreconditionReason([{ image: 'UnrealEditor.exe', pid: 4321 }]);
    expect(reason).toMatch(/UnrealEditor\.exe \(PID 4321\)/);
    expect(reason).toMatch(/will not kill an editor it did not start/);
    expect(reason).toMatch(/Run anyway/);
    expect(editorPreconditionReason([])).toBeNull();
  });

  it('runExperiment refuses (nothing spawned) when an editor is live', async () => {
    const run = vi.fn(async () => {});
    const res = await runExperiment(
      { python: 'pass', capture: true },
      {
        run,
        fileExists: () => true,
        env: ENV,
        now: () => 1,
        detectEditors: () => [{ image: 'UnrealEditor.exe', pid: 4321 }],
        editorLease: freeLease,
      },
    );
    expect(res.refused).toBe(true);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/PID 4321/);
    expect(run).not.toHaveBeenCalled();
  });

  it('the explicit user override proceeds — and still kills nothing but its own tree', async () => {
    const run = vi.fn(async () => {});
    const res = await runExperiment(
      { python: 'pass', allowRunningEditor: true },
      {
        run,
        fileExists: () => true,
        env: ENV,
        now: () => 1,
        detectEditors: () => [{ image: 'UnrealEditor.exe', pid: 4321 }],
        editorLease: freeLease,
      },
    );
    expect(res.refused).toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('drain lease', () => {
  it('refuses (not overridable) when the gate drain holds the editor', async () => {
    const run = vi.fn(async () => {});
    const held: EditorLease = { acquire: () => ({ ok: false, conflict: '*|*' }), release: () => {} };
    const res = await runExperiment(
      { python: 'pass', allowRunningEditor: true },
      { run, fileExists: () => true, env: ENV, now: () => 1, detectEditors: () => [], editorLease: held },
    );
    expect(res.refused).toBe(true);
    expect(res.error).toMatch(/drain currently holds the editor lease \(global\)/);
    expect(run).not.toHaveBeenCalled();
  });

  it('releases the lease when the run throws', async () => {
    let released = 0;
    const lease: EditorLease = { acquire: () => ({ ok: true }), release: () => { released += 1; } };
    await expect(
      runExperiment(
        { python: 'pass' },
        {
          run: async () => { throw new Error('spawn exploded'); },
          fileExists: () => true,
          env: ENV,
          now: () => 1,
          detectEditors: () => [],
          editorLease: lease,
        },
      ),
    ).rejects.toThrow(/spawn exploded/);
    expect(released).toBe(1);
  });

  it('names the holding scope in the refusal', () => {
    expect(leaseConflictReason('materials|tm-floor')).toMatch(/materials\/tm-floor/);
    expect(leaseConflictReason('*|*')).toMatch(/not overridable/);
  });
});

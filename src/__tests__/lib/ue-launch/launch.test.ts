import { describe, it, expect, afterEach } from 'vitest';
import { writeFile, unlink } from 'node:fs/promises';
import { launchEditor } from '@/lib/ue-launch/launch';
import { extractLogMarker } from '@/lib/ue-launch/parse';

const cleanups: string[] = [];
afterEach(async () => {
  for (const p of cleanups.splice(0)) { await unlink(p).catch(() => {}); }
});

describe('launchEditor', () => {
  it('resolves the 5.8 binary, runs it with the built args, and returns the abslog contents', async () => {
    const run = async (_binary: string, args: string[]) => {
      const abslogArg = args.find((a) => a.startsWith('-abslog='))!;
      const path = abslogArg.slice('-abslog='.length);
      cleanups.push(path);
      await writeFile(path, 'LogInit: boot\nLogPython: SPIKE=PoF toolset alive\nLogExit: done\n');
      return { exitCode: 0, timedOut: false };
    };

    const res = await launchEditor(
      { uproject: 'C:\\p\\PoF.uproject', engine: '5.8', execCmds: 'py ping()' },
      { run },
    );

    expect(res.binary).toContain('UE_5.8');
    expect(res.binary).toContain('UnrealEditor-Cmd.exe');
    expect(res.args[0]).toBe('C:\\p\\PoF.uproject');
    expect(res.args).toContain('-ExecCmds=py ping()');
    expect(res.timedOut).toBe(false);
    expect(res.exitCode).toBe(0);
    expect(extractLogMarker(res.log, 'SPIKE')).toBe('PoF toolset alive');
  });

  it('surfaces a watchdog timeout from the runner', async () => {
    const run = async () => ({ exitCode: null, timedOut: true });
    const res = await launchEditor({ uproject: 'C:\\p\\PoF.uproject' }, { run });
    expect(res.timedOut).toBe(true);
    expect(res.log).toBe(''); // no abslog written
  });
});

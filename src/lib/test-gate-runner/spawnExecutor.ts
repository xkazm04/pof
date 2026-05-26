import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GateExecutor, GateJob, GateVerdict } from './types';

export interface SpawnExecutorOptions {
  /**
   * Must be explicitly true to enable spawning. Spawning a headless editor
   * collides with other sessions on the shared UE tree (see project memory
   * `ue-shared-concurrency`), so the bridge executor is the default; this is
   * the seam, kept off unless the operator opts in AND the env is configured.
   */
  allowSpawn?: boolean;
  /** Override the editor binary / uproject (else from POF_UE_EDITOR_CMD / POF_UE_UPROJECT). */
  editorCmd?: string;
  uproject?: string;
}

/** Args for `UnrealEditor-Cmd` to run one automation test headlessly. Pure (tested). */
export function buildAutomationArgs(testName: string, uproject: string, abslog: string): string[] {
  return [
    uproject,
    `-ExecCmds=Automation RunTests ${testName};Quit`,
    '-unattended',
    '-nopause',
    '-nosplash',
    '-nullrhi',
    `-abslog=${abslog}`,
  ];
}

/**
 * Read the verdict from an `-abslog`. Judged by markers, not exit code —
 * headless runs exit non-zero on the benign bridge shutdown null-deref.
 * Pure (tested).
 */
export function parseAbslogVerdict(log: string): { status: 'pass' | 'fail'; detail: string } {
  if (/\[gate\]\s*RESULT=PASS/i.test(log)) return { status: 'pass', detail: '[gate] RESULT=PASS' };
  if (/\[gate\]\s*RESULT=FAIL/i.test(log)) return { status: 'fail', detail: '[gate] RESULT=FAIL' };
  if (/Result=\{Success\}/i.test(log)) return { status: 'pass', detail: 'Result={Success}' };
  if (/Result=\{Fail\}/i.test(log)) return { status: 'fail', detail: 'Result={Fail}' };
  // No success marker found → treat as failure (a crashed/aborted run never passed).
  return { status: 'fail', detail: 'no success marker in abslog' };
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 60);
}

/** L3 executor that runs a headless UnrealEditor-Cmd automation pass. Off by default. */
export function makeSpawnExecutor(opts: SpawnExecutorOptions = {}): GateExecutor {
  const editorCmd = opts.editorCmd ?? process.env.POF_UE_EDITOR_CMD;
  const uproject = opts.uproject ?? process.env.POF_UE_UPROJECT;

  return {
    id: 'spawn',
    tier: 'L3',

    async available() {
      return !!(opts.allowSpawn && editorCmd && uproject);
    },

    async run(job: GateJob): Promise<GateVerdict> {
      if (!opts.allowSpawn) throw new Error('spawn executor disabled (pass allowSpawn:true to enable)');
      if (!editorCmd || !uproject) throw new Error('spawn executor needs POF_UE_EDITOR_CMD + POF_UE_UPROJECT');
      const abslog = join(tmpdir(), `pof-gate-${Date.now()}-${sanitize(job.testName ?? 'test')}.log`);
      const args = buildAutomationArgs(job.testName!, uproject, abslog);

      await new Promise<void>((resolve) => {
        const child = spawn(editorCmd, args, { windowsHide: true });
        child.on('exit', () => resolve()); // exit code ignored — judged by abslog
        child.on('error', () => resolve());
      });

      const log = await readFile(abslog, 'utf-8').catch(() => '');
      if (!log) throw new Error(`no abslog produced at ${abslog}`);
      const v = parseAbslogVerdict(log);
      return { status: v.status, detail: `${job.testName}: ${v.detail}`, raw: { abslog } };
    },
  };
}

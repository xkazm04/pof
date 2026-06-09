import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { BuildProfile } from './build-profiles';
import { generateUATCommand } from './uat-command-generator';
import type { SpawnFn } from './process-utils';

export type { SpawnFn };

export type CookPhase = 'cook' | 'stage' | 'package' | 'done';

export type CookEvent =
  | { type: 'phase'; phase: CookPhase; t: number }
  | { type: 'progress'; percent: number; t: number }
  | { type: 'log'; line: string; t: number }
  // sizeBytes is a *measured* fact (recursive sum of the stage dir) or null when it
  // couldn't be measured — never a placeholder 0, which would masquerade as a real
  // measurement and silently disable the entire size-budget gate (evaluateBuildSize
  // treats <= 0 as "no size" and stats skip NULL rows).
  | { type: 'done'; exePath: string; durationMs: number; sizeBytes: number | null; status: 'success'; t: number }
  | { type: 'error'; message: string; status: 'failed'; t: number };

/**
 * Recursively sum the byte size of every file under `dir`. Returns null only when the
 * directory itself can't be read (so the caller records "unknown", not a fake 0);
 * individual unreadable entries are skipped so a partial tree still yields a best-effort sum.
 */
async function dirSizeBytes(dir: string): Promise<number | null> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  let total = 0;
  for (const entry of entries) {
    const full = join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        const sub = await dirSizeBytes(full);
        if (sub !== null) total += sub;
      } else if (entry.isFile()) {
        total += (await stat(full)).size;
      }
    } catch { /* skip an unreadable entry, keep summing the rest */ }
  }
  return total;
}

export interface CookExecutorOptions {
  profile: BuildProfile;
  projectPath: string;
  projectName: string;
  ueVersion: string;
  signal?: AbortSignal;
  spawnFn?: SpawnFn;
  now?: () => number;
}

const PHASE_MARKERS: ReadonlyArray<{ pattern: RegExp; phase: CookPhase }> = [
  { pattern: /Cook commandlet started/i, phase: 'cook' },
  { pattern: /Stage commandlet started|PrepareForStaging/i, phase: 'stage' },
  { pattern: /Package commandlet started|Archive.*started/i, phase: 'package' },
  { pattern: /BUILD COMMAND COMPLETED|All commands succeeded/i, phase: 'done' },
];

const PROGRESS_REGEX = /progress=(\d+)%/i;
// RunUAT does not print the staged exe path directly; it prints the stage
// directory. The staged launcher exe is <stageDir>\<ProjectName>.exe.
const STAGE_DIR_REGEX = /(?:Cleaning Stage Directory|to staging directory):\s*([A-Z]:\\.+?)\s*$/i;
const LOG_THROTTLE_MS = 100;

export async function* cookExecutor(opts: CookExecutorOptions): AsyncGenerator<CookEvent> {
  const now = opts.now ?? Date.now;
  const start = now();
  const t = () => now() - start;
  const spawnImpl = opts.spawnFn ?? (spawn as unknown as SpawnFn);

  const cmdString = generateUATCommand(opts.profile, opts.projectPath, opts.projectName, opts.ueVersion);
  // cmdString embeds quoted paths. Two Windows quirks must both be handled or
  // the command never launches (exit 1):
  //  - windowsVerbatimArguments stops Node escaping the inner quotes as \" ;
  //  - `cmd /c` strips the outer quote pair off its argument, so the whole
  //    command is wrapped in an extra pair to keep the inner quotes intact.
  const child = spawnImpl('cmd.exe', ['/c', `"${cmdString}"`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsVerbatimArguments: true,
  });

  if (opts.signal) {
    opts.signal.addEventListener('abort', () => {
      try { child.kill('SIGTERM'); } catch { /* noop */ }
    });
  }

  // Drain stderr concurrently: an unread stderr pipe can stall the child, and
  // its tail is the only diagnostic when the cook fails before any stdout.
  let stderrTail = '';
  if (child.stderr) {
    child.stderr.setEncoding('utf-8');
    child.stderr.on('data', (d: string) => {
      stderrTail = (stderrTail + d).slice(-4000);
    });
  }

  const readable = child.stdout;
  if (!readable) {
    yield { type: 'error', message: 'cook-executor: child has no stdout', status: 'failed', t: t() };
    return;
  }

  let currentPhase: CookPhase | null = null;
  let stageDir: string | null = null;
  let lastLogEmit = 0;
  let buffer = '';

  for await (const chunk of readable as AsyncIterable<Buffer | string>) {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    const split = buffer.split(/\r?\n/);
    buffer = split.pop() ?? '';

    for (const raw of split) {
      const line = raw.replace(/\r/g, '');

      for (const m of PHASE_MARKERS) {
        if (m.pattern.test(line) && currentPhase !== m.phase) {
          currentPhase = m.phase;
          yield { type: 'phase', phase: m.phase, t: t() };
          break;
        }
      }

      const pm = PROGRESS_REGEX.exec(line);
      if (pm) {
        const pct = Number(pm[1]);
        if (Number.isFinite(pct) && pct >= 0 && pct <= 100) {
          yield { type: 'progress', percent: pct, t: t() };
        }
      }

      const sm = STAGE_DIR_REGEX.exec(line);
      if (sm) stageDir = sm[1].trim();

      const tn = t();
      const isImportant = /\b(error|warning|fail)/i.test(line);
      if (isImportant || tn - lastLogEmit >= LOG_THROTTLE_MS) {
        lastLogEmit = tn;
        yield { type: 'log', line, t: tn };
      }
    }
  }

  if (buffer.length > 0) {
    yield { type: 'log', line: buffer, t: t() };
  }

  const exit = await new Promise<number>((resolve) => {
    if (child.exitCode !== null) { resolve(child.exitCode); return; }
    child.once('exit', (code) => resolve(code ?? -1));
  });

  if (exit === 0) {
    // Measure the staged build on disk. RunUAT never prints the size, so without this
    // the size-budget gate, trend chart, and stats are blind on every real cook.
    const sizeBytes = stageDir ? await dirSizeBytes(stageDir) : null;
    yield {
      type: 'done',
      exePath: stageDir ? `${stageDir}\\${opts.projectName}.exe` : '',
      durationMs: t(),
      sizeBytes,
      status: 'success',
      t: t(),
    };
  } else {
    const tail = stderrTail.trim();
    yield {
      type: 'error',
      message: tail
        ? `cook exited with code ${exit}\n${tail}`
        : `cook exited with code ${exit}`,
      status: 'failed',
      t: t(),
    };
  }
}

/**
 * Pre-run precondition for the Experiment Lab.
 *
 * An experiment boots its OWN UnrealEditor, and UE is not re-entrant on one project. The
 * runner used to resolve that by force-killing every Unreal process on the machine — i.e. by
 * destroying the operator's open editor and its unsaved work (see `editor-process.ts`).
 *
 * The honest resolution is a REFUSAL, not a kill: detect a live editor, name it, and hand the
 * decision back to the user. Two independent guards, both read-only:
 *
 *  1. **Process probe** — `tasklist` (LIST, never kill) for the two editor images. Overridable
 *     by an explicit user action (`allowRunningEditor`) with the consequence stated at the
 *     control, because an operator may deliberately want a second instance.
 *  2. **Drain lease** — the gate-runner's in-process editor lease (`test-gate-runner/drain-lease`),
 *     the same registry the drain route and always-on worker contend on. This one is NOT
 *     overridable: it is a machine-state fact inside our own process, and stepping over it is
 *     precisely the race that made a drain mis-attribute our kill to itself.
 */
import { execFileSync } from 'node:child_process';
import { logger } from '@/lib/logger';
import { acquireLeases, releaseLeases, scopeFromKey } from '@/lib/test-gate-runner/drain-lease';

/** The two Unreal process images an experiment would collide with. */
export const EDITOR_IMAGES = ['UnrealEditor.exe', 'UnrealEditor-Cmd.exe'] as const;

export interface RunningEditor {
  image: string;
  pid: number;
}

/**
 * `tasklist` args that LIST one image. Pure — and deliberately the only Unreal-image-shaped
 * argv in this subsystem: it names an image to READ, never to kill.
 */
export function buildTasklistArgs(image: string): string[] {
  return ['/FI', `IMAGENAME eq ${image}`, '/NH', '/FO', 'CSV'];
}

/**
 * Parse `tasklist /FO CSV /NH` output into running processes. Pure.
 * A no-match prints `INFO: No tasks are running which match…` (not CSV) → empty.
 */
export function parseTasklistCsv(out: string): RunningEditor[] {
  const found: RunningEditor[] = [];
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^"([^"]+)","(\d+)"/);
    if (m) found.push({ image: m[1], pid: Number(m[2]) });
  }
  return found;
}

/** Run a process and return its stdout. Injectable so tests never touch the real process table. */
export type ProbeExec = (cmd: string, args: string[]) => string;

const defaultProbeExec: ProbeExec = (cmd, args) =>
  execFileSync(cmd, args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });

/**
 * Which editor processes are live right now. Never throws: a probe that cannot run (non-Windows,
 * no `tasklist`) reports nothing found and SAYS SO in the debug log — an undetectable editor must
 * not become a silent excuse to proceed quietly, but it also must not block the lab on a platform
 * where the probe does not exist.
 */
export function detectRunningEditors(
  exec: ProbeExec = defaultProbeExec,
  images: readonly string[] = EDITOR_IMAGES,
): RunningEditor[] {
  const found: RunningEditor[] = [];
  for (const image of images) {
    try {
      found.push(...parseTasklistCsv(exec('tasklist', buildTasklistArgs(image))));
    } catch (e) {
      logger.debug(`[ue-experiment] editor probe unavailable for ${image} (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  return found;
}

/** The named refusal reason for a set of detected editors, or null when the machine is clear. Pure. */
export function editorPreconditionReason(found: RunningEditor[]): string | null {
  if (found.length === 0) return null;
  const named = found.map((f) => `${f.image} (PID ${f.pid})`).join(', ');
  return (
    `Refused: an Unreal editor is already running — ${named}. ` +
    `An experiment boots its own editor and UE is not re-entrant on one project. ` +
    `PoF will not kill an editor it did not start, so this decision is yours: close that editor and re-run, ` +
    `or tick "Run anyway" to launch beside it (consequence: the second instance commonly fails to launch or ` +
    `fights the first for project file locks — and your open editor is left untouched either way).`
  );
}

/** The editor lease an experiment holds for the duration of its run. */
export interface EditorLease {
  acquire: () => { ok: true } | { ok: false; conflict: string };
  release: () => void;
}

/**
 * An experiment boots the ONE non-reentrant editor for the whole project, so it contends on the
 * gate-runner's GLOBAL drain key — the same key the always-on worker and an unscoped drain take.
 */
const EXPERIMENT_LEASE_KEYS = ['*|*'];

export const drainEditorLease: EditorLease = {
  acquire: () => acquireLeases(EXPERIMENT_LEASE_KEYS),
  release: () => releaseLeases(EXPERIMENT_LEASE_KEYS),
};

/** The named refusal reason for a lease conflict. Pure. */
export function leaseConflictReason(conflict: string): string {
  return (
    `Refused: the UE gate drain currently holds the editor lease (${scopeFromKey(conflict)}). ` +
    `An experiment boots the same non-reentrant editor, so running now would race the drain ` +
    `(and previously killed its editor, which the drain then mis-read as its own spawn failure). ` +
    `Re-run once the drain finishes — this guard is not overridable.`
  );
}

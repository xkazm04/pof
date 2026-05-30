import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GateAssertion, GateExecutor, GateJob, GateVerdict } from './types';

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
  /** Watchdog for a scenario run (the controller RequestExits on completion). Default 180s. */
  scenarioTimeoutMs?: number;
}

/** Spawn `cmd`, resolve on exit, or kill (SIGKILL) + resolve after `timeoutMs`. */
function spawnAndWait(cmd: string, args: string[], timeoutMs: number): Promise<{ timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let done = false;
    const finish = (timedOut: boolean) => {
      if (done) return;
      done = true;
      resolve({ timedOut });
    };
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
      finish(true);
    }, timeoutMs);
    child.on('exit', () => { clearTimeout(timer); finish(false); });
    child.on('error', () => { clearTimeout(timer); finish(false); });
  });
}

/**
 * Args for `UnrealEditor-Cmd` to run one automation test headlessly. Pure (tested).
 * Mirrors the project's real invocation (Source/PoF/Test/README + VS*Test headers):
 * `UnrealEditor-Cmd PoF.uproject -ExecCmds="Automation RunTests <name>;Quit" -unattended -nopause -nullrhi -log -abslog=<file>`.
 */
export function buildAutomationArgs(testName: string, uproject: string, abslog: string): string[] {
  return [
    uproject,
    `-ExecCmds=Automation RunTests ${testName};Quit`,
    '-unattended',
    '-nopause',
    '-nosplash',
    '-nullrhi',
    '-log',
    `-abslog=${abslog}`,
  ];
}

/**
 * Read the verdict from an `-abslog`. Judged by markers, not exit code —
 * headless runs exit non-zero on the benign bridge shutdown null-deref. Markers
 * confirmed against ground truth: the UE automation controller emits
 * `LogAutomationController: ... Result={Success}` / `Result={Failure}`; some
 * project Python gates emit `[gate] RESULT=PASS/FAIL`. Pure (tested).
 */
export function parseAbslogVerdict(log: string): { status: 'pass' | 'fail'; detail: string } {
  if (/\[gate\]\s*RESULT=PASS/i.test(log)) return { status: 'pass', detail: '[gate] RESULT=PASS' };
  if (/\[gate\]\s*RESULT=FAIL/i.test(log)) return { status: 'fail', detail: '[gate] RESULT=FAIL' };
  if (/Result=\{Success\}/i.test(log)) return { status: 'pass', detail: 'Result={Success}' };
  if (/Result=\{Fail(?:ure)?\}/i.test(log)) return { status: 'fail', detail: 'Result={Failure}' };
  // No success marker found → treat as failure (a crashed/aborted run never passed).
  return { status: 'fail', detail: 'no success marker in abslog' };
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 60);
}

/**
 * Args for a headless behavioural scenario run: open the map in a real game loop and
 * arm the runtime UScenarioController via `-PoFScenario`. The controller drives the
 * timed inputs, samples the evaluated pose/location, writes `observations.json` + DONE,
 * and (standalone) RequestExits. `-nullrhi` keeps it headless — pose/movement metrics
 * are CPU-evaluated and valid without RHI (frame capture is an L4/visual concern, not L3).
 * Pure (tested).
 */
export function buildScenarioArgs(uproject: string, map: string, scenarioPath: string, abslog: string): string[] {
  return [
    uproject,
    map,
    '-game',
    `-PoFScenario=${scenarioPath}`,
    '-nullrhi',
    '-unattended',
    '-nopause',
    '-nosplash',
    '-log',
    `-abslog=${abslog}`,
  ];
}

interface ObsSample {
  t: number;
  loc_x: number;
  loc_y: number;
  loc_z: number;
  speed: number;
  droopL: number;
  droopR: number;
  anim_speed?: number;
  montage_playing?: boolean;
  health?: number;
  stamina?: number;
  mana?: number;
}

/** max−min of a defined numeric attribute across samples (its biggest dip/swing). */
function attrDrop(samples: ObsSample[], name: 'health' | 'stamina' | 'mana'): number {
  const vals = samples.map((s) => s[name]).filter((v): v is number => typeof v === 'number' && v >= 0);
  if (vals.length < 1) return 0;
  return Math.max(...vals) - Math.min(...vals);
}
interface Observations {
  started?: boolean;
  samples?: ObsSample[];
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
}

/**
 * Judge a scenario's `observations.json` against its assertions — the FAITHFUL verdict:
 * arm-droop variance across samples = the walk-cycle / animation signature (the exact
 * discriminator that separated the walking Manny from the T-posing player in calibration);
 * 2D displacement = movement. No symbolic "Result={Success}" — the observed effect IS the
 * verdict. All assertions must hold. Pure (tested).
 */
export function parseScenarioVerdict(obs: Observations, assertions: GateAssertion[]): { status: 'pass' | 'fail'; detail: string } {
  const samples = obs?.samples ?? [];
  if (!obs?.started || samples.length === 0) {
    return { status: 'fail', detail: 'scenario did not start / no samples observed' };
  }
  const swing = Math.max(stddev(samples.map((s) => s.droopL)), stddev(samples.map((s) => s.droopR)));
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dist = Math.hypot(last.loc_x - first.loc_x, last.loc_y - first.loc_y);

  const fails: string[] = [];
  for (const a of assertions) {
    if (a.kind === 'animated') {
      const min = a.minSwingDeg ?? 10;
      if (swing < min) fails.push(`animated: arm-swing ${swing.toFixed(1)}° < ${min}°`);
    } else if (a.kind === 'moved') {
      const min = a.minDist ?? 50;
      if (dist < min) fails.push(`moved: displaced ${dist.toFixed(0)} < ${min}`);
    } else if (a.kind === 'static') {
      const max = a.maxSwingDeg ?? 5;
      if (swing > max) fails.push(`static: arm-swing ${swing.toFixed(1)}° > ${max}°`);
    } else if (a.kind === 'montage-playing') {
      if (!samples.some((s) => s.montage_playing === true)) fails.push('montage-playing: no montage played in any sample');
    } else if (a.kind === 'attribute-drop') {
      const min = a.minDelta ?? 1;
      const drop = attrDrop(samples, a.name);
      if (drop < min) fails.push(`attribute-drop ${a.name}: Δ${drop.toFixed(1)} < ${min}`);
    } else if (a.kind === 'ability-activated') {
      const montage = samples.some((s) => s.montage_playing === true);
      const resource = attrDrop(samples, 'health') >= 1 || attrDrop(samples, 'stamina') >= 1 || attrDrop(samples, 'mana') >= 1;
      if (!montage && !resource) fails.push('ability-activated: no montage and no resource change observed');
    }
  }
  if (fails.length) return { status: 'fail', detail: fails.join('; ') };
  const mont = samples.some((s) => s.montage_playing === true) ? ' montage✓' : '';
  return { status: 'pass', detail: `swing=${swing.toFixed(1)}° dist=${dist.toFixed(0)}${mont} over ${samples.length} samples` };
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

      // Behavioural scenario path (faithful L3): drive inputs, observe the effect.
      if (job.scenario) {
        const scn = job.scenario;
        const outDir = join(tmpdir(), `pof-scn-${Date.now()}-${sanitize(job.step)}`);
        await mkdir(outDir, { recursive: true });
        const outDirFwd = outDir.replace(/\\/g, '/');
        const scnPath = join(outDir, 'scenario.json');
        await writeFile(scnPath, JSON.stringify({
          out_dir: outDirFwd,
          total_seconds: scn.totalSeconds,
          num_samples: scn.numSamples,
          settle: scn.settle ?? 1.0,
          ...(scn.playAnim ? { play_anim: scn.playAnim } : {}),
          inputs: scn.inputs.map((i) => ({
            ...(i.key ? { key: i.key } : {}),
            ...(i.action ? { action: i.action } : {}),
            ...(i.value ? { value: i.value } : {}),
            ...(i.event ? { event: i.event } : {}),
            ...(i.eventArg ? { event_arg: i.eventArg } : {}),
            start: i.start,
            duration: i.duration,
          })),
        }, null, 2));
        const scnLog = join(outDir, 'editor.log');
        const scnArgs = buildScenarioArgs(uproject, scn.map, scnPath.replace(/\\/g, '/'), scnLog);
        const { timedOut } = await spawnAndWait(editorCmd, scnArgs, opts.scenarioTimeoutMs ?? 180_000);
        const obsRaw = await readFile(join(outDir, 'observations.json'), 'utf-8').catch(() => '');
        if (!obsRaw) throw new Error(`no observations.json at ${outDir}${timedOut ? ' (watchdog timeout)' : ''}`);
        const v = parseScenarioVerdict(JSON.parse(obsRaw) as Observations, scn.assert);
        return { status: v.status, detail: `${job.step}: ${v.detail}`, raw: { outDir, timedOut } };
      }

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

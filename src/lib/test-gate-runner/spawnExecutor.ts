import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logger } from '@/lib/logger';
import {
  boundSamples,
  buildScenarioInbox,
  buildScenarioLaunchArgs,
  type GateEvidence,
  type ObsSample,
  type Observations,
  type ScenarioInboxOptions,
} from '@/types/observation';
import { parseAbslogVerdict, runBatchAutomation, type SpawnFn } from './batchAutomation';
import type { GateAssertion, GateExecutor, GateJob, GateScenario, GateVerdict } from './types';

// The abslog fallback parser lives in `batchAutomation` (shared by the single-boot and
// grouped-boot paths); re-export it so its public API + tests stay stable.
export { parseAbslogVerdict } from './batchAutomation';

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
  /** Watchdog for an automation run (`Automation RunTests …;Quit`). Default 180s. A hung
   *  headless editor that never quits is SIGKILLed so the drain worker can't stall forever.
   *  Also caps the ONE grouped-boot batch run (`prepareBatch`). */
  automationTimeoutMs?: number;
  /**
   * Injectable watchdog-spawn seam (tests only). Defaults to the real SIGKILL-guarded
   * {@link spawnAndWait}. Lets a unit test assert the boot COUNT (N automation gates → one
   * `spawn` call) without ever launching a real editor.
   */
  spawnImpl?: SpawnFn;
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
  return buildScenarioLaunchArgs({ uproject, map, scenarioPath, render: { mode: 'nullrhi', abslog } });
}

/** max−min of a defined numeric attribute across samples (its biggest dip/swing). */
function attrDrop(samples: ObsSample[], name: 'health' | 'stamina' | 'mana'): number {
  const vals = samples.map((s) => s[name]).filter((v): v is number => typeof v === 'number' && v >= 0);
  if (vals.length < 1) return 0;
  return Math.max(...vals) - Math.min(...vals);
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
}

/** A finite numeric reading, else undefined (defends against older UE emissions omitting a field). */
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Stats a scenario verdict surfaces — the structured proof the flip is judged from. */
export interface ScenarioStats {
  swingDeg: number;
  /** 2D horizontal displacement (loc_x/loc_y) — the historical `distance`, kept stable. */
  distance: number;
  /** 3D displacement (includes loc_z) — equals `distance` when loc_z is flat/absent. */
  distance3d: number;
  /** Peak observed speed across samples (0 when speed is never emitted). */
  peakSpeed: number;
  /** Max |loc_z − startZ| across samples — the vertical lift of a jump/knockback. */
  verticalRise: number;
  sampleCount: number;
  montagePlaying: number;
  /** All fields are numeric — assignable straight into `GateEvidence.stats` (Record<string,number>). */
  [k: string]: number;
}

/**
 * Judge a scenario's `observations.json` against its assertions — the FAITHFUL verdict:
 * arm-droop variance across samples = the walk-cycle / animation signature (the exact
 * discriminator that separated the walking Manny from the T-posing player in calibration);
 * displacement = movement (2D by default, full 3D via hypot3 when a `moved` assertion asks for
 * `in3D` and loc_z is carried); peak `speed` = real locomotion velocity; vertical loc_z rise =
 * a jump/knockback (previously unobservable). No symbolic "Result={Success}" — the observed
 * effect IS the verdict. All assertions must hold. Pure (tested).
 */
export function parseScenarioVerdict(
  obs: Observations,
  assertions: GateAssertion[],
): { status: 'pass' | 'fail'; detail: string; stats?: ScenarioStats } {
  const samples = obs?.samples ?? [];
  if (!obs?.started || samples.length === 0) {
    return { status: 'fail', detail: 'scenario did not start / no samples observed' };
  }
  const swing = Math.max(stddev(samples.map((s) => s.droopL)), stddev(samples.map((s) => s.droopR)));
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dx = last.loc_x - first.loc_x;
  const dy = last.loc_y - first.loc_y;
  const dist = Math.hypot(dx, dy);
  // 3D displacement uses loc_z only when BOTH endpoints carry a finite z (else it degrades to 2D).
  const z0 = num(first.loc_z);
  const z1 = num(last.loc_z);
  const has3d = z0 !== undefined && z1 !== undefined;
  const dist3d = has3d ? Math.hypot(dx, dy, z1 - z0) : dist;
  const peakSpeed = samples.reduce((m, s) => Math.max(m, num(s.speed) ?? 0), 0);
  const verticalRise = z0 === undefined
    ? 0
    : samples.reduce((m, s) => { const z = num(s.loc_z); return z === undefined ? m : Math.max(m, Math.abs(z - z0)); }, 0);
  // The observed effect IS the verdict — surface it as structured stats (evidence) so a flip keeps
  // its proof: arm-swing°, 2D + 3D displacement, peak speed, vertical rise, sample count, montage.
  const stats: ScenarioStats = {
    swingDeg: swing,
    distance: dist,
    distance3d: dist3d,
    peakSpeed,
    verticalRise,
    sampleCount: samples.length,
    montagePlaying: samples.some((s) => s.montage_playing === true) ? 1 : 0,
  };

  const fails: string[] = [];
  for (const a of assertions) {
    if (a.kind === 'animated') {
      const min = a.minSwingDeg ?? 10;
      if (swing < min) fails.push(`animated: arm-swing ${swing.toFixed(1)}° < ${min}°`);
    } else if (a.kind === 'moved') {
      const min = a.minDist ?? 50;
      // 3D only when asked AND loc_z is actually carried; otherwise honestly fall back to 2D + note.
      const use3d = a.in3D === true && has3d;
      const d = use3d ? dist3d : dist;
      const note = a.in3D === true && !has3d ? ' (2D — loc_z absent)' : use3d ? ' (3D)' : '';
      if (d < min) fails.push(`moved: displaced ${d.toFixed(0)}${note} < ${min}`);
    } else if (a.kind === 'static') {
      const max = a.maxSwingDeg ?? 5;
      if (swing > max) fails.push(`static: arm-swing ${swing.toFixed(1)}° > ${max}°`);
    } else if (a.kind === 'montage-playing') {
      if (!samples.some((s) => s.montage_playing === true)) fails.push('montage-playing: no montage played in any sample');
    } else if (a.kind === 'attribute-drop') {
      const min = a.minDelta ?? 1;
      const drop = attrDrop(samples, a.name);
      if (drop < min) fails.push(`attribute-drop ${a.name}: Δ${drop.toFixed(1)} < ${min}`);
    } else if (a.kind === 'min-speed') {
      const min = a.minSpeed ?? 50;
      if (peakSpeed < min) fails.push(`min-speed: peak ${peakSpeed.toFixed(0)} < ${min}`);
    } else if (a.kind === 'vertical-displacement') {
      const min = a.minRise ?? 50;
      if (z0 === undefined) fails.push('vertical-displacement: loc_z not observed (cannot measure lift)');
      else if (verticalRise < min) fails.push(`vertical-displacement: rise ${verticalRise.toFixed(0)} < ${min}`);
    } else if (a.kind === 'ability-activated') {
      // A wrong/blind-PascalCased tag that resolved to NOTHING is a distinct, LOUD failure — never
      // the generic "no effect" (which reads identically for a genuinely broken-but-present ability).
      const someFound = samples.some((s) => s.ability_found === true);
      const explicitlyNotFound = !someFound && samples.some((s) => s.ability_found === false);
      const montage = samples.some((s) => s.montage_playing === true);
      const resource = attrDrop(samples, 'health') >= 1 || attrDrop(samples, 'stamina') >= 1 || attrDrop(samples, 'mana') >= 1;
      if (explicitlyNotFound) {
        fails.push(`ability-activated: tag ${a.tag ?? '(derived)'} NOT FOUND on pawn ASC — unresolvable tag (fix the ability tag), not a broken ability`);
      } else if (!montage && !resource) {
        fails.push('ability-activated: no montage and no resource change observed');
      }
    }
  }
  if (fails.length) return { status: 'fail', detail: fails.join('; '), stats };
  const mont = stats.montagePlaying ? ' montage✓' : '';
  return { status: 'pass', detail: `swing=${swing.toFixed(1)}° dist=${dist.toFixed(0)} spd=${peakSpeed.toFixed(0)}${mont} over ${samples.length} samples`, stats };
}

/**
 * Build the scenario-inbox options for a gate scenario — the ONE place the L3 spawn path maps a
 * `GateScenario` onto the shared inbox writer. Forwards `disableAI` (previously dropped on the L3
 * path even when the spec set it) and resolves the spawn-path settle default (1.0). Pure (tested).
 */
export function scenarioInboxFor(scn: GateScenario): ScenarioInboxOptions {
  return {
    totalSeconds: scn.totalSeconds,
    numSamples: scn.numSamples,
    settle: scn.settle ?? 1.0,
    ...(scn.playAnim ? { playAnim: scn.playAnim } : {}),
    ...(scn.disableAI ? { disableAI: true } : {}),
    inputs: scn.inputs,
  };
}

/** Is this a batchable automation job — a symbolic test name with NO behavioural scenario?
 *  (Scenario jobs need distinct per-scenario boot args, so they never batch.) */
function isBatchableAutomation(job: GateJob): boolean {
  return !job.scenario && !!job.testName;
}

/** L3 executor that runs a headless UnrealEditor-Cmd automation pass. Off by default. */
export function makeSpawnExecutor(opts: SpawnExecutorOptions = {}): GateExecutor {
  const editorCmd = opts.editorCmd ?? process.env.POF_UE_EDITOR_CMD;
  const uproject = opts.uproject ?? process.env.POF_UE_UPROJECT;
  const spawnImpl: SpawnFn = opts.spawnImpl ?? spawnAndWait;
  const automationTimeoutMs = opts.automationTimeoutMs ?? 180_000;

  // Verdicts pre-computed by ONE grouped-boot batch (`prepareBatch`), keyed by test name.
  // `run` returns the cached verdict for an automation job instead of booting per test.
  const batchVerdicts = new Map<string, GateVerdict>();

  /**
   * Behavioural scenario path (faithful L3): write the scenario, drive inputs in a real
   * game loop, observe the effect. Watchdog-protected — a hung editor is SIGKILLed.
   */
  async function runScenario(job: GateJob, editor: string, project: string): Promise<GateVerdict> {
    const scn = job.scenario!;
    const outDir = join(tmpdir(), `pof-scn-${Date.now()}-${sanitize(job.step)}`);
    await mkdir(outDir, { recursive: true });
    const outDirFwd = outDir.replace(/\\/g, '/');
    const scnPath = join(outDir, 'scenario.json');
    // The spawn path resolves its own settle default (1.0) before the shared writer, so the
    // spine's capture-oriented default (1.5) never applies here — behaviour is preserved. The
    // mapping (incl. `disableAI` forwarding) lives in the pure `scenarioInboxFor` for unit testing.
    await writeFile(scnPath, buildScenarioInbox(outDirFwd, scenarioInboxFor(scn)));
    const scnLog = join(outDir, 'editor.log');
    const scnArgs = buildScenarioArgs(project, scn.map, scnPath.replace(/\\/g, '/'), scnLog);
    const { timedOut } = await spawnImpl(editor, scnArgs, opts.scenarioTimeoutMs ?? 180_000);
    const obsRaw = await readFile(join(outDir, 'observations.json'), 'utf-8').catch((e) => {
      logger.warn(`[test-gate-runner] ${job.step}: no observations.json (${e instanceof Error ? e.message : String(e)})`);
      return '';
    });
    if (!obsRaw) throw new Error(`no observations.json at ${outDir}${timedOut ? ' (watchdog timeout)' : ''}`);
    const parsedObs = JSON.parse(obsRaw) as Observations;
    const v = parseScenarioVerdict(parsedObs, scn.assert);
    // Evidence: the down-sampled observation rows + the derived stats the verdict was read from.
    const evidence: GateEvidence = {
      kind: 'scenario',
      at: new Date().toISOString(),
      samples: boundSamples(parsedObs.samples ?? []),
      ...(v.stats ? { stats: v.stats } : {}),
    };
    return { status: v.status, detail: `${job.step}: ${v.detail}`, evidence, raw: { outDir, timedOut } };
  }

  /**
   * Automation path (symbolic L3): run one headless `Automation RunTests <name>;Quit` and
   * judge by `-abslog` markers. Shares the same watchdog as the scenario path — a headless
   * editor that never quits is SIGKILLed so the drain worker can't hang indefinitely.
   *
   * This single-boot path is the fallback for a direct `run` call that was NOT preceded by
   * `prepareBatch` (the drain loop always pre-batches, so within a drain every automation
   * job is served from the ONE grouped boot instead).
   */
  async function runAutomation(job: GateJob, editor: string, project: string): Promise<GateVerdict> {
    const abslog = join(tmpdir(), `pof-gate-${Date.now()}-${sanitize(job.testName ?? 'test')}.log`);
    const args = buildAutomationArgs(job.testName!, project, abslog);
    const { timedOut } = await spawnImpl(editor, args, automationTimeoutMs);
    const log = await readFile(abslog, 'utf-8').catch((e) => {
      logger.warn(`[test-gate-runner] ${job.testName}: no abslog (${e instanceof Error ? e.message : String(e)})`);
      return '';
    });
    if (!log) throw new Error(`no abslog produced at ${abslog}${timedOut ? ' (watchdog timeout)' : ''}`);
    const v = parseAbslogVerdict(log);
    // 'unregistered' maps to deferred: the gate stays an honest wait until the test exists.
    const status = v.status === 'unregistered' ? 'deferred' : v.status;
    // Evidence: the abslog marker line that decided the verdict.
    const evidence: GateEvidence = { kind: 'automation', at: new Date().toISOString(), markers: [v.detail] };
    return { status, detail: `${job.testName}: ${v.detail}`, evidence, raw: { abslog, timedOut } };
  }

  return {
    id: 'spawn',
    tier: 'L3',

    async available() {
      return !!(opts.allowSpawn && editorCmd && uproject);
    },

    /**
     * One boot, many gates. Group every batchable automation job in this drain pass into a
     * SINGLE `UnrealEditor-Cmd` boot (`Automation RunTests A+B+C;Quit -ReportOutputPath=…`)
     * and cache the per-test verdict; `run` then returns the cached verdict instead of
     * booting per test. Scenario jobs are left untouched (they need distinct boot args).
     */
    async prepareBatch(jobs: GateJob[]) {
      if (!opts.allowSpawn || !editorCmd || !uproject) return; // gated identically to run/available
      const testNames = [...new Set(jobs.filter(isBatchableAutomation).map((j) => j.testName!))];
      if (testNames.length === 0) return;
      const verdicts = await runBatchAutomation({
        editor: editorCmd,
        uproject,
        testNames,
        spawn: spawnImpl,
        timeoutMs: automationTimeoutMs,
      });
      for (const [name, v] of verdicts) batchVerdicts.set(name, v);
    },

    async run(job: GateJob): Promise<GateVerdict> {
      if (!opts.allowSpawn) throw new Error('spawn executor disabled (pass allowSpawn:true to enable)');
      if (!editorCmd || !uproject) throw new Error('spawn executor needs POF_UE_EDITOR_CMD + POF_UE_UPROJECT');
      if (job.scenario) return runScenario(job, editorCmd, uproject);
      // Batched automation: serve the verdict from the ONE grouped boot when available.
      const cached = job.testName ? batchVerdicts.get(job.testName) : undefined;
      if (cached) return cached;
      // Not pre-batched (direct call) → single-boot fallback.
      return runAutomation(job, editorCmd, uproject);
    },
  };
}

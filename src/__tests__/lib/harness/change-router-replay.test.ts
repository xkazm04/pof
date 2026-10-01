/**
 * OFFLINE REPLAY of the change-class router over recorded harness runs (test T-d of
 * `.ai/directions/2026-10-01-aura-verification-comparison.md`).
 *
 * The four recorded runs (`.harness-ui`, `.harness-content`, `.harness-dzin`,
 * `.harness-dzin-full`) are gitignored, so this suite is OFF unless
 * `POF_HARNESS_RUNS_DIR` names the directory that holds them. It reads only
 * `game-plan.json`, `progress.json` and `guide.json`, writes nothing, and copies
 * nothing into the repo.
 *
 *   POF_HARNESS_RUNS_DIR=<dir holding the .harness-* folders> npx vitest run \
 *     src/__tests__/lib/harness/change-router-replay.test.ts
 *
 * Arms
 *  A  today's run-end coverage lines (`tallyGateVerdicts` + `formatGateCoverageLines`)
 *     fed the recorded reports exactly as `verify()` shapes them today.
 *  B  the router's pre-run answers (`routeChange`) per feature and gate.
 *
 * Truth: a gate "returned a real verdict" for an area when the area's DECIDING
 * iteration (its last `execute` entry) shows PASS or FAIL for it, except a
 * `visual-check` FAIL whose error is "Visual gate failed to run" (nothing was judged).
 * The scored universe is the features the plan marks `pass`, in areas with a deciding
 * iteration, so the same 323-feature population as the 2026-08-30 applied row.
 *
 * Environment inputs the runs did not record are INJECTED and labelled:
 *  - `static-spec`: Playwright's `testDir` is `./e2e`, from `playwright.config.ts` at
 *    commit e3e379fc (2026-04-04, the last change before both runs), and the spec
 *    path is `<run dir>/_visual-gate.spec.ts`. Recovered from repo history, never from
 *    the run's outcome.
 *  - `simulated-down`: `devServer=false`. SIMULATED: nothing recorded says whether
 *    :3000 answered at preflight. Agreement under it is by construction.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tallyGateVerdicts, formatGateCoverageLines, type GateVerdictTally } from '@/lib/harness/orchestrator';
import {
  classifyPaths,
  plannedChangeClasses,
  routeChange,
  visualSpecDiscoverable,
  type ChangeClass,
  type RouterEnv,
} from '@/lib/harness/change-router';
import type { GamePlan, ProgressEntry, VerificationGate, GameBuildGuide } from '@/lib/harness/types';

const RUNS_DIR = process.env.POF_HARNESS_RUNS_DIR;
const RUNS = ['.harness-ui', '.harness-content', '.harness-dzin', '.harness-dzin-full'] as const;
const PLAYWRIGHT_CONFIG_AT_RUN_TIME = "export default defineConfig({ testDir: './e2e' });";

type Truth = 'pass' | 'fail' | 'none';

const TYPE_BY_NAME: Record<string, VerificationGate['type']> = {
  typecheck: 'typecheck', lint: 'lint', test: 'test', build: 'build', 'visual-check': 'visual',
};
const gateOf = (name: string): VerificationGate => ({
  name,
  type: TYPE_BY_NAME[name] ?? 'custom',
  required: name === 'build' || name === 'typecheck',
  command: name === 'visual-check' ? undefined : 'recorded',
});

interface Cell { can: number; cannot: number; unknown: number; tp: number; fp: number }

interface Replayed {
  run: string;
  gates: VerificationGate[];
  scored: number;
  unscored: number;
  perGate: Record<string, { real: number; none: number; byEnv: Record<string, Cell> }>;
  any: Record<string, { cannot: number; falsified: number }>;
  aLines: string[];
  aLinesIfUnverifiable: string[];
  plannedCoverage: number;
  pathCoverage: number;
}

function read<T>(run: string, file: string): T {
  return JSON.parse(fs.readFileSync(path.join(RUNS_DIR!, run, file), 'utf-8')) as T;
}

function replay(run: string): Replayed {
  const plan = read<GamePlan>(run, 'game-plan.json');
  const progress = read<ProgressEntry[]>(run, 'progress.json');
  const guide = read<GameBuildGuide>(run, 'guide.json');
  const stepPaths = new Map(guide.steps.map((s) => [s.areaId, s.ue5Files ?? []]));

  const gateLine = /^\s+(PASS|FAIL)\s+([\w-]+)\s+\[/gm;
  const verdictsOf = (e: ProgressEntry): Record<string, Truth> | null => {
    const lines = [...(e.summary ?? '').matchAll(gateLine)];
    if (lines.length === 0) return null;
    const failedToRun = /Visual gate failed to run/.test((e.errors ?? []).join('\n'));
    return Object.fromEntries(lines.map((m) => {
      const [, outcome, name] = m;
      if (name === 'visual-check' && failedToRun) return [name, 'none' as Truth];
      return [name, (outcome === 'PASS' ? 'pass' : 'fail') as Truth];
    }));
  };

  const executes = progress.filter((e) => e.action === 'execute');
  const deciding = new Map<string, ProgressEntry>();
  for (const e of executes) deciding.set(e.areaId, e);

  // Gate set = every gate name any recorded report lists, in first-seen order.
  const names: string[] = [];
  for (const e of executes) for (const k of Object.keys(verdictsOf(e) ?? {})) if (!names.includes(k)) names.push(k);
  const gates = names.map(gateOf);

  // ── Arm A: today's run-end coverage, reports shaped as verify() shapes them today.
  const tally: Record<string, GateVerdictTally> = {};
  const tallyIfUnv: Record<string, GateVerdictTally> = {};
  for (const e of executes) {
    const v = verdictsOf(e);
    if (!v) continue;
    const report = (unv: boolean) => ({
      gates: Object.entries(v).map(([gate, t]) => ({
        gate, passed: t === 'pass', output: '', durationMs: 0,
        // verify() sets `unverifiable` for no gate that ran Playwright: a "failed to run" is just passed:false.
        ...(unv && t === 'none' ? { unverifiable: true } : {}),
      })),
    });
    tallyGateVerdicts(tally, report(false));
    tallyGateVerdicts(tallyIfUnv, report(true));
  }

  // ── Arm B per feature.
  const projectPath = '/proj';
  const statePath = `${projectPath}/${run}`;
  const specOk = visualSpecDiscoverable(PLAYWRIGHT_CONFIG_AT_RUN_TIME, projectPath, statePath);
  const envs: Record<string, RouterEnv> = {
    unprobed: { hasUeEnv: false },
    'static-spec': { hasUeEnv: false, visualSpecDiscoverable: specOk },
    'simulated-down': { hasUeEnv: false, visualSpecDiscoverable: specOk, devServer: false },
  };

  const out: Replayed = {
    run, gates, scored: 0, unscored: 0, perGate: {}, any: {}, aLines: [], aLinesIfUnverifiable: [],
    plannedCoverage: 0, pathCoverage: 0,
  };
  for (const g of gates) out.perGate[g.name] = { real: 0, none: 0, byEnv: {} };

  for (const area of plan.areas) {
    if (area.status !== 'completed') continue;
    const passing = area.features.filter((f) => f.status === 'pass').length;
    const e = deciding.get(area.id);
    const truth = e ? verdictsOf(e) : null;
    if (!truth) { out.unscored += passing; continue; }
    out.scored += passing;

    const actual = classifyPaths(stepPaths.get(area.id) ?? []);
    const planned = plannedChangeClasses(area);
    if (actual.length > 0) out.pathCoverage += passing;
    if (planned.length > 0) out.plannedCoverage += passing;

    const sources: Record<string, ChangeClass[]> = { actual, planned };
    for (const [envName, env] of Object.entries(envs)) {
      for (const [srcName, classes] of Object.entries(sources)) {
        const key = `${envName}/${srcName}`;
        const routing = routeChange(classes, gates, env);
        const anyVerdict = Object.values(truth).some((t) => t !== 'none');
        const slot = (out.any[key] ??= { cannot: 0, falsified: 0 });
        if (routing.anyGate === 'cannot') {
          slot.cannot += passing;
          if (anyVerdict) slot.falsified += passing;
        }
        for (const r of routing.gates) {
          const t = truth[r.gate];
          const pg = out.perGate[r.gate];
          const c = (pg.byEnv[key] ??= { can: 0, cannot: 0, unknown: 0, tp: 0, fp: 0 });
          c[r.answer] += passing;
          if (r.answer === 'cannot') { if (t === 'none') c.tp += passing; else c.fp += passing; }
        }
      }
    }
    for (const g of gates) {
      const t = truth[g.name];
      if (t === 'none') out.perGate[g.name].none += passing; else if (t) out.perGate[g.name].real += passing;
    }
  }

  out.aLines = formatGateCoverageLines(tally, gates);
  out.aLinesIfUnverifiable = formatGateCoverageLines(tallyIfUnv, gates);
  return out;
}

describe.skipIf(!RUNS_DIR)('change-class router: offline replay over the recorded harness runs', () => {
  // Lazy: a skipped describe still runs its body at collection, and the runs may be absent.
  let cached: Replayed[] | null = null;
  const getResults = (): Replayed[] => (cached ??= RUNS.map((r) => replay(r)));

  it('prints the paired numbers', () => {
    const results = getResults();
    const rows: string[] = [];
    for (const r of results) {
      rows.push(`\n=== ${r.run}: scored ${r.scored} pass-features (unscored, no deciding iteration: ${r.unscored}); `
        + `with recorded changed paths ${r.pathCoverage}, with a path in the plan text ${r.plannedCoverage}`);
      rows.push(`  A (today)            : ${r.aLines.join(' || ')}`);
      rows.push(`  A (if unverifiable)  : ${r.aLinesIfUnverifiable.filter((l) => l.includes('NO verdict')).join(' || ') || '(no gate flagged)'}`);
      for (const [gate, pg] of Object.entries(r.perGate)) {
        rows.push(`  gate ${gate}: real verdict ${pg.real}, none ${pg.none}`);
        for (const [key, c] of Object.entries(pg.byEnv)) {
          rows.push(`    B ${key.padEnd(28)} can ${c.can} / cannot ${c.cannot} / unknown ${c.unknown}`
            + `   agree(cannot AND no verdict)=${c.tp}   FALSIFIED(cannot BUT verdict)=${c.fp}`);
        }
      }
      for (const [key, v] of Object.entries(r.any)) rows.push(`  ANY-gate ${key.padEnd(30)} cannot ${v.cannot}, of which falsified ${v.falsified}`);
    }
    // eslint-disable-next-line no-console
    console.log(rows.join('\n'));
    expect(results.length).toBe(4);
  });

  it('falsifier: B never marks cannot a feature that received a real verdict (any env, any class source)', () => {
    for (const r of getResults()) {
      for (const pg of Object.values(r.perGate)) {
        for (const c of Object.values(pg.byEnv)) expect(c.fp).toBe(0);
      }
      for (const v of Object.values(r.any)) expect(v.falsified).toBe(0);
    }
  });

  it('floor: the replay reads the recorded runs without writing (inputs unchanged)', () => {
    const snapshot = () => RUNS.flatMap((run) => ['game-plan.json', 'progress.json', 'guide.json'].map((f) => {
      const st = fs.statSync(path.join(RUNS_DIR!, run, f));
      return `${run}/${f}:${st.size}:${st.mtimeMs}`;
    }));
    const before = snapshot();
    cached = null; // force a fresh replay between the two snapshots
    getResults();
    expect(snapshot()).toEqual(before);
    expect(before).toHaveLength(12);
  });
});

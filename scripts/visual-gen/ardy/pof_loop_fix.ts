/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Loop fix — a Tier-1 loop fail offers its proven fix: a seam-pinned re-take, same seed.
 *
 * Measures the clip in-process (Tier-1 loop closure), routes the failing axis through the
 * remedy map (`@/lib/motion-gate/loopRemedy`) and prints the plan plus the exact commands.
 * Only `--run` executes: ARDY preflight, then at most 2 attempts, each writing a NEW
 * `<stem>_loopfix_aN.npz` (the original is never touched), then the attempts table and the
 * best attempt at its TRUE verdict. ARDY is the local GPU model — nothing here bills.
 *
 *   npx tsx scripts/visual-gen/ardy/pof_loop_fix.ts --npz C:/m/walk.npz --prompt "a person walks forward" --seed 1
 *   npx tsx scripts/visual-gen/ardy/pof_loop_fix.ts --npz C:/m/walk.npz --prompt "..." --seed 1 --run
 *
 * Constraint step alone (what the plan prints; local, no model):
 *   npx tsx scripts/visual-gen/ardy/pof_loop_fix.ts C:/m/walk.npz C:/m/walk_loopfix_a1.constraints.json --pin 0,79 --velocity 78
 *
 * Prints human-readable lines only — no POF_* marker protocol.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { measureClip, scoreLoopClosure } from '@/lib/motion-gate';
import { buildSeamConstraints, parseSeamConstraintArgs } from '@/lib/motion-gate/seamConstraints';
import { runLoopFix, type LoopFixAttempt } from '@/lib/motion-gate/loopFixRun';

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

function fail(message: string): never {
  console.error(`loop-fix: ${message}`);
  process.exit(1);
}

function writeConstraintsOnly(): void {
  const parsed = parseSeamConstraintArgs(argv);
  if (!parsed.ok) fail(parsed.error);
  const { npzPath, outPath, pins } = parsed.data;
  const built = buildSeamConstraints(readFileSync(npzPath), pins);
  if (!built.ok) fail(built.error);
  writeFileSync(outPath, JSON.stringify(built.data));
  console.log(`wrote ${outPath} (pins ${pins.fullbody.join(',')} + velocity ${pins.velocity.join(',') || 'none'})`);
}

const row = (a: LoopFixAttempt): string => {
  const m = a.card?.metrics;
  const axes = m ? `poseGap ${m.poseGapMm.toFixed(2)}  worstJoint ${m.worstJointMm.toFixed(2)}  velJump ${m.velJumpMm.toFixed(2)} mm` : '';
  return `  a${a.n}  ${a.state.padEnd(8)} ${(a.verdict ?? '-').padEnd(5)} ${axes}${a.error ? `  (${a.error})` : ''}`;
};

async function fix(npzPath: string): Promise<void> {
  const prompt = flag('--prompt') ?? '';
  const seedText = flag('--seed');
  const seed = seedText === undefined ? undefined : Number(seedText);
  if (seed !== undefined && !Number.isInteger(seed)) fail(`--seed must be an integer, got ${seedText}`);

  const measured = measureClip(readFileSync(npzPath), { path: npzPath });
  if (!measured.ok) fail(`Tier-1 could not measure ${npzPath}: ${measured.error}`);
  const { metrics, source } = measured.data;
  const card = scoreLoopClosure(metrics, argv.includes('--oneshot') ? 'oneshot' : 'loop');
  console.log(`Tier-1: ${card.verdict} — ${card.reason}  [${source.frames} frames, sha256 ${source.sha256.slice(0, 12)}]`);

  const durationSec = source.fps ? source.frames / source.fps : undefined;
  const run = argv.includes('--run');
  const attemptsText = flag('--attempts');
  const r = await runLoopFix({
    npzPath, prompt, seed, frames: source.frames, card, durationSec, dryRun: !run,
    ...(attemptsText ? { maxAttempts: Number(attemptsText) } : {}),
    ...(flag('--ardy-root') ? { ardy: { ardyRoot: flag('--ardy-root') } } : {}),
  });
  if (!r.ok) {
    console.log(r.error);
    process.exit(r.plan?.remedy === 'none' ? 0 : 1);
  }
  console.log(r.plan.reason);
  if (r.plan.unaddressed.length > 0) console.log(`unaddressed: ${r.plan.unaddressed.join(', ')}`);
  if (r.dryRun) {
    r.argv?.forEach((a, i) => {
      console.log(`attempt ${i + 1}${i > 0 ? ' (only if attempt 1 does not pass)' : ''}:`);
      console.log(`  npx tsx ${a.constraints.map((s) => JSON.stringify(s)).join(' ')}`);
      console.log(`  <ardy venv python> ${a.ardy.map((s) => JSON.stringify(s)).join(' ')}`);
    });
    console.log('preview only — add --run to regenerate (local ARDY, GPU, no billing).');
    return;
  }
  r.attempts.forEach((a) => console.log(row(a)));
  console.log(r.best
    ? `best: a${r.best.n} ${r.best.npzPath} — ${r.outcome}, ${r.verdict}`
    : `outcome: ${r.outcome} — no attempt could be measured`);
}

const npz = flag('--npz');
if (npz) {
  fix(npz).catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
} else if (argv.filter((a) => !a.startsWith('--')).length >= 2) {
  writeConstraintsOnly();
} else {
  fail('usage: --npz <clip.npz> --prompt "<original prompt>" --seed <n> [--run]  |  <clip.npz> <out.json> --pin 0,T-1 [--velocity T-2]');
}

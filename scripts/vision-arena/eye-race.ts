/* eslint-disable no-console -- this is a CLI harness; stdout is its interface. */
/**
 * VISION ARENA — the EYE axis. Which provider should serve `recognize`?
 *
 * This is the run that turns the plan's first entry from a PERMISSION into a MEASUREMENT.
 * `router.ts`'s PLAN puts the local eye first as operator policy; policy does not need a
 * benchmark to be legitimate, but the claim that the local eye CAN serve a use case does.
 *
 * Protocol, and the reason for each rule (registry `arena-benchmark-protocol` +
 * `extraction-model-bake-off`):
 *  · ONE prompt, every arm — `CHECK_PROMPTS`, the same string the route sends. An arm handed
 *    a friendlier question measures prompt luck.
 *  · Scored against a TRUTH SET WE OWN, hand-labelled by eye — never against another model's
 *    answers. "The reference model is not ground truth": ranking by agreement with the
 *    incumbent ranks challengers by how well they imitate its errors.
 *  · The truth set MUST contain a true-FAIL case. A set of only passes cannot tell a working
 *    eye from one that always says pass, and every error this class of gate makes in practice
 *    is a false PASS (a false fail is loud and cheap; a false pass ships a broken build).
 *  · DETERMINISM is its own axis, measured by repeats at temperature 0 — at corpus scale a
 *    reproducible-and-biased eye beats an accurate-and-noisy one, because a systematic error
 *    is one correction and drift is irreducible noise.
 *  · STRUCTURAL faults disqualify: unparseable output or a missing field means the eye is
 *    unusable as a gate however good its judgement.
 *  · Systems cost (ms/frame) is reported beside quality, because the winning criterion is
 *    frequently a systems constraint. On this machine that is not hypothetical: with the UE
 *    editor open the local eye ran 42-118 s/frame; with it closed, 4.4-7.2 s.
 *  · Pins nothing, writes nothing production reads. Promoting a winner is a person's edit.
 *
 *   npx tsx scripts/vision-arena/eye-race.ts --truth <truth.json> [--repeats 2] [--arms ollama,gemini]
 *
 * truth.json: [{ "frame": "<abs path>", "mode": "character|lighting|hud|texture",
 *                "expect": { "<field>": <value>, ... }, "why": "<why a human says so>" }]
 */
import { readFileSync } from 'node:fs';
import { recognize } from '@/lib/vision/router';
import { CHECK_PROMPTS, type CheckMode } from '@/lib/vision/check-prompts';
import { defaultProviders } from '@/lib/vision/providers';
import type { VisionProviderId } from '@/lib/vision/types';

interface TruthCase { frame: string; mode: CheckMode; expect: Record<string, unknown>; why?: string }

function arg(name: string, fallback = ''): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

interface Outcome {
  arm: VisionProviderId; caseIdx: number; ms: number;
  parsed?: Record<string, unknown>; structuralFault?: string; model?: string;
}

/** Did the answer match every field the human labelled? Fields not in `expect` are ignored —
 *  a truth set padded with judgement calls stops measuring truth. */
function scoreTruth(parsed: Record<string, unknown> | undefined, expect: Record<string, unknown>): boolean | null {
  if (!parsed) return null;
  return Object.entries(expect).every(([k, v]) => parsed[k] === v);
}

async function main(): Promise<number> {
  const truthPath = arg('truth');
  if (!truthPath) { console.error('--truth <truth.json> is required'); return 2; }
  const cases = JSON.parse(readFileSync(truthPath, 'utf8')) as TruthCase[];
  const repeats = Number(arg('repeats', '2'));
  const providers = defaultProviders();
  const arms = (arg('arms', providers.map((p) => p.id).join(',')).split(',') as VisionProviderId[])
    .filter((id) => providers.some((p) => p.id === id && p.isConfigured()));

  console.log('ARENA — the eye axis');
  console.log(`  truth set  ${cases.length} case(s), hand-labelled; ${cases.filter((c) => Object.values(c.expect).includes(false)).length} negative control(s)`);
  console.log(`  arms       ${arms.join(', ')}`);
  console.log(`  repeats    ${repeats}  =>  ${cases.length * arms.length * repeats} calls (local arm bills nothing)\n`);

  const out: Outcome[] = [];
  for (const arm of arms) {
    for (let c = 0; c < cases.length; c++) {
      const tc = cases[c];
      const b64 = readFileSync(tc.frame).toString('base64');
      for (let r = 0; r < repeats; r++) {
        const t0 = Date.now();
        try {
          const res = await recognize(
            { images: [{ base64: b64, mime: 'image/png' }], prompt: CHECK_PROMPTS[tc.mode] },
            { providers, plan: [arm] },
          );
          let parsed: Record<string, unknown> | undefined;
          try { parsed = JSON.parse(res.text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()); } catch { /* structural fault */ }
          const missing = parsed ? Object.keys(tc.expect).filter((k) => !(k in parsed!)) : [];
          out.push({
            arm, caseIdx: c, ms: Date.now() - t0, model: res.model,
            ...(parsed ? { parsed } : {}),
            ...(!parsed ? { structuralFault: 'unparseable' } : missing.length ? { structuralFault: `missing ${missing.join(',')}` } : {}),
          });
        } catch (e) {
          out.push({ arm, caseIdx: c, ms: Date.now() - t0, structuralFault: e instanceof Error ? e.message.slice(0, 60) : 'error' });
        }
      }
    }
  }

  console.log('  arm         model                  truth      falsePASS  falseFAIL  structural  determinism  ms/frame');
  for (const arm of arms) {
    const mine = out.filter((o) => o.arm === arm);
    let correct = 0, scored = 0, falsePass = 0, falseFail = 0;
    for (const o of mine) {
      const tc = cases[o.caseIdx];
      const s = scoreTruth(o.parsed, tc.expect);
      if (s === null) continue;
      scored++; if (s) correct++;
      // The two error directions are NOT symmetric and must never be pooled. A false PASS
      // ships a broken build — it is the error this whole class of gate exists to prevent,
      // and the one that is silent. A false FAIL is loud, cheap, and costs a re-run. Read off
      // the `verdict` field, which is the gate's actual output; an off-verdict field mismatch
      // is a truth miss but not necessarily either kind of gate error.
      if (!s && typeof tc.expect.verdict === 'string' && typeof o.parsed?.verdict === 'string') {
        if (tc.expect.verdict === 'fail' && o.parsed.verdict === 'pass') falsePass++;
        if (tc.expect.verdict === 'pass' && o.parsed.verdict === 'fail') falseFail++;
      }
    }
    const faults = mine.filter((o) => o.structuralFault).length;
    let stable = 0, groups = 0;
    for (let c = 0; c < cases.length; c++) {
      const sigs = mine.filter((o) => o.caseIdx === c).map((o) => JSON.stringify(Object.keys(cases[c].expect).map((k) => o.parsed?.[k])));
      if (sigs.length) { groups++; if (new Set(sigs).size === 1) stable++; }
    }
    const avgMs = Math.round(mine.reduce((n, o) => n + o.ms, 0) / Math.max(mine.length, 1));
    console.log(
      `  ${arm.padEnd(11)} ${String(mine.find((o) => o.model)?.model ?? '-').padEnd(22)} `
      + `${(scored ? `${correct}/${scored}` : '-').padEnd(10)} ${String(falsePass).padEnd(10)} ${String(falseFail).padEnd(10)} `
      + `${String(faults).padEnd(11)} ${`${stable}/${groups}`.padEnd(12)} ${String(avgMs).padStart(8)}`,
    );
  }

  console.log('\n  PER-CASE (truth vs each arm):');
  for (let c = 0; c < cases.length; c++) {
    const tc = cases[c];
    console.log(`  [${c}] ${tc.mode.padEnd(10)} expect ${JSON.stringify(tc.expect)}${tc.why ? `  — ${tc.why}` : ''}`);
    for (const arm of arms) {
      const first = out.find((o) => o.arm === arm && o.caseIdx === c);
      const got = first?.parsed ? JSON.stringify(Object.fromEntries(Object.keys(tc.expect).map((k) => [k, first.parsed![k]]))) : `FAULT(${first?.structuralFault})`;
      const ok = scoreTruth(first?.parsed, tc.expect);
      console.log(`      ${arm.padEnd(11)} ${ok === null ? '  ?' : ok ? '  OK' : ' MISS'}  ${got}`);
    }
  }
  console.log('\n  This harness pins nothing. Promoting an eye is a separate, reviewed edit.');
  return 0;
}

main().then((c) => process.exit(c));

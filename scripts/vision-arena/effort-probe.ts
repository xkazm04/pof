/* eslint-disable no-console -- this is a CLI harness; stdout is its interface. */
/**
 * VISION ARENA — the effort axis.
 *
 * Answers ONE question with numbers: does making the eye think harder buy a better answer,
 * and by how much? The operator's standing rule is that if high thinking genuinely produces
 * a better analysis it is worth paying for — which is a claim to MEASURE, not to assume in
 * either direction.
 *
 * Protocol (registry `arena-benchmark-protocol`), and why each rule is here:
 *  · ONE prompt for every arm — imported from `@/lib/vision/check-prompts`, the same string
 *    the route sends. An arm handed a friendlier question measures prompt luck.
 *  · A FIXED task set — real captured frames, including the hard ones. A dark arena shot is
 *    the interesting case precisely because "dim but lit" vs "black, unlit failure" is a
 *    genuine judgement call rather than a lookup.
 *  · DETERMINISM as a first-class axis, not a tiebreaker — each arm runs N times and the
 *    closed-vocabulary fields are compared. `extraction-model-bake-off`: at corpus scale a
 *    reproducible-and-biased model beats an accurate-and-noisy one, because a systematic
 *    error is one correction and drift is irreducible noise.
 *  · SYSTEMS COST alongside quality — thought tokens and latency per item, reported per arm.
 *  · It DECLARES ITS SPEND before running and has a rehearsal mode; a benchmark whose cost is
 *    discovered from the invoice does not get re-run, which defeats its purpose.
 *  · It WRITES NOTHING production reads and pins nothing. It prints a comparison; promoting a
 *    winner is a separate, reviewed edit by a person. A harness that adopts its own winner is
 *    a gate certifying itself.
 *
 *   npx tsx scripts/vision-arena/effort-probe.ts --frame <png> --mode character [--repeats 3]
 *   npx tsx scripts/vision-arena/effort-probe.ts --frame <png> --mode lighting --dry
 */
import { readFileSync } from 'node:fs';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { CHECK_PROMPTS, type CheckMode } from '@/lib/vision/check-prompts';
import { EFFORT_ORDER, type VisionEffort } from '@/lib/vision/types';

const LEVELS: Record<VisionEffort, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : (fallback ?? '');
}

interface Run {
  level: VisionEffort;
  ok: boolean;
  raw: string;
  parsed?: Record<string, unknown>;
  thoughtTokens: number;
  outTokens: number;
  ms: number;
  error?: string;
}

/** The closed-vocabulary fields of a verdict — what determinism is measured over. */
function closedFields(v: Record<string, unknown> | undefined): string {
  if (!v) return '<unparsed>';
  const keys = Object.keys(v).filter((k) => typeof v[k] === 'boolean' || k === 'verdict').sort();
  return keys.map((k) => `${k}=${String(v[k])}`).join(' ');
}

async function main(): Promise<number> {
  const framePath = arg('frame');
  const mode = (arg('mode', 'character') as CheckMode);
  const model = arg('model', 'gemini-3.8-flash');
  const repeats = Number(arg('repeats', '3'));
  const dry = process.argv.includes('--dry');
  if (!framePath) { console.error('--frame <png> is required'); return 2; }
  if (!CHECK_PROMPTS[mode]) { console.error(`--mode must be one of ${Object.keys(CHECK_PROMPTS).join(' | ')}`); return 2; }

  const calls = EFFORT_ORDER.length * repeats;
  console.log(`ARENA — effort axis`);
  console.log(`  frame   ${framePath}`);
  console.log(`  mode    ${mode}   (prompt: the route's own, ${CHECK_PROMPTS[mode].length} chars)`);
  console.log(`  model   ${model}`);
  console.log(`  arms    ${EFFORT_ORDER.join(', ')} x ${repeats} repeats = ${calls} billed calls`);
  if (dry) { console.log('\n  --dry: traversal only, nothing dispatched.'); return 0; }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) { console.error('GEMINI_API_KEY not set'); return 2; }
  const client = new GoogleGenAI({ apiKey });
  const b64 = readFileSync(framePath).toString('base64');

  const runs: Run[] = [];
  for (const level of EFFORT_ORDER) {
    for (let i = 0; i < repeats; i++) {
      const t0 = Date.now();
      try {
        const res = await client.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: 'image/png', data: b64 } },
            { text: CHECK_PROMPTS[mode] },
          ] }],
          config: {
            temperature: 0, // determinism is an axis; temperature must not be the noise source
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: LEVELS[level] },
          },
        });
        const text = res.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
        const u = res.usageMetadata ?? {};
        let parsed: Record<string, unknown> | undefined;
        try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()); } catch { /* unparsed is a finding */ }
        runs.push({
          level, ok: true, raw: text, ...(parsed ? { parsed } : {}),
          thoughtTokens: u.thoughtsTokenCount ?? 0,
          outTokens: u.candidatesTokenCount ?? 0,
          ms: Date.now() - t0,
        });
      } catch (e) {
        runs.push({ level, ok: false, raw: '', thoughtTokens: 0, outTokens: 0, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  console.log(`\n  level   verdicts (${repeats} runs)                          determinism  thoughtTok  ms/item`);
  for (const level of EFFORT_ORDER) {
    const mine = runs.filter((r) => r.level === level);
    const sigs = mine.map((r) => closedFields(r.parsed));
    const stable = new Set(sigs).size === 1;
    const avgThought = Math.round(mine.reduce((n, r) => n + r.thoughtTokens, 0) / Math.max(mine.length, 1));
    const avgMs = Math.round(mine.reduce((n, r) => n + r.ms, 0) / Math.max(mine.length, 1));
    const structFail = mine.filter((r) => !r.parsed).length;
    console.log(
      `  ${level.padEnd(7)} ${(sigs[0] ?? '-').slice(0, 46).padEnd(46)}  ${(stable ? 'STABLE' : 'DRIFT ').padEnd(11)}  ${String(avgThought).padStart(9)}  ${String(avgMs).padStart(7)}`
      + (structFail ? `   [${structFail} unparseable]` : ''),
    );
    if (!stable) for (const s of new Set(sigs)) console.log(`            variant: ${s}`);
  }

  console.log('\n  NOTES (verbatim, one per level — the qualitative half):');
  for (const level of EFFORT_ORDER) {
    const first = runs.find((r) => r.level === level && r.parsed);
    console.log(`  ${level.padEnd(7)} ${String(first?.parsed?.notes ?? first?.error ?? '(none)').slice(0, 300)}`);
  }
  console.log('\n  This harness pins nothing. Promoting a level is a separate, reviewed edit.');
  return 0;
}

main().then((c) => process.exit(c));

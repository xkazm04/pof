/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Neutral capability benchmark (/status Phase 2). Where model-benchmark.ts (WS3) proves which
 * (model, effort) wins per task, THIS harness proves the whole TECHNIQUE STACK (quality prompt
 * pack + engine + policy model) can produce shippable work for ANY game project — by running it
 * on CANON-FREE neutral briefs (scripts/capability-bench/briefs.json, invented world 'Emberfall')
 * and scoring each with the strict rubric WITHOUT canonContext/siblingContext, median-of-3,
 * SEQUENTIAL. Scores answer "can this stack ship X for any project", not "did it fit PoF canon".
 *
 * Reuses model-benchmark's shape: spawn the Claude CLI at the model-policy model/effort for produce
 * and judge (foreground, capture stdout). Text/graph produce via qualityPack(cls) + `claude`; 2D/
 * ui-glyph produce via POST /api/leonardo (mode image) with applyStyleDna:false DELIBERATELY
 * (neutral != project style — noted in the row). Results append to src/lib/status/capability-
 * benchmarks.json; capabilityModel grades a class from its benchmark median when rows exist.
 *
 * SPEND GUARD: <= 6 Leonardo generations total, NO Tripo / ElevenLabs. A credit error stops that
 * class and records 'benchmark-unavailable: credits' — never a fabricated score.
 *
 *   npx tsx scripts/capability-benchmark.ts --dry                 # plan only, no spend
 *   npx tsx scripts/capability-benchmark.ts                       # run all un-recorded briefs
 *   npx tsx scripts/capability-benchmark.ts --class text-config   # one class
 *   npx tsx scripts/capability-benchmark.ts --force               # re-run even recorded briefs
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualityPack } from '../src/lib/prompts/quality';
import { buildRubricPrompt, parseJudgeResult, RUBRIC_VERSION } from '../src/lib/judge/rubrics';
import type { DeliverableClass } from '../src/lib/judge/dimensions';
import { getModelPolicy, MODEL_IDS, type ClaudeModel, type Effort } from '../src/lib/model-policy';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIEFS_PATH = join(HERE, 'capability-bench', 'briefs.json');
const RESULTS_PATH = join(HERE, '..', 'src', 'lib', 'status', 'capability-benchmarks.json');
const ORIGIN = process.env.POF_BENCH_ORIGIN ?? 'http://localhost:3001';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (k: string) => process.argv.includes(`--${k}`);
const DRY = has('dry');
const FORCE = has('force');
const CLASS_FILTER = arg('class');
/** Judge draws per brief; the MEDIAN is recorded (never the max — best-of-N inflates borderline). */
const MEDIAN = 3;
/** Hard spend ceiling — the harness stops issuing Leonardo generations past this. */
const MAX_LEONARDO = 6;

type Brief = { id: string; class: string; title: string; brief: string };
type Result = {
  class: string;
  briefId: string | null;
  score: number | null;
  draws?: number[];
  model?: string;
  effort?: string;
  engine?: string;
  styleDna?: boolean;
  deferred?: boolean;
  note?: string;
};

/** Deterministic class order for the stored file (benchmarkable first, then deferred). */
const CLASS_ORDER = ['text-config', 'graph-data', '2d-art', 'ui-glyph', '3d-mesh', 'animation', 'audio', 'vfx-particles', 'ue-runtime'];

/** Classes not neutral-benchmarkable this phase — honest notes, no fabricated scores. */
const DEFERRED: Result[] = [
  { class: '3d-mesh', briefId: null, score: null, deferred: true, note: 'deferred: Tripo credit spend not authorized this phase.' },
  { class: 'audio', briefId: null, score: null, deferred: true, note: 'no automated judge class — human review required.' },
  { class: 'vfx-particles', briefId: null, score: null, deferred: true, note: 'no generation engine wired.' },
  { class: 'ue-runtime', briefId: null, score: null, deferred: true, note: 'gate-proven class — neutral benchmark n/a, graded by live L3/L4 gates.' },
  { class: 'animation', briefId: null, score: null, deferred: true, note: 'gate-proven class — neutral benchmark n/a, graded by live L3/L4 gates.' },
];

/** The rubric/pack class a benchmark class is produced+judged under. graph-data has no dedicated
 *  rubric, so its structured JSON is produced and judged under the text-config contract (its
 *  dimensions — coherence/specificity/completeness/plausibility — are exactly what a graph needs). */
function rubricClassOf(cls: string): DeliverableClass {
  if (cls === '2d-art') return '2d-art';
  if (cls === 'ui-glyph') return 'ui-glyph';
  return 'text-config'; // text-config + graph-data
}

const isImageClass = (cls: string) => cls === '2d-art' || cls === 'ui-glyph';

function runClaude(prompt: string, model: string, effort: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-p', '-', '--model', model, '--effort', effort, '--output-format', 'text', '--dangerously-skip-permissions'];
    const child = spawn('claude', args, { shell: true });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 || out ? resolve(out) : reject(new Error(`claude exit ${code}: ${err.slice(0, 300)}`))));
    child.stdin.write(prompt); child.stdin.end();
  });
}

/** Median of numbers (odd or even count), matching the judge harness convention. */
function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Sequential median-of-N strict judge over a prepared payload. CANON-FREE (no canon/sibling). */
async function judge(cls: DeliverableClass, subject: string, payload: string, judgePol: { model: string; effort: string }): Promise<number[]> {
  const prompt = buildRubricPrompt(cls, { subject, payload }); // no canonContext / siblingContext = canon-free
  const draws: number[] = [];
  for (let i = 0; i < MEDIAN; i++) {
    const res = parseJudgeResult(await runClaude(prompt, judgePol.model, judgePol.effort));
    if (res) draws.push(res.score);
  }
  return draws;
}

/** Produce + judge one TEXT/GRAPH brief. Returns a scored Result (or a note row on failure). */
async function benchText(brief: Brief, producePol: { model: string; effort: string }, judgePol: { model: string; effort: string }): Promise<Result> {
  const cls = rubricClassOf(brief.class);
  const producePrompt = [
    qualityPack(cls, 'emberfall-neutral-benchmark'),
    ``,
    `NEUTRAL BRIEF (no project canon applies — author it as shippable for a generic grim-fantasy ARPG):`,
    brief.brief,
    ``,
    `Produce the deliverable. Respond with ONLY a single JSON object containing every field a real implementation would need — no prose, no code fence.`,
  ].join('\n');
  const text = (await runClaude(producePrompt, producePol.model, producePol.effort)).trim();
  if (!text) return { class: brief.class, briefId: brief.id, score: null, note: 'benchmark-unavailable: empty produce output.' };
  const subject = `Emberfall :: ${brief.title} (neutral benchmark — no project canon)`;
  const payload = '```json\n' + text.slice(0, 60000) + '\n```';
  const draws = await judge(cls, subject, payload, judgePol);
  const score = median(draws);
  return {
    class: brief.class, briefId: brief.id, score,
    ...(draws.length ? { draws } : {}),
    model: producePol.model, effort: producePol.effort, engine: 'Claude',
    ...(score === null ? { note: 'benchmark-unavailable: no parseable verdict.' } : {}),
  };
}

/** Produce + judge one IMAGE brief. Authors a Leonardo prompt via the quality pack (the technique
 *  under test), generates ONE image with applyStyleDna:false, saves it, judges median-of-3 by Read.
 *  Honors the Leonardo spend guard; a credit error records 'benchmark-unavailable: credits'. */
async function benchImage(brief: Brief, promptPol: { model: string; effort: string }, judgePol: { model: string; effort: string }, tmpDir: string, leoUsed: { n: number }): Promise<Result> {
  const cls = rubricClassOf(brief.class);
  if (leoUsed.n >= MAX_LEONARDO) {
    return { class: brief.class, briefId: brief.id, score: null, engine: 'Leonardo', styleDna: false, note: `benchmark-unavailable: Leonardo spend guard (${MAX_LEONARDO}) reached.` };
  }
  // Author an image-generation prompt from the brief via the quality pack (produce-2d technique).
  const authorPrompt = [
    qualityPack(cls, 'emberfall-neutral-benchmark'),
    ``,
    `NEUTRAL BRIEF (no project canon applies): ${brief.brief}`,
    ``,
    `Write ONE concise text-to-image generation prompt (a single line, under 900 characters) that would make an image model render this at the professional bar above. Respond with ONLY the prompt text — no preamble, no quotes, no code fence.`,
  ].join('\n');
  const imgPrompt = (await runClaude(authorPrompt, promptPol.model, promptPol.effort)).trim().replace(/^["'`]+|["'`]+$/g, '').slice(0, 1400);
  if (!imgPrompt) return { class: brief.class, briefId: brief.id, score: null, engine: 'Leonardo', styleDna: false, note: 'benchmark-unavailable: empty authored image prompt.' };

  // Generate ONE image (neutral: applyStyleDna:false, deliberately no project style DNA).
  leoUsed.n += 1;
  let base64: string | undefined;
  try {
    const r = await fetch(`${ORIGIN}/api/leonardo`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'image', prompt: imgPrompt, applyStyleDna: false }),
    });
    const j = await r.json();
    if (j?.success === false) {
      const msg = String(j.error ?? '');
      // Credit exhaustion surfaces several ways from the provider ("not enough api tokens",
      // "insufficient credits", quota/balance). Normalize to the honest 'credits' note and DROP
      // the raw provider payload (it can carry a userId we must not persist).
      const credits = /credit|insufficient|quota|balance|not enough|token/i.test(msg);
      return { class: brief.class, briefId: brief.id, score: null, engine: 'Leonardo', styleDna: false, note: credits ? 'benchmark-unavailable: credits.' : `benchmark-unavailable: ${msg.replace(/userId:[^",}]*/gi, '').slice(0, 120)}` };
    }
    base64 = j?.data?.imageBase64;
    if (!base64) return { class: brief.class, briefId: brief.id, score: null, engine: 'Leonardo', styleDna: false, note: 'benchmark-unavailable: no image bytes returned (cleanup off?).' };
  } catch (e) {
    return { class: brief.class, briefId: brief.id, score: null, engine: 'Leonardo', styleDna: false, note: `benchmark-unavailable: ${e instanceof Error ? e.message.slice(0, 120) : 'leonardo error'}` };
  }

  const file = join(tmpDir, `${brief.id}.png`);
  writeFileSync(file, Buffer.from(base64, 'base64'));
  const subject = `Emberfall :: ${brief.title} (neutral benchmark — no project canon)`;
  const payload = `Use the Read tool to view the image at:\n${file}\nThen judge it.`;
  const draws = await judge(cls, subject, payload, judgePol);
  const score = median(draws);
  return {
    class: brief.class, briefId: brief.id, score,
    ...(draws.length ? { draws } : {}),
    model: promptPol.model, effort: promptPol.effort, engine: 'Leonardo', styleDna: false,
    ...(score === null ? { note: 'benchmark-unavailable: no parseable verdict.' } : {}),
  };
}

/** Merge scored rows with the deferred set, deterministic order (class order, then briefId). */
function assemble(scored: Result[]): Result[] {
  const all = [...scored, ...DEFERRED];
  return all.sort((a, b) => {
    const ci = CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class);
    if (ci !== 0) return ci;
    return String(a.briefId ?? '').localeCompare(String(b.briefId ?? ''));
  });
}

function loadResults(): Result[] {
  try {
    const j = JSON.parse(readFileSync(RESULTS_PATH, 'utf8'));
    return (j.rows as Result[]).filter((r) => !r.deferred); // keep only scored/attempted rows; deferred re-seeded
  } catch {
    return [];
  }
}

function writeResults(scored: Result[]) {
  const rows = assemble(scored);
  const out = {
    _note: "Neutral capability-benchmark results (Phase 2). Each scored row is the TECHNIQUE STACK (quality prompt pack + engine + policy model) run on a canon-FREE neutral brief (scripts/capability-bench/briefs.json, world 'Emberfall'), judged by the strict rubric WITHOUT canonContext/siblingContext, median-of-3, sequential. capabilityModel.ts grades a class from its BENCHMARK median when scored rows exist (provenance 'neutral-benchmark'), keeping the project-instance median visible as a secondary field. Deferred rows carry an honest note and NO score (their class stays project-instance-graded, note surfaced in the gap statement). Regenerate with: npx tsx scripts/capability-benchmark.ts [--class <c>] [--force].",
    generatedAt: new Date().toISOString(),
    rubricVersion: RUBRIC_VERSION,
    rows,
  };
  writeFileSync(RESULTS_PATH, JSON.stringify(out, null, 2) + '\n');
}

async function main() {
  const briefs = (JSON.parse(readFileSync(BRIEFS_PATH, 'utf8')).briefs as Brief[])
    .filter((b) => (CLASS_FILTER ? b.class === CLASS_FILTER : true));

  const producePol = getModelPolicy('produce-text');
  const promptPol = getModelPolicy('produce-2d-prompt');
  const jp = getModelPolicy('judge-content');
  const judgePol = { model: jp.model as ClaudeModel, effort: jp.effort as Effort };
  const judgeIds = { model: MODEL_IDS[judgePol.model], effort: judgePol.effort };

  console.log(`capability-benchmark: ${briefs.length} brief(s)  produce(text)=${producePol.model}/${producePol.effort}  produce(image-prompt)=${promptPol.model}/${promptPol.effort}  judge=${judgePol.model}/${judgePol.effort} rubric=v${RUBRIC_VERSION} canon=OFF median=${MEDIAN}  origin=${ORIGIN}  dry=${DRY} force=${FORCE}`);

  const existing = loadResults();
  const done = new Set(existing.filter((r) => typeof r.score === 'number').map((r) => `${r.class}|${r.briefId}`));

  if (DRY) {
    for (const b of briefs) {
      const skip = !FORCE && done.has(`${b.class}|${b.id}`);
      console.log(`  ${skip ? 'SKIP ' : 'RUN  '}${b.class.padEnd(11)} ${b.id.padEnd(20)} ${isImageClass(b.class) ? 'Leonardo(image, styleDna:off)' : 'Claude(text)'} → judge x${MEDIAN}`);
    }
    console.log(`  (deferred, note-only: ${DEFERRED.map((d) => d.class).join(', ')})`);
    return;
  }

  const tmpDir = join(tmpdir(), 'pof-capability-bench'); mkdirSync(tmpDir, { recursive: true });
  const leoUsed = { n: 0 };
  // Carry forward prior scored rows; overwrite a brief's row when we (re)run it.
  const byKey = new Map<string, Result>(existing.map((r) => [`${r.class}|${r.briefId}`, r]));
  const creditsStoppedClass = new Set<string>();

  for (const b of briefs) {
    const key = `${b.class}|${b.id}`;
    if (!FORCE && done.has(key)) { console.log(`  SKIP ${key} (already recorded)`); continue; }
    if (creditsStoppedClass.has(b.class)) { console.log(`  SKIP ${key} (class stopped on credits)`); continue; }
    try {
      const res = isImageClass(b.class)
        ? await benchImage(b, { model: promptPol.model, effort: promptPol.effort }, judgeIds, tmpDir, leoUsed)
        : await benchText(b, { model: producePol.model, effort: producePol.effort }, judgeIds);
      byKey.set(key, res);
      const line = res.score === null ? `NO SCORE (${res.note ?? 'unknown'})` : `median ${res.score}  [${(res.draws ?? []).join(',')}]`;
      console.log(`  ${key.padEnd(28)} → ${line}`);
      if (res.note?.includes('credits')) { creditsStoppedClass.add(b.class); console.log(`  ⚠ ${b.class}: stopping class on credit error.`); }
      writeResults([...byKey.values()]); // persist after every brief (resumable)
    } catch (e) {
      console.log(`  ${key.padEnd(28)} → ERROR ${e instanceof Error ? e.message : e}`);
    }
  }

  const scored = [...byKey.values()].filter((r) => typeof r.score === 'number');
  console.log(`\ndone — ${scored.length} scored brief(s), ${leoUsed.n} Leonardo generation(s) used (guard ${MAX_LEONARDO}).`);
  for (const r of assemble([...byKey.values()]).filter((r) => !r.deferred)) {
    console.log(`  ${r.class.padEnd(11)} ${String(r.briefId).padEnd(20)} ${r.score === null ? '(no score)' : r.score}`);
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });

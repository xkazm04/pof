/* eslint-disable no-console -- this is a CLI harness; stdout is its interface. */
/**
 * Strict Opus judge harness (Quality Program WS2). For each target step it fetches the stored
 * artifact, builds the versioned rubric prompt (src/lib/judge/rubrics.ts), spawns the Claude
 * Code CLI at the model-policy's judge model+effort (default opus/high) — Reading the local
 * image for media so Opus judges it with vision — parses the JSON verdict, and POSTs it to
 * /api/judge-verdicts stamped with model, effort, and RUBRIC_VERSION.
 *
 * The judge is CANON-AWARE: every prompt carries (a) the project's binding design rules for the
 * catalog (global + catalog-scoped CANON_SEED — the same canon that prefixes Produce prompts) so
 * it stops penalizing content for correctly following project law (a Unique's power in a
 * rule-changing mod, a resident audio budget within the ≤8 MB cap, the project's rarity ladder),
 * and (b) a compact projection of the entity's OTHER steps so it verifies cross-references
 * instead of flagging sibling-consistent values as "invented". Canon never lowers the bar — a
 * genuine canon violation is itself scored down. Verdicts are stamped [rubric vN+canon].
 *
 *   npx tsx scripts/judge-run.ts --catalog items [--step "Icon 2D Art"] [--limit N] [--dry]
 *   npx tsx scripts/judge-run.ts --all            # every catalog with a judgeable deliverable
 *   npx tsx scripts/judge-run.ts --catalog items --median 3   # variance-robust near the 90 line
 *   npx tsx scripts/judge-run.ts --catalog items --no-canon    # A/B: disable canon+sibling context
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BANDS, buildRubricPrompt, parseJudgeResult, RUBRIC_VERSION, type JudgeResult } from '../src/lib/judge/rubrics';
import { deliverableClassOf, type DeliverableClass } from '../src/lib/judge/dimensions';
import { getModelPolicy, MODEL_IDS } from '../src/lib/model-policy';
import { getStepFact, isSyntheticEntity } from '../src/lib/status/statusModel';
import { canonContextFor } from '../src/lib/catalog/canon/canonContext';
import { CANON_SEED } from '../src/lib/catalog/canon/canon-seed';
import { buildSiblingContext } from '../src/lib/judge/siblingContext';
import stepFacts from '../src/lib/status/step-facts.json';

/** All catalog ids (for --all), from the authoritative step-facts map. */
function allCatalogs(): string[] {
  return [...new Set((stepFacts as { steps: { catalogId: string }[] }).steps.map((s) => s.catalogId))].sort();
}

const ORIGIN = process.env.POF_JUDGE_ORIGIN ?? 'http://localhost:3007';
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? (process.argv[i + 1]?.startsWith('--') ? '' : process.argv[i + 1]) : undefined; };
const has = (k: string) => process.argv.includes(`--${k}`);
const DRY = has('dry');
/** Draws per step; the median is recorded. Odd values only (2 would tie-break downward). */
const MEDIAN = Math.max(1, Number(arg('median') ?? 1));
/** A/B escape hatch: judge canon-blind (no canon, no sibling context) to measure canon's effect. */
const NO_CANON = has('no-canon');

type Artifact = { entityId: string; step: string; status: string; data: Record<string, unknown> };

async function fetchArtifacts(catalogId: string): Promise<Artifact[]> {
  const j = await (await fetch(`${ORIGIN}/api/pipeline-artifacts?catalogId=${catalogId}`)).json();
  return (j.data?.artifacts ?? j.data ?? []) as Artifact[];
}

/** Extract the judge payload for a deliverable class. Returns null if not judgeable here. */
function buildPayload(cls: DeliverableClass, art: Artifact, tmpDir: string): { payload: string; imageFile?: string } | null {
  const d = art.data ?? {};
  if (cls === 'text-config') {
    const clone: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d)) { if (k === 'genHistory' || k === 'audioAssets' || k === '_provenance') continue; clone[k] = v; }
    return { payload: '```json\n' + JSON.stringify(clone, null, 2) + '\n```' };
  }
  if (cls === '2d-art' || cls === 'ui-glyph' || cls === '3d-mesh') {
    // Pull the selected candidate's data-URL image out of genHistory, save to a temp PNG.
    const gh = d.genHistory as { batches?: { candidates?: { id?: string; swatch?: string }[] }[]; selectedId?: string } | undefined;
    const cands = gh?.batches?.flatMap((b) => b.candidates ?? []) ?? [];
    const sel = cands.find((c) => c.id === gh?.selectedId) ?? cands[0];
    const m = typeof sel?.swatch === 'string' ? sel.swatch.match(/^url\(data:image\/(\w+);base64,(.+)\)$/) : null;
    if (!m) return null;
    const file = join(tmpDir, `${art.entityId}__${cls}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`);
    writeFileSync(file, Buffer.from(m[2], 'base64'));
    return { payload: `Use the Read tool to view the image at:\n${file}\nThen judge it.`, imageFile: file };
  }
  return null; // audio → human judge; skip in this harness
}

/** Spawn the Claude CLI headless at the policy model+effort; return final stdout text. */
function runClaude(prompt: string, modelId: string, effort: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-p', '-', '--model', modelId, '--effort', effort, '--output-format', 'text', '--dangerously-skip-permissions'];
    const child = spawn('claude', args, { shell: true });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 || out ? resolve(out) : reject(new Error(`claude exit ${code}: ${err.slice(0, 300)}`))));
    child.stdin.write(prompt); child.stdin.end();
  });
}

async function judgeOne(catalogId: string, art: Artifact, entityArtifacts: Artifact[], tmpDir: string, policy: { cliModel: string; effort: string; modelId: string }, classFilter: Set<string> | null) {
  if (isSyntheticEntity(art.entityId)) return { skipped: `${catalogId}::${art.step} [${art.entityId}] — test fixture, not content` };
  const fact = getStepFact(catalogId, art.step);
  const cls = deliverableClassOf(fact?.deliverable ?? '', catalogId);
  if (!cls) return null;
  if (classFilter && !classFilter.has(cls)) return null;
  const payload = buildPayload(cls, art, tmpDir);
  if (!payload) return { skipped: `${catalogId}::${art.step} — no judgeable ${cls} payload` };

  // Canon-aware context: the catalog's binding design rules + the entity's sibling steps. Text
  // configs get the sibling cross-reference surface; media steps only get canon (their siblings
  // are images/data the text projection can't summarize usefully).
  const canonContext = NO_CANON ? undefined : canonContextFor(CANON_SEED, catalogId) || undefined;
  const siblingContext = NO_CANON || cls !== 'text-config'
    ? undefined
    : buildSiblingContext(entityArtifacts.filter((a) => a.entityId === art.entityId).map((a) => ({ step: a.step, data: a.data ?? {} })), art.step) || undefined;

  const prompt = buildRubricPrompt(cls, {
    subject: `${catalogId} :: ${art.step} (entity ${art.entityId})`,
    payload: payload.payload,
    canonContext,
    siblingContext,
  });
  if (DRY) return { dry: `${catalogId}::${art.step} [${cls}] canon=${canonContext ? 'y' : 'n'} sib=${siblingContext ? 'y' : 'n'} → ${payload.imageFile ?? 'text'} (${prompt.length} chars)` };

  // A single strict-judge draw has ~+/-5 run-to-run variance, so a step whose true quality sits
  // near the 90 line flaps across it between judgings. --median N draws N times and keeps the
  // MEDIAN (never the max: best-of-N would silently inflate every borderline cell into green).
  const draws: JudgeResult[] = [];
  for (let i = 0; i < MEDIAN; i++) {
    const res = parseJudgeResult(await runClaude(prompt, policy.cliModel, policy.effort));
    if (res) draws.push(res);
  }
  if (!draws.length) return { error: `${catalogId}::${art.step} — no parseable verdict in ${MEDIAN} draw(s)` };
  const sorted = [...draws].sort((a, b) => a.score - b.score);
  const res = sorted[Math.floor((sorted.length - 1) / 2)];
  // Verdict follows the MEDIAN score, not the drawn verdict of that sample.
  const verdict: 'pass' | 'fail' = res.score >= BANDS.shippable ? 'pass' : 'fail';
  const spread = draws.length > 1 ? ` [median-of-${draws.length}: ${sorted.map((d) => d.score).join(',')}]` : '';

  const judge = cls === 'text-config' ? 'llm-panel' : 'vlm';
  const canonTag = NO_CANON ? '' : '+canon';
  // Persist the median draw's per-dimension scores (WS2) so the detail views can show WHERE
  // the asset is weak, not just the aggregate. Absent/empty → omitted (column stays NULL).
  const dimensions = res.dimensions && Object.keys(res.dimensions).length ? res.dimensions : undefined;
  const body = {
    catalogId, entityId: art.entityId, step: art.step, judge,
    verdict, score: res.score,
    findings: `[rubric v${RUBRIC_VERSION}${canonTag}]${spread} ${res.findings} FIX: ${res.fix}`.slice(0, 1500),
    model: policy.modelId, effort: policy.effort, rubricVersion: RUBRIC_VERSION,
    ...(dimensions ? { dimensions } : {}),
  };
  const r = await fetch(`${ORIGIN}/api/judge-verdicts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const ok = (await r.json()).success !== false;
  return { verdict: `${verdict.toUpperCase()} ${res.score} ${catalogId}::${art.step} [${cls}]${spread} ${ok ? '' : '(POST FAIL)'}` };
}

async function main() {
  const pol = getModelPolicy('judge-content'); // judge-visual shares this policy today
  const policy = { cliModel: pol.model, modelId: MODEL_IDS[pol.model], effort: pol.effort };
  const tmpDir = join(tmpdir(), 'pof-judge'); mkdirSync(tmpDir, { recursive: true });

  const catalogs = has('all') ? allCatalogs() : arg('catalog') ? [arg('catalog') as string] : [];
  const stepFilter = arg('step');
  const entityFilter = arg('entity');
  const classFilter = arg('classes') ? new Set(arg('classes')!.split(',')) : null;
  const limit = arg('limit') ? Number(arg('limit')) : Infinity;

  console.log(`judge: model=${policy.cliModel} effort=${policy.effort} rubric=v${RUBRIC_VERSION}${NO_CANON ? '' : '+canon'} catalogs=${catalogs.length} classes=${classFilter ? [...classFilter].join('+') : 'all'} dry=${DRY}`);
  let n = 0;
  for (const c of catalogs) {
    const allArts = await fetchArtifacts(c); // full set — sibling context needs every step of an entity
    const toJudge = allArts.filter((a) => (stepFilter ? a.step === stepFilter : true) && (entityFilter ? a.entityId === entityFilter : true));
    for (const a of toJudge) {
      if (n >= limit) break;
      const res = await judgeOne(c, a, allArts, tmpDir, policy, classFilter);
      if (!res) continue;
      console.log('  ' + (res.verdict ?? res.skipped ?? res.dry ?? res.error));
      if (res.verdict || res.error) n++;
    }
  }
  console.log(`done — ${n} judged`);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });

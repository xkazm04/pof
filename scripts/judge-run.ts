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
 *   npx tsx scripts/judge-run.ts --catalog items --include-nested  # A/B: nested sibling projection (default off)
 *   npx tsx scripts/judge-run.ts --catalog items --force-budget  # proceed despite a budget refusal
 *   npx tsx scripts/judge-run.ts --catalog items --rejudge       # re-judge even unchanged steps
 *   npx tsx scripts/judge-run.ts --all --concurrency 4           # bounded pool (default 4)
 *
 * SKIP: a step whose stored verdict is BOUND to the content on record (same `stepContentHash`
 * under the current scheme, same rubric version) is skipped by default — the judgment already
 * exists and would cost an Opus draw to reproduce. Every skip prints its reason, so a skipped
 * step is never mistaken for a judged one. `--rejudge` forces the whole sweep.
 *
 * OPERATIONAL TRAP (2026-07-29): stripping `produceDirection` out of the judged PAYLOAD (see
 * `buildPayload`) does not move `stepContentHash` — `produceDirection` was never in
 * `contentHash.ts`'s `VOLATILE_KEYS`, so it was already counted toward the hash, and it stays
 * that way here on purpose (changing it would bump `CONTENT_HASH_SCHEME` and unbind every stored
 * hash). Nor does the strip touch `RUBRIC_VERSION`. So a verdict recorded from a CONTAMINATED
 * pre-fix payload still reads as "unchanged" (`judgeSkipDecision`, fleetPlan.ts:52-72) against the
 * unchanged artifact and is SKIPPED by default — re-baselining those contaminated verdicts after
 * this fix ships REQUIRES `--rejudge`, or the fix will look inert (nothing gets re-judged).
 *
 * SPEND: every spawn is recorded through the same `recordSpend` seam as every other CLI
 * invocation in this app (task types `judge-content` / `judge-visual`, module `judge`, one row
 * per DRAW labelled with its catalog::step [entity]), and every spawn is gated by the same
 * `evaluatePreflight` guardrail — so a configured budget can refuse this run and the Spend tab's
 * total is no longer structurally incomplete after a fleet run. Spend goes DIRECT to SQLite (the
 * script already opens the DB for the model policy), so metering adds no dev-server coupling
 * beyond the artifact/verdict fetches this harness has always needed.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BANDS, buildRubricPrompt, parseJudgeResult, RUBRIC_VERSION, type JudgeResult } from '../src/lib/judge/rubrics';
import { deliverableClassOf, type DeliverableClass } from '../src/lib/judge/dimensions';
import { getModelPolicy, MODEL_IDS } from '../src/lib/model-policy';
import { recordSpend, getBudgetStatus, getTaskTypeEstimate } from '../src/lib/cli-spend-db';
import { formatUsd } from '../src/lib/cli-spend/format';
import {
  judgeBudgetGate,
  judgeSpendRecord,
  judgeTaskType,
  parseCliJsonRun,
  type CliRunMetrics,
  type JudgeTaskType,
} from '../src/lib/judge/spendMeter';
import {
  DEFAULT_JUDGE_CONCURRENCY,
  indexVerdicts,
  judgeSkipDecision,
  runPool,
  verdictKey,
  type PriorVerdict,
} from '../src/lib/judge/fleetPlan';
import { getStepFact, isSyntheticEntity } from '../src/lib/status/statusModel';
import { canonContextFor } from '../src/lib/catalog/canon/canonContext';
import { CANON_SEED } from '../src/lib/catalog/canon/canon-seed';
import { buildSiblingContext } from '../src/lib/judge/siblingContext';
import { stripNonContent } from '../src/lib/judge/payload';
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
/** Operator override: proceed even when the budget guardrail refuses. Never the default. */
const FORCE_BUDGET = has('force-budget');
/** Re-judge every target, including steps whose stored verdict still binds to their content. */
const REJUDGE = has('rejudge');
/** Opt-in: include bounded nested objects in the sibling projection (default off — Task 4 A/Bs this). */
const INCLUDE_NESTED = has('include-nested');
/** In-flight judge spawns. Bounded — each worker holds a real Claude CLI process. */
const CONCURRENCY = Math.max(1, Number(arg('concurrency') ?? DEFAULT_JUDGE_CONCURRENCY));

type Artifact = { entityId: string; step: string; status: string; data: Record<string, unknown> };

// ── Spend metering ───────────────────────────────────────────────────────────
/** Running totals so a fleet run's cost is attributable per step AND in aggregate. */
const spend = { costUsd: 0, spawns: 0, unknownCost: 0 };
/** Set once the budget guardrail refuses mid-run; stops scheduling further spawns. */
let budgetStop: string | null = null;

/**
 * Ask the shared pre-flight guardrail whether this class of judge spawn may run, reading the
 * live budget + this task type's historical average from SQLite. A headless harness has nobody
 * to answer a confirm dialog, so a `warn` is a hard refusal unless `--force-budget`.
 */
function budgetGate(taskType: JudgeTaskType): { refuse: boolean; reasons: string[] } {
  const b = getBudgetStatus();
  const gate = judgeBudgetGate({
    taskType,
    estimate: getTaskTypeEstimate(taskType),
    budget: {
      dailyExceeded: b.dailyExceeded,
      monthlyExceeded: b.monthlyExceeded,
      dailyRemainingUsd: b.dailyRemainingUsd,
      monthlyRemainingUsd: b.monthlyRemainingUsd,
    },
  });
  return { refuse: gate.refuse && !FORCE_BUDGET, reasons: gate.reasons };
}

/** Persist one spawn's cost through the app's single spend seam. Never throws. */
function meter(taskType: JudgeTaskType, label: string, m: CliRunMetrics): void {
  spend.spawns += 1;
  spend.costUsd += m.costUsd;
  if (!m.costKnown) spend.unknownCost += 1;
  try {
    // Cost is attributable per run, not one opaque total: the label names the exact
    // catalog::step [entity] draw this spawn paid for.
    recordSpend(judgeSpendRecord(taskType, label, m));
  } catch (e) {
    console.error('  ! spend not recorded:', e instanceof Error ? e.message : e);
  }
}

async function fetchArtifacts(catalogId: string): Promise<Artifact[]> {
  const j = await (await fetch(`${ORIGIN}/api/pipeline-artifacts?catalogId=${catalogId}`)).json();
  return (j.data?.artifacts ?? j.data ?? []) as Artifact[];
}

/**
 * Stored verdicts for a catalog, indexed by (entity, step, judge class). This is what makes the
 * skip decision possible: each row carries the `content_hash` of the content it judged.
 * A fetch failure yields an EMPTY index — degrading to "judge everything" (the old behaviour),
 * never to "skip everything".
 */
async function fetchVerdictIndex(catalogId: string): Promise<Map<string, PriorVerdict>> {
  try {
    const j = await (await fetch(`${ORIGIN}/api/judge-verdicts?catalogId=${catalogId}`)).json();
    const rows = (j.data ?? []) as Array<PriorVerdict & { entityId: string; step: string }>;
    return indexVerdicts(Array.isArray(rows) ? rows : []);
  } catch {
    return new Map();
  }
}

/** Extract the judge payload for a deliverable class. Returns null if not judgeable here. */
function buildPayload(cls: DeliverableClass, art: Artifact, tmpDir: string): { payload: string; imageFile?: string } | null {
  const d = art.data ?? {};
  if (cls === 'text-config') {
    return { payload: '```json\n' + JSON.stringify(stripNonContent(d), null, 2) + '\n```' };
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

/**
 * Spawn the Claude CLI headless at the policy model+effort; return the final text WITH its
 * metered cost/usage.
 *
 * `--output-format json` (was `text`) is what makes the spawn meterable — the envelope carries
 * `total_cost_usd` / `usage` / `duration_ms` alongside the same final `result` text the judge
 * parser has always read. Nothing about the prompt, model, effort or rubric changes.
 *
 * `--dangerously-skip-permissions` is REQUIRED here, not incidental: a media judgment feeds the
 * judge a `Read` instruction for a temp PNG this script just wrote (see `buildPayload`), and
 * stdin is the prompt pipe — there is no interactive channel to approve the tool call on. The
 * spawn is otherwise read-only (judge a file, print JSON) and now fully metered.
 */
function runClaude(prompt: string, modelId: string, effort: string): Promise<CliRunMetrics> {
  return new Promise((resolve, reject) => {
    const args = ['-p', '-', '--model', modelId, '--effort', effort, '--output-format', 'json', '--dangerously-skip-permissions'];
    const child = spawn('claude', args, { shell: true });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 || out ? resolve(parseCliJsonRun(out)) : reject(new Error(`claude exit ${code}: ${err.slice(0, 300)}`))));
    child.stdin.write(prompt); child.stdin.end();
  });
}

/** The `judge_verdicts.judge` class a given deliverable class's verdict is stored under. */
function judgeClassOf(cls: DeliverableClass): 'llm-panel' | 'vlm' {
  return cls === 'text-config' ? 'llm-panel' : 'vlm';
}

type Plan =
  | { kind: 'none' }
  | { kind: 'note'; text: string }
  | { kind: 'judge'; cls: DeliverableClass };

/**
 * Decide, WITHOUT spawning anything, what should happen to one artifact. Cheap and pure enough
 * to run over every row of every catalog — which is what lets `--dry` report the exact spawn
 * count a real run would make.
 */
function planOne(catalogId: string, art: Artifact, classFilter: Set<string> | null, verdicts: Map<string, PriorVerdict>): Plan {
  if (isSyntheticEntity(art.entityId)) return { kind: 'note', text: `${catalogId}::${art.step} [${art.entityId}] — test fixture, not content` };
  const fact = getStepFact(catalogId, art.step);
  const cls = deliverableClassOf(fact?.deliverable ?? '', catalogId);
  if (!cls) return { kind: 'none' };
  if (classFilter && !classFilter.has(cls)) return { kind: 'none' };

  const decision = judgeSkipDecision({
    data: art.data,
    prior: verdicts.get(verdictKey(art.entityId, art.step, judgeClassOf(cls))),
    rubricVersion: RUBRIC_VERSION,
    force: REJUDGE,
  });
  // Skipping is VISIBLE: the reason is printed, so a skipped step can never read as a judged one.
  if (decision.skip) return { kind: 'note', text: `SKIP ${catalogId}::${art.step} [${art.entityId}] — ${decision.reason}` };
  return { kind: 'judge', cls };
}

async function judgeOne(catalogId: string, art: Artifact, cls: DeliverableClass, entityArtifacts: Artifact[], tmpDir: string, policy: { cliModel: string; effort: string; modelId: string }) {
  const payload = buildPayload(cls, art, tmpDir);
  if (!payload) return { skipped: `${catalogId}::${art.step} — no judgeable ${cls} payload` };

  // Canon-aware context: the catalog's binding design rules + the entity's sibling steps. Text
  // configs get the sibling cross-reference surface; media steps only get canon (their siblings
  // are images/data the text projection can't summarize usefully).
  const canonContext = NO_CANON ? undefined : canonContextFor(CANON_SEED, catalogId) || undefined;
  const siblingContext = NO_CANON || cls !== 'text-config'
    ? undefined
    : buildSiblingContext(entityArtifacts.filter((a) => a.entityId === art.entityId).map((a) => ({ step: a.step, data: a.data ?? {} })), art.step, { includeNested: INCLUDE_NESTED }) || undefined;

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
  // Every spawn is gated then metered. The gate is re-read per step (not once per run) so a
  // budget crossed mid-fleet actually STOPS the remaining spawns instead of only the first one.
  const taskType = judgeTaskType(cls);
  const gate = budgetGate(taskType);
  if (gate.refuse) {
    budgetStop = `budget guardrail refused ${taskType}: ${gate.reasons.join(' ')} — re-run with --force-budget to override`;
    return { error: `${catalogId}::${art.step} — REFUSED by budget guardrail` };
  }

  const draws: JudgeResult[] = [];
  let stepCost = 0;
  for (let i = 0; i < MEDIAN; i++) {
    const m = await runClaude(prompt, policy.cliModel, policy.effort);
    meter(taskType, `${catalogId}::${art.step} [${art.entityId}] draw ${i + 1}/${MEDIAN}`, m);
    stepCost += m.costUsd;
    const res = parseJudgeResult(m.text);
    if (res) draws.push(res);
  }
  const costTag = ` ${formatUsd(stepCost)}`;
  if (!draws.length) return { error: `${catalogId}::${art.step} — no parseable verdict in ${MEDIAN} draw(s)${costTag}` };
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
  return { verdict: `${verdict.toUpperCase()} ${res.score} ${catalogId}::${art.step} [${cls}]${spread}${costTag} ${ok ? '' : '(POST FAIL)'}` };
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

  console.log(`judge: model=${policy.cliModel} effort=${policy.effort} rubric=v${RUBRIC_VERSION}${NO_CANON ? '' : '+canon'} catalogs=${catalogs.length} classes=${classFilter ? [...classFilter].join('+') : 'all'} dry=${DRY} concurrency=${CONCURRENCY} skip-unchanged=${REJUDGE ? 'off (--rejudge)' : 'on'}`);

  // Up-front budget gate — refuse the whole fleet before the first Opus spawn rather than
  // discovering the ceiling halfway through it. A dry run never spawns, so it is never gated.
  if (!DRY) {
    for (const t of ['judge-content', 'judge-visual'] as JudgeTaskType[]) {
      const g = budgetGate(t);
      if (g.refuse) {
        console.error(`REFUSED — ${t}: ${g.reasons.join(' ')}`);
        console.error('Raise the budget (Spend tab) or re-run with --force-budget.');
        process.exit(3);
      }
    }
  }

  let n = 0;
  let skipped = 0;
  const t0 = Date.now();
  for (const c of catalogs) {
    if (budgetStop) break;
    const allArts = await fetchArtifacts(c); // full set — sibling context needs every step of an entity
    const verdicts = await fetchVerdictIndex(c); // what has already been judged, and of what content
    const toJudge = allArts.filter((a) => (stepFilter ? a.step === stepFilter : true) && (entityFilter ? a.entityId === entityFilter : true));

    // ── Plan (no spawns) ───────────────────────────────────────────────────
    // Deciding first is what lets `--limit` count real work and the pool schedule only targets
    // that will actually spawn — a skipped step must not consume a limit slot.
    const targets: { art: Artifact; cls: DeliverableClass }[] = [];
    for (const a of toJudge) {
      const p = planOne(c, a, classFilter, verdicts);
      if (p.kind === 'none') continue;
      if (p.kind === 'note') {
        console.log('  ' + p.text);
        if (p.text.startsWith('SKIP ')) skipped++;
        continue;
      }
      if (n + targets.length >= limit) break;
      targets.push({ art: a, cls: p.cls });
    }

    // ── Judge (bounded pool) ───────────────────────────────────────────────
    // These are real Claude CLI processes, so fan-out is capped at CONCURRENCY — the same
    // ceiling the deep-eval engine uses. Results keep input order, so output reads as before.
    const results = await runPool(targets, CONCURRENCY, async (t) => {
      if (budgetStop) return null; // a mid-fleet budget stop halts the workers still to start
      return judgeOne(c, t.art, t.cls, allArts, tmpDir, policy);
    });
    for (const res of results) {
      if (!res) continue;
      console.log('  ' + (res.verdict ?? res.skipped ?? res.dry ?? res.error));
      if (res.verdict || res.error) n++;
    }
  }
  const costLine = DRY
    ? ''
    : ` — spend ${formatUsd(spend.costUsd)} over ${spend.spawns} spawn(s)` +
      (spend.unknownCost ? ` (${spend.unknownCost} spawn(s) reported no cost)` : '');
  const skipLine = skipped
    ? `, ${skipped} skipped (verdict still bound to unchanged content — re-run with --rejudge to force)`
    : '';
  console.log(`done — ${n} judged${skipLine}${costLine} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (budgetStop) {
    console.error(`STOPPED — ${budgetStop}`);
    process.exit(3);
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });

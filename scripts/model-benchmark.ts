/**
 * Model & effort benchmark harness (Quality Program WS3). For each sample task it produces at
 * every (model, effort) combo in the matrix, strict-judges each output with the JUDGE OF RECORD
 * (the same policy + id + v4 canon-aware rubric scripts/judge-run.ts uses; blind — the judge never
 * sees which model produced it) and records every draw with its score, tokens, wall time, cost
 * and rubric version. A cell is N draws (default 3); its score is their MEDIAN.
 * `--write-winners` writes the best current-rubric (model, effort) per task class of THIS run
 * into model_policy. Results surface on the /status Models panel.
 *
 * Nothing spends before a plan: the harness first computes the draw count and an estimated cost,
 * `--plan` prints that and stops with zero model calls, and a real run refuses to start unless an
 * explicit `--budget <usd>` covers the estimate. Every spawn is metered through recordSpend.
 *
 *   npx tsx scripts/model-benchmark.ts --plan                                 # plan + estimate, no calls
 *   npx tsx scripts/model-benchmark.ts --budget 5                             # run if the estimate fits $5
 *   npx tsx scripts/model-benchmark.ts --budget 5 --combos sonnet:low,opus:high --draws 3
 *   npx tsx scripts/model-benchmark.ts --budget 5 --classes produce-text,fix-content --write-winners
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualityPack } from '@/lib/prompts/quality';
import { buildRubricPrompt, parseJudgeResult, RUBRIC_VERSION } from '@/lib/judge/rubrics';
import type { DeliverableClass } from '@/lib/judge/dimensions';
import { stripNonContent } from '@/lib/judge/payload';
import { parseCliJsonRun, type CliRunMetrics } from '@/lib/judge/spendMeter';
import { canonContextFor } from '@/lib/catalog/canon/canonContext';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import {
  getModelPolicy, setModelPolicy, isEffort, isModel, isTaskClass, MODEL_IDS,
  type ClaudeModel, type Effort, type TaskClass,
} from '@/lib/model-policy';
import { recordSpend } from '@/lib/cli-spend-db';
import { recordSample, getCell, listDraws, median, isStaleBenchmark, type BenchmarkCell } from '@/lib/benchmark-db';
import { logger } from '@/lib/logger';
import { err, ok, type Result } from '@/types/result';

// ── The judge of record ──────────────────────────────────────────────────────

export interface JudgeOfRecord { cliModel: ClaudeModel; modelId: string; effort: Effort }

/**
 * The benchmark judge, resolved exactly as scripts/judge-run.ts resolves its own
 * (`getModelPolicy('judge-content')`, id `MODEL_IDS[model]`, spawned with the policy alias), so
 * the two cannot drift: a policy change moves both. The id is stamped on every recorded draw.
 */
export function resolveJudgeOfRecord(): JudgeOfRecord {
  const pol = getModelPolicy('judge-content');
  return { cliModel: pol.model, modelId: MODEL_IDS[pol.model], effort: pol.effort };
}

// ── Cost ─────────────────────────────────────────────────────────────────────

export interface TokenRates { input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null }

/**
 * THE rate table: USD per million tokens, keyed by model id. Input/output are Anthropic
 * first-party list prices as published in the claude-api model table (cached 2026-10-06). Cache
 * read/write rates are NOT documented there for these ids, so they are null — a draw that used
 * cache tokens records a null cost rather than one built on an assumed multiplier. A model id
 * absent from this table has no rate at all. Add a rate here only with its source.
 */
export const MODEL_RATES_USD_PER_MTOK: Readonly<Record<string, TokenRates>> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5, cacheRead: null, cacheWrite: null },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: null, cacheWrite: null },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: null, cacheWrite: null },
  'claude-fable-5': { input: 10, output: 50, cacheRead: null, cacheWrite: null },
};

export interface ModelTokens { modelId: string; input: number; output: number; cacheRead: number; cacheWrite: number }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * The tokens a spawn actually returned, per model that served it. The CLI's JSON envelope names
 * the served model ids under `modelUsage`; when it does not, the tokens are attributed to the
 * policy's id for the alias that was asked for (`MODEL_IDS`).
 */
export function tokensByModel(stdout: string, m: CliRunMetrics, requestedModelId: string): ModelTokens[] {
  const a = stdout.indexOf('{'), b = stdout.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try {
      const usage = (JSON.parse(stdout.slice(a, b + 1)) as { modelUsage?: unknown }).modelUsage;
      if (usage && typeof usage === 'object' && !Array.isArray(usage) && Object.keys(usage).length) {
        return Object.entries(usage as Record<string, Record<string, unknown>>).map(([modelId, u]) => ({
          modelId,
          input: num(u.inputTokens), output: num(u.outputTokens),
          cacheRead: num(u.cacheReadInputTokens), cacheWrite: num(u.cacheCreationInputTokens),
        }));
      }
    } catch { /* fall through to the top-level usage */ }
  }
  return [{ modelId: requestedModelId, input: m.tokensIn, output: m.tokensOut, cacheRead: m.cacheReadTokens, cacheWrite: m.cacheCreationTokens }];
}

/** USD for the given tokens, or null when any non-zero token kind has no known rate. Never guessed. */
export function costOf(tokens: ModelTokens[], rates: Readonly<Record<string, TokenRates>> = MODEL_RATES_USD_PER_MTOK): number | null {
  let usd = 0;
  for (const t of tokens) {
    const r = rates[t.modelId];
    if (!r) return null;
    for (const [n, rate] of [[t.input, r.input], [t.output, r.output], [t.cacheRead, r.cacheRead], [t.cacheWrite, r.cacheWrite]] as const) {
      if (!n) continue;
      if (rate === null) return null;
      usd += (n * rate) / 1e6;
    }
  }
  return usd;
}

const totalTokens = (ts: ModelTokens[]) => ts.reduce((s, t) => s + t.input + t.output + t.cacheRead + t.cacheWrite, 0);

// ── Sample tasks ─────────────────────────────────────────────────────────────

export interface SampleTask {
  taskId: string;
  taskClass: TaskClass;
  catalog: string;
  step: string;
  subject: string;
  /** The v4 rubric class the output is judged under. Every runnable class emits text. */
  judgeClass: DeliverableClass;
  producePrompt: string;
}

const JSON_ONLY = 'Respond with ONLY a JSON object, no prose, no code fence.';

/**
 * Representative sample tasks across six task classes. The prompt-authoring classes are judged
 * as text by the text-config rubric — no media is rendered (media models are out of bounds), so
 * those cells measure prompt craft, not rendered output.
 */
export const SAMPLE_TASKS: SampleTask[] = [
  { taskId: 'produce-text:items', taskClass: 'produce-text', catalog: 'items', step: 'Economy', subject: 'a mid-tier one-handed sword', judgeClass: 'text-config',
    producePrompt: [qualityPack('text-config', 'items'), `Produce the "Economy" config for a mid-tier one-handed sword. ${JSON_ONLY} Include the fields a real implementation needs.`].join('\n\n') },
  { taskId: 'produce-text:quests', taskClass: 'produce-text', catalog: 'quests', step: 'Objective Graph', subject: 'a three-stage retrieval quest', judgeClass: 'text-config',
    producePrompt: [qualityPack('text-config', 'quests'), `Produce the "Objective Graph" config for a three-stage retrieval quest. ${JSON_ONLY} Include the fields a real implementation needs.`].join('\n\n') },
  { taskId: 'produce-2d-prompt:items', taskClass: 'produce-2d-prompt', catalog: 'items', step: 'Icon Prompt', subject: 'the inventory icon of a mid-tier one-handed sword', judgeClass: 'text-config',
    producePrompt: [qualityPack('2d-art', 'items'), `Author the image-generation prompt for the inventory icon of a mid-tier one-handed sword. ${JSON_ONLY} Fields: prompt, negativePrompt, styleNotes.`].join('\n\n') },
  { taskId: 'produce-3d-prompt:items', taskClass: 'produce-3d-prompt', catalog: 'items', step: 'Mesh Prompt', subject: 'the game-ready mesh of a mid-tier one-handed sword', judgeClass: 'text-config',
    producePrompt: [qualityPack('3d-mesh', 'items'), `Author the 3D mesh-generation concept prompt for a mid-tier one-handed sword. ${JSON_ONLY} Fields: prompt, negativePrompt, polyBudget, materialNotes.`].join('\n\n') },
  { taskId: 'produce-audio-prompt:bestiary', taskClass: 'produce-audio-prompt', catalog: 'bestiary', step: 'Audio Prompt', subject: 'the attack bark of a cave ghoul', judgeClass: 'text-config',
    producePrompt: [qualityPack('audio', 'bestiary'), `Author the sound-effect generation prompt for the attack bark of a cave ghoul. ${JSON_ONLY} Fields: prompt, durationSeconds, layers, mixNotes.`].join('\n\n') },
  { taskId: 'fix-content:items', taskClass: 'fix-content', catalog: 'items', step: 'Economy', subject: 'a repaired mid-tier one-handed sword economy', judgeClass: 'text-config',
    producePrompt: [
      qualityPack('text-config', 'items'),
      'This "Economy" config for a mid-tier one-handed sword FAILED review:',
      '{"name":"Ironbrand Falchion","tier":"mid","rarity":"legendary","dropLevel":1,"buyPrice":12,"sellPrice":40}',
      'Reviewer finding: the sell price exceeds the buy price (an infinite-gold loop), and a mid-tier item is marked legendary at drop level 1.',
      `Return the repaired config. ${JSON_ONLY}`,
    ].join('\n\n') },
  { taskId: 'author-ue-test:items', taskClass: 'author-ue-test', catalog: 'items', step: 'UE Automation Test', subject: 'a UE5 automation test for item sell/buy price invariants', judgeClass: 'text-config',
    producePrompt: [
      'You are a senior UE5 C++ engineer at a AAA action-RPG studio.',
      'Write a UE5 automation test (IMPLEMENT_SIMPLE_AUTOMATION_TEST) asserting that for every item row in a UDataTable of FItemEconomyRow, sellPrice <= buyPrice and dropLevel >= 1.',
      `${JSON_ONLY} Fields: fileName, code.`,
    ].join('\n\n') },
];

/** The judge payload, shaped as judge-run shapes a text-config artifact (non-content keys stripped). */
export function judgePayload(text: string): string {
  const body = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const o = JSON.parse(body) as unknown;
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return '```json\n' + JSON.stringify(stripNonContent(o as Record<string, unknown>), null, 2) + '\n```';
    }
  } catch { /* not JSON — judge it as produced */ }
  return '```json\n' + body + '\n```';
}

/**
 * The judge prompt, composed from the same v4 rubric builder and project canon judge-run uses.
 * There is no sibling context: a benchmark sample is a standalone subject with no entity steps.
 */
export function buildJudgePrompt(t: SampleTask, producedText: string): string {
  return buildRubricPrompt(t.judgeClass, {
    subject: `${t.catalog} :: ${t.step} (${t.subject})`,
    payload: judgePayload(producedText),
    canonContext: canonContextFor(CANON_SEED, t.catalog) || undefined,
  });
}

// ── Plan, estimate, budget gate ──────────────────────────────────────────────

export interface Combo { model: ClaudeModel; effort: Effort }

/** Pruned matrix — sensible pairs (cheap models at low effort, strong models at higher effort). */
export const DEFAULT_COMBOS: Combo[] = [
  { model: 'haiku', effort: 'low' },
  { model: 'sonnet', effort: 'low' },
  { model: 'sonnet', effort: 'medium' },
  { model: 'opus', effort: 'medium' },
  { model: 'fable', effort: 'medium' },
];

export const DEFAULT_DRAWS = 3;

/**
 * PLANNING ASSUMPTIONS (estimates, not measurements): the CLI's own system prompt + tools per
 * spawn, ~4 chars per prompt token, and output (incl. thinking) tokens by effort. They exist only
 * to size a run before it spends; recorded costs come from the tokens actually returned.
 */
export const ESTIMATE_ASSUMPTIONS = {
  cliOverheadInputTokens: 20_000,
  charsPerToken: 4,
  outputTokensByEffort: { low: 1_500, medium: 3_000, high: 6_000, xhigh: 10_000, max: 16_000 } as Record<Effort, number>,
} as const;

export interface BenchmarkPlan {
  cells: number;
  drawsPerCell: number;
  draws: number;
  /** Model spawns: one produce + one judge per draw. */
  spawns: number;
  /** Estimated USD, or null when some planned spawn's model has no rate. */
  estUsd: number | null;
  unpriced: string[];
  lines: string[];
}

function estimateSpawn(modelId: string, effort: Effort, promptChars: number): number | null {
  const r = MODEL_RATES_USD_PER_MTOK[modelId];
  if (!r || r.input === null || r.output === null) return null;
  const A = ESTIMATE_ASSUMPTIONS;
  const input = A.cliOverheadInputTokens + Math.ceil(promptChars / A.charsPerToken);
  return (input * r.input + A.outputTokensByEffort[effort] * r.output) / 1e6;
}

export function planBenchmark(tasks: SampleTask[], combos: Combo[], drawsPerCell: number, judge: JudgeOfRecord): BenchmarkPlan {
  const cells = tasks.length * combos.length;
  const draws = cells * drawsPerCell;
  const unpriced = new Set<string>();
  let est = 0;
  for (const t of tasks) {
    for (const c of combos) {
      const modelId = MODEL_IDS[c.model];
      const produce = estimateSpawn(modelId, c.effort, t.producePrompt.length);
      const producedChars = ESTIMATE_ASSUMPTIONS.outputTokensByEffort[c.effort] * ESTIMATE_ASSUMPTIONS.charsPerToken;
      const judged = estimateSpawn(judge.modelId, judge.effort, buildJudgePrompt(t, '').length + producedChars);
      if (produce === null) unpriced.add(modelId);
      if (judged === null) unpriced.add(judge.modelId);
      est += ((produce ?? 0) + (judged ?? 0)) * drawsPerCell;
    }
  }
  const estUsd = unpriced.size ? null : est;
  const classes = [...new Set(tasks.map((t) => t.taskClass))];
  const lines = [
    `plan: ${tasks.length} task(s) [${classes.join(', ')}] × ${combos.length} combo(s) = ${cells} cell(s) × ${drawsPerCell} draw(s) = ${draws} draws, ${draws * 2} spawns`,
    `judge of record: ${judge.modelId} (${judge.cliModel}/${judge.effort}), rubric v${RUBRIC_VERSION}+canon`,
    estUsd === null
      ? `estimate: UNKNOWN — no rate for ${[...unpriced].join(', ')}`
      : `estimate: ~$${estUsd.toFixed(2)} (planning assumptions, not a bound — actual cost is metered per spawn)`,
  ];
  return { cells, drawsPerCell, draws, spawns: draws * 2, estUsd, unpriced: [...unpriced], lines };
}

/** Refuse a run that has no explicit budget, cannot be estimated, or is estimated over budget. */
export function budgetGate(plan: BenchmarkPlan, budgetUsd: number | undefined): Result<BenchmarkPlan, string> {
  if (budgetUsd === undefined || !Number.isFinite(budgetUsd) || budgetUsd < 0) {
    return err('refused: a real run needs an explicit --budget <usd> (use --plan to see the estimate)');
  }
  if (plan.estUsd === null) {
    return err(`refused: cost cannot be estimated (no rate for ${plan.unpriced.join(', ')}), so it cannot be held to a budget`);
  }
  if (plan.estUsd > budgetUsd) {
    return err(`refused: estimated $${plan.estUsd.toFixed(2)} for ${plan.draws} draws exceeds the $${budgetUsd.toFixed(2)} budget`);
  }
  return ok(plan);
}

// ── Running ──────────────────────────────────────────────────────────────────

/** A model call: prompt in, the CLI's raw `--output-format json` stdout out. Stubbed in tests. */
export type Provider = (prompt: string, model: ClaudeModel, effort: Effort) => Promise<string>;

/** A metering sink for every spawn (default: the app's single spend seam, recordSpend). */
export type Meter = (label: string, m: CliRunMetrics) => void;

export const claudeCliProvider: Provider = (prompt, model, effort) => new Promise((done, fail) => {
  const args = ['-p', '-', '--model', model, '--effort', effort, '--output-format', 'json', '--dangerously-skip-permissions'];
  const child = spawn('claude', args, { shell: true });
  let out = '', errOut = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (errOut += d));
  child.on('error', fail);
  child.on('close', (code) => (code === 0 || out ? done(out) : fail(new Error(`claude exit ${code}: ${errOut.slice(0, 200)}`))));
  child.stdin.write(prompt); child.stdin.end();
});

export const spendMeter: Meter = (label, m) => {
  try {
    recordSpend({
      moduleId: 'benchmark', taskType: 'benchmark',
      taskLabel: (m.costKnown ? label : `${label} (cost unreported by CLI)`).slice(0, 300),
      sessionKey: m.sessionKey, costUsd: m.costUsd, tokensIn: m.tokensIn, tokensOut: m.tokensOut,
      cacheReadTokens: m.cacheReadTokens, cacheCreationTokens: m.cacheCreationTokens,
      durationMs: m.durationMs, success: !m.isError,
    });
  } catch (e) {
    logger.error('  ! spend not recorded:', e instanceof Error ? e.message : e);
  }
};

export interface RunOptions {
  tasks: SampleTask[];
  combos: Combo[];
  drawsPerCell: number;
  budgetUsd?: number;
  planOnly: boolean;
  runId: string;
  provider: Provider;
  meter?: Meter;
}

export interface RunOutcome { plan: BenchmarkPlan; cells: BenchmarkCell[]; spentUsd: number; unmeteredSpawns: number; stoppedAtBudget: boolean }

/**
 * Plan → (stop if --plan) → budget gate → draw. A draw is one produce at the combo plus one
 * judge-of-record score; the producer's returned tokens, wall time and cost are recorded with the
 * score. Spend is checked between draws: once the CLI-reported spend reaches the budget no new
 * draw starts (one already in flight is finished, never killed — its cost would be lost).
 */
export async function runBenchmark(o: RunOptions): Promise<Result<RunOutcome, string>> {
  const judge = resolveJudgeOfRecord();
  const plan = planBenchmark(o.tasks, o.combos, o.drawsPerCell, judge);
  for (const l of plan.lines) logger.info(l);
  if (o.planOnly) return ok({ plan, cells: [], spentUsd: 0, unmeteredSpawns: 0, stoppedAtBudget: false });

  const gate = budgetGate(plan, o.budgetUsd);
  if (!gate.ok) return err(gate.error);
  const budget = o.budgetUsd as number;
  const meter = o.meter ?? spendMeter;

  let spentUsd = 0, unmeteredSpawns = 0, stoppedAtBudget = false;
  const call = async (prompt: string, model: ClaudeModel, effort: Effort, label: string) => {
    const started = Date.now();
    const stdout = await o.provider(prompt, model, effort);
    const m = parseCliJsonRun(stdout);
    meter(label, m);
    spentUsd += m.costUsd;
    if (!m.costKnown) unmeteredSpawns++;
    return { m, stdout, ms: m.durationMs || Date.now() - started };
  };

  const cells: BenchmarkCell[] = [];
  outer: for (const t of o.tasks) {
    for (const c of o.combos) {
      const tag = `${t.taskId} ${c.model}/${c.effort}`;
      for (let d = 1; d <= o.drawsPerCell; d++) {
        if (spentUsd >= budget) { stoppedAtBudget = true; break outer; }
        try {
          const produced = await call(t.producePrompt, c.model, c.effort, `benchmark ${tag} produce ${d}/${o.drawsPerCell}`);
          const judged = await call(buildJudgePrompt(t, produced.m.text), judge.cliModel, judge.effort, `benchmark ${tag} judge ${d}/${o.drawsPerCell}`);
          const res = parseJudgeResult(judged.m.text);
          if (!res) { logger.warn(`  ${tag} draw ${d} → UNPARSEABLE judge output (no row recorded)`); continue; }
          const tokens = tokensByModel(produced.stdout, produced.m, MODEL_IDS[c.model]);
          const costUsd = costOf(tokens);
          recordSample({
            runId: o.runId, taskClass: t.taskClass, model: c.model, effort: c.effort, taskId: t.taskId, draw: d,
            score: res.score, tokens: totalTokens(tokens), wallMs: produced.ms, costUsd, judgeModelId: judge.modelId,
          });
          logger.info(`  ${tag} draw ${d} → ${res.score} (${(produced.ms / 1000).toFixed(0)}s, ${costUsd === null ? 'cost unknown: no rate for ' + tokens.map((x) => x.modelId).join('+') : '$' + costUsd.toFixed(4)})`);
        } catch (e) {
          logger.warn(`  ${tag} draw ${d} → ERROR ${e instanceof Error ? e.message : e}`);
        }
      }
      const cell = getCell({ runId: o.runId, taskClass: t.taskClass, model: c.model, effort: c.effort, taskId: t.taskId });
      cells.push(cell);
      logger.info(`  ${tag} cell → median ${cell.medianScore ?? 'n/a'} of ${cell.draws.length} draw(s), cost ${cell.costUsd === null ? 'unknown' : '$' + cell.costUsd.toFixed(4)}`);
    }
  }
  if (stoppedAtBudget) logger.warn(`budget reached: $${spentUsd.toFixed(2)} of $${budget.toFixed(2)} — remaining draws not started`);
  if (unmeteredSpawns) logger.warn(`${unmeteredSpawns} spawn(s) reported no cost — $${spentUsd.toFixed(2)} is a FLOOR`);
  return ok({ plan, cells, spentUsd, unmeteredSpawns, stoppedAtBudget });
}

/**
 * Per task class, the best (model, effort) of ONE run: highest median over that class's
 * current-rubric draws, cheaper on a tie, and only combos with at least `minDraws` draws.
 */
export function runWinners(runId: string, minDraws = DEFAULT_DRAWS): { taskClass: TaskClass; combo: Combo; medianScore: number; draws: number }[] {
  const groups = new Map<string, { scores: number[]; cost: number }>();
  for (const r of listDraws(runId)) {
    if (isStaleBenchmark(r)) continue;
    const k = `${r.taskClass}|${r.model}|${r.effort}`;
    const g = groups.get(k) ?? groups.set(k, { scores: [], cost: 0 }).get(k)!;
    g.scores.push(r.score);
    g.cost += r.costUsd ?? Number.POSITIVE_INFINITY;
  }
  const best = new Map<string, { taskClass: TaskClass; combo: Combo; medianScore: number; draws: number; cost: number }>();
  for (const [k, g] of groups) {
    const [taskClass, model, effort] = k.split('|');
    if (g.scores.length < minDraws || !isTaskClass(taskClass) || !isModel(model) || !isEffort(effort)) continue;
    const cand = { taskClass, combo: { model, effort }, medianScore: median(g.scores) ?? 0, draws: g.scores.length, cost: g.cost / g.scores.length };
    const cur = best.get(taskClass);
    if (!cur || cand.medianScore > cur.medianScore || (cand.medianScore === cur.medianScore && cand.cost < cur.cost)) best.set(taskClass, cand);
  }
  return [...best.values()].map((w) => ({ taskClass: w.taskClass, combo: w.combo, medianScore: w.medianScore, draws: w.draws }));
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseCombos(raw: string | undefined): Result<Combo[], string> {
  if (!raw) return ok(DEFAULT_COMBOS);
  const out: Combo[] = [];
  for (const c of raw.split(',')) {
    const [model, effort] = c.split(':');
    if (!isModel(model) || !isEffort(effort)) return err(`bad combo "${c}" (want model:effort, e.g. sonnet:low)`);
    out.push({ model, effort });
  }
  return ok(out);
}

async function main(argv: string[]): Promise<number> {
  const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const has = (k: string) => argv.includes(`--${k}`);

  const combos = parseCombos(arg('combos'));
  if (!combos.ok) { logger.error(combos.error); return 2; }
  const classes = arg('classes')?.split(',');
  const unknown = classes?.filter((c) => !SAMPLE_TASKS.some((t) => t.taskClass === c));
  if (unknown?.length) { logger.error(`no sample tasks for class(es): ${unknown.join(', ')}`); return 2; }
  const tasks = classes ? SAMPLE_TASKS.filter((t) => classes.includes(t.taskClass)) : SAMPLE_TASKS;
  const drawsPerCell = Math.max(1, Math.floor(Number(arg('draws') ?? DEFAULT_DRAWS)));
  const budgetRaw = arg('budget');
  const runId = arg('run-id') ?? `bench-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;

  const out = await runBenchmark({
    tasks, combos: combos.data, drawsPerCell, runId, provider: claudeCliProvider,
    planOnly: has('plan') || has('dry'),
    budgetUsd: budgetRaw === undefined ? undefined : Number(budgetRaw),
  });
  if (!out.ok) { logger.error(out.error); return 1; }
  if (has('plan') || has('dry')) return 0;
  logger.info(`run ${runId}: spent $${out.data.spentUsd.toFixed(2)} (CLI-reported) over ${out.data.cells.length} cell(s)`);

  for (const w of runWinners(runId)) {
    logger.info(`winner (${w.taskClass}): ${w.combo.model}/${w.combo.effort} median ${w.medianScore} of ${w.draws} draws`);
    if (has('write-winners')) {
      setModelPolicy(w.taskClass, w.combo, 'benchmark', w.medianScore);
      logger.info(`  wrote ${w.taskClass} → ${w.combo.model}/${w.combo.effort} into model_policy`);
    }
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { logger.error('FATAL', e); process.exit(1); });
}

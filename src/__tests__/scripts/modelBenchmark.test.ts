/**
 * The model/effort benchmark harness records an honest matrix: every draw stamped with the
 * current rubric (an older stamp reads as stale), N draws per cell with their median, a cost that
 * is null — never 0, never invented — when a rate is unknown, and a budget gate that refuses before
 * any model call. The provider is stubbed throughout: no test spawns a model.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeFs = require('fs') as typeof import('fs');
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  const dbPath = `${dir}/pof-test-model-benchmark-${process.pid}.db`;
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (nodeFs.existsSync(p)) nodeFs.unlinkSync(p);
  }
  process.env.POF_DB_PATH = dbPath;
});

import Database from 'better-sqlite3';
import { getDb } from '@/lib/db';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { canonContextFor } from '@/lib/catalog/canon/canonContext';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import { getModelPolicy, isTaskClass, MODEL_IDS, type ClaudeModel } from '@/lib/model-policy';
import { ensureBenchmarkTable, getCell, isStaleBenchmark, listDraws, recordSample } from '@/lib/benchmark-db';
import {
  budgetGate, costOf, planBenchmark, resolveJudgeOfRecord, runBenchmark, SAMPLE_TASKS,
  type Combo, type Provider, type SampleTask,
} from '@/../scripts/model-benchmark';

const TASK = SAMPLE_TASKS.find((t) => t.taskId === 'produce-text:items') as SampleTask;
const SONNET_LOW: Combo = { model: 'sonnet', effort: 'low' };

/** A `claude -p --output-format json` envelope. */
function envelope(result: string, modelUsage?: Record<string, Record<string, number>>): string {
  return JSON.stringify({
    type: 'result', result, total_cost_usd: 0.01, duration_ms: 1200, session_id: 's',
    usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    ...(modelUsage ? { modelUsage } : {}),
  });
}

/** Stub provider: produce calls return a config; judge calls (the rubric prompt) return queued scores. */
function stubProvider(scores: number[], produceUsage?: Record<string, Record<string, number>>) {
  const calls: { prompt: string; model: ClaudeModel }[] = [];
  const provider: Provider = async (prompt, model) => {
    calls.push({ prompt, model });
    if (prompt.includes('THE ASSET TO JUDGE')) {
      const score = scores.shift() ?? 0;
      return envelope(JSON.stringify({ dimensions: {}, score, verdict: score >= 90 ? 'pass' : 'fail', findings: 'f', fix: 'x' }));
    }
    return envelope('{"name":"Ironbrand Falchion","buyPrice":120,"sellPrice":30}', produceUsage);
  };
  return { provider, calls };
}

const noMeter = () => {};

describe('(a) rubric_version', () => {
  it('stamps a written row with the current RUBRIC_VERSION, and a differing version reads as stale', () => {
    recordSample({ runId: 'r-a', taskClass: 'produce-text', model: 'sonnet', effort: 'low', taskId: 't', draw: 1, score: 80, costUsd: 0.01 });
    const [row] = listDraws('r-a');
    expect(row.rubricVersion).toBe(RUBRIC_VERSION);
    expect(isStaleBenchmark(row)).toBe(false);

    getDb().prepare('UPDATE model_benchmarks SET rubric_version = ? WHERE run_id = ?').run(RUBRIC_VERSION - 1, 'r-a');
    const [old] = listDraws('r-a');
    expect(old.rubricVersion).toBe(RUBRIC_VERSION - 1);
    expect(isStaleBenchmark(old)).toBe(true);
    expect(getCell({ runId: 'r-a', taskClass: 'produce-text', model: 'sonnet', effort: 'low', taskId: 't' }).stale).toBe(true);
  });

  it('migrates an old-shape table idempotently: legacy rows survive, unstamped, and read as stale', () => {
    const mem = new Database(':memory:');
    mem.exec(`CREATE TABLE model_benchmarks (task_class TEXT NOT NULL, model TEXT NOT NULL, effort TEXT NOT NULL,
      task_id TEXT NOT NULL, score INTEGER NOT NULL, tokens INTEGER, wall_ms INTEGER,
      ran_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (task_class, model, effort, task_id))`);
    mem.prepare("INSERT INTO model_benchmarks (task_class, model, effort, task_id, score) VALUES ('produce-text','opus','medium','produce-text:items',79)").run();
    ensureBenchmarkTable(mem);
    ensureBenchmarkTable(mem);
    const rows = mem.prepare('SELECT * FROM model_benchmarks').all() as { score: number; rubric_version: number | null; draw: number; run_id: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ score: 79, rubric_version: null, draw: 1, run_id: 'legacy' });
    expect(isStaleBenchmark({ rubricVersion: rows[0].rubric_version })).toBe(true);
    mem.close();
  });
});

describe('(b) median-of-N draws', () => {
  it('records three draws for a cell and its median score', async () => {
    const { provider } = stubProvider([70, 92, 81]);
    const out = await runBenchmark({ tasks: [TASK], combos: [SONNET_LOW], drawsPerCell: 3, budgetUsd: 100, planOnly: false, runId: 'r-b', provider, meter: noMeter });
    expect(out.ok).toBe(true);
    const draws = listDraws('r-b');
    expect(draws.map((d) => d.draw)).toEqual([1, 2, 3]);
    expect(draws.map((d) => d.score)).toEqual([70, 92, 81]);
    const cell = getCell({ runId: 'r-b', taskClass: 'produce-text', model: 'sonnet', effort: 'low', taskId: TASK.taskId });
    expect(cell.draws).toHaveLength(3);
    expect(cell.medianScore).toBe(81);
  });

  it('judges through the judge of record, with the v4 canon-aware rubric', async () => {
    const { provider, calls } = stubProvider([80]);
    await runBenchmark({ tasks: [TASK], combos: [SONNET_LOW], drawsPerCell: 1, budgetUsd: 100, planOnly: false, runId: 'r-b2', provider, meter: noMeter });
    const judgeCall = calls.find((c) => c.prompt.includes('THE ASSET TO JUDGE'))!;
    const pol = getModelPolicy('judge-content');
    expect(judgeCall.model).toBe(pol.model);
    expect(judgeCall.prompt).toContain(canonContextFor(CANON_SEED, 'items'));
    expect(listDraws('r-b2')[0].judgeModelId).toBe(MODEL_IDS[pol.model]);
    expect(resolveJudgeOfRecord().modelId).toBe(MODEL_IDS[pol.model]);
  });

  it('runs at least five task classes, all declared by model-policy', () => {
    const classes = new Set(SAMPLE_TASKS.map((t) => t.taskClass));
    expect(classes.size).toBeGreaterThanOrEqual(5);
    for (const c of classes) expect(isTaskClass(c)).toBe(true);
  });
});

describe('(c) cost', () => {
  it('computes cost from returned tokens for a priced model', async () => {
    const { provider } = stubProvider([85], { 'claude-sonnet-5': { inputTokens: 1000, outputTokens: 500 } });
    await runBenchmark({ tasks: [TASK], combos: [SONNET_LOW], drawsPerCell: 1, budgetUsd: 100, planOnly: false, runId: 'r-c1', provider, meter: noMeter });
    const [row] = listDraws('r-c1');
    expect(row.costUsd).toBeCloseTo((1000 * 2 + 500 * 10) / 1e6, 10);
    expect(row.tokens).toBe(1500);
  });

  it('records null — not 0, not invented — when the served model has no rate', async () => {
    const { provider } = stubProvider([85], { 'claude-unpriced-9': { inputTokens: 1000, outputTokens: 500 } });
    await runBenchmark({ tasks: [TASK], combos: [SONNET_LOW], drawsPerCell: 1, budgetUsd: 100, planOnly: false, runId: 'r-c2', provider, meter: noMeter });
    const [row] = listDraws('r-c2');
    expect(row.costUsd).toBeNull();
    expect(getCell({ runId: 'r-c2', taskClass: 'produce-text', model: 'sonnet', effort: 'low', taskId: TASK.taskId }).costUsd).toBeNull();
  });

  it('is null when a token kind (cache) has no documented rate', () => {
    expect(costOf([{ modelId: 'claude-sonnet-5', input: 10, output: 10, cacheRead: 5, cacheWrite: 0 }])).toBeNull();
    expect(costOf([{ modelId: 'claude-sonnet-5', input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }])).toBe(0);
  });
});

describe('(d) budget gate and --plan', () => {
  const judge = resolveJudgeOfRecord();

  it('refuses an over-budget plan, and a run with no budget', () => {
    const plan = planBenchmark(SAMPLE_TASKS, [SONNET_LOW], 3, judge);
    expect(plan.draws).toBe(SAMPLE_TASKS.length * 3);
    expect(plan.estUsd).toBeGreaterThan(0);
    expect(budgetGate(plan, plan.estUsd! / 2).ok).toBe(false);
    expect(budgetGate(plan, undefined).ok).toBe(false);
    expect(budgetGate(plan, plan.estUsd! * 2).ok).toBe(true);
  });

  it('makes zero provider calls when refused over budget', async () => {
    const { provider, calls } = stubProvider([90]);
    const out = await runBenchmark({ tasks: [TASK], combos: [SONNET_LOW], drawsPerCell: 3, budgetUsd: 0.000001, planOnly: false, runId: 'r-d1', provider, meter: noMeter });
    expect(out.ok).toBe(false);
    expect(calls).toHaveLength(0);
    expect(listDraws('r-d1')).toHaveLength(0);
  });

  it('--plan prints the plan and makes zero provider calls, even with no budget', async () => {
    const { provider, calls } = stubProvider([90]);
    const out = await runBenchmark({ tasks: SAMPLE_TASKS, combos: [SONNET_LOW], drawsPerCell: 3, planOnly: true, runId: 'r-d2', provider, meter: noMeter });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.plan.spawns).toBe(SAMPLE_TASKS.length * 3 * 2);
    expect(calls).toHaveLength(0);
  });
});

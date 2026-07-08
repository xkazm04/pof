import { getDb } from '@/lib/db';
import type { TaskClass } from '@/lib/model-policy';

/**
 * Model benchmark results (Quality Program WS3). Each row is one judged sample: a task run at a
 * (model, effort) combo, scored by the strict WS2 judge. The /status Models panel aggregates
 * these (median score, cost) per (taskClass, model, effort); the winner is written back into
 * model_policy so defaults become data-driven.
 */
export interface BenchmarkSample {
  taskClass: TaskClass;
  model: string;
  effort: string;
  taskId: string;   // which sample task (e.g. 'produce-text:items')
  score: number;    // strict-judge score 0-100
  tokens?: number;
  wallMs?: number;
  ranAt?: string;
}

export interface BenchmarkAgg {
  taskClass: string;
  model: string;
  effort: string;
  samples: number;
  medianScore: number;
  avgTokens: number;
  avgWallMs: number;
}

let ensured = false;
function ensureTable() {
  if (ensured) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS model_benchmarks (
      task_class TEXT NOT NULL,
      model TEXT NOT NULL,
      effort TEXT NOT NULL,
      task_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      tokens INTEGER,
      wall_ms INTEGER,
      ran_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (task_class, model, effort, task_id)
    )
  `);
  ensured = true;
}

export function recordSample(s: BenchmarkSample): void {
  ensureTable();
  getDb().prepare(`
    INSERT INTO model_benchmarks (task_class, model, effort, task_id, score, tokens, wall_ms, ran_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT (task_class, model, effort, task_id) DO UPDATE SET
      score = excluded.score, tokens = excluded.tokens, wall_ms = excluded.wall_ms, ran_at = excluded.ran_at
  `).run(s.taskClass, s.model, s.effort, s.taskId, Math.round(s.score), s.tokens ?? null, s.wallMs ?? null);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Aggregate all samples into per-(taskClass, model, effort) medians. */
export function listBenchmarks(): BenchmarkAgg[] {
  ensureTable();
  const rows = getDb().prepare('SELECT * FROM model_benchmarks').all() as Record<string, unknown>[];
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const k = `${r.task_class}|${r.model}|${r.effort}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const out: BenchmarkAgg[] = [];
  for (const [k, rs] of groups) {
    const [taskClass, model, effort] = k.split('|');
    const scores = rs.map((r) => Number(r.score));
    const tokens = rs.map((r) => Number(r.tokens ?? 0)).filter(Boolean);
    const walls = rs.map((r) => Number(r.wall_ms ?? 0)).filter(Boolean);
    out.push({
      taskClass, model, effort, samples: rs.length,
      medianScore: median(scores),
      avgTokens: tokens.length ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length) : 0,
      avgWallMs: walls.length ? Math.round(walls.reduce((a, b) => a + b, 0) / walls.length) : 0,
    });
  }
  return out.sort((a, b) => a.taskClass.localeCompare(b.taskClass) || b.medianScore - a.medianScore);
}

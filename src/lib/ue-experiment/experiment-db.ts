/**
 * Experiment run history — persistent snapshots of UE Experiment Lab runs so the
 * user can browse past runs and A-B compare a baseline vs a variant. Rows live in
 * `experiment_runs` alongside the rest of `~/.pof/pof.db` (own `ensureTable`, the
 * harness-runs-db pattern). The in-memory job store stays ephemeral for polling;
 * this is the durable record.
 */
import { getDb } from '@/lib/db';
import type { ExperimentResult, ExperimentSpec, ObservationSummary } from './runner';

type Verdict = { status: 'pass' | 'fail'; detail: string };

export interface ExperimentRunSummary {
  id: string;
  createdAt: string;
  mode: 'python' | 'scenario';
  ok: boolean;
  error: string | null;
  durationMs: number;
  hasScreenshot: boolean;
  label: string;
}

export interface ExperimentRunDetail extends ExperimentRunSummary {
  spec: ExperimentSpec;
  markers: Record<string, string>;
  observationSummary: ObservationSummary | null;
  verdict: Verdict | null;
  behavioralVerdict: Verdict | null;
  screenshotPath: string | null;
}

/** A short human label for a run, derived from its spec. Pure. */
export function labelForSpec(spec: ExperimentSpec): string {
  if (spec.scenario) {
    const asserts = (spec.scenario.assert ?? []).map((a) => a.kind).join(',');
    return `scenario ${spec.scenario.map ?? '(default map)'}${asserts ? ` [${asserts}]` : ''}`;
  }
  const firstLine = spec.python.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
  return firstLine ? firstLine.slice(0, 80) : 'python';
}

function ensureTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS experiment_runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('python','scenario')),
      ok INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      label TEXT NOT NULL DEFAULT '',
      screenshot_path TEXT,
      spec_json TEXT NOT NULL DEFAULT '{}',
      markers_json TEXT NOT NULL DEFAULT '{}',
      observation_summary_json TEXT,
      verdict_json TEXT,
      behavioral_verdict_json TEXT
    )
  `);
  getDb().exec(`CREATE INDEX IF NOT EXISTS idx_experiment_runs_created ON experiment_runs(created_at DESC)`);
}

export interface SaveRunInput {
  id: string;
  createdAt: string;
  spec: ExperimentSpec;
  result: ExperimentResult;
}

export function saveExperimentRun(input: SaveRunInput): void {
  ensureTable();
  const { id, createdAt, spec, result } = input;
  getDb().prepare(`
    INSERT OR REPLACE INTO experiment_runs (
      id, created_at, mode, ok, error, duration_ms, label, screenshot_path,
      spec_json, markers_json, observation_summary_json, verdict_json, behavioral_verdict_json
    ) VALUES (
      @id, @created_at, @mode, @ok, @error, @duration_ms, @label, @screenshot_path,
      @spec_json, @markers_json, @observation_summary_json, @verdict_json, @behavioral_verdict_json
    )
  `).run({
    id,
    created_at: createdAt,
    mode: spec.scenario ? 'scenario' : 'python',
    ok: result.ok ? 1 : 0,
    error: result.error ?? null,
    duration_ms: result.durationMs,
    label: labelForSpec(spec),
    screenshot_path: result.screenshotPath ?? null,
    spec_json: JSON.stringify(spec),
    markers_json: JSON.stringify(result.markers ?? {}),
    observation_summary_json: result.observationSummary ? JSON.stringify(result.observationSummary) : null,
    verdict_json: result.verdict ? JSON.stringify(result.verdict) : null,
    behavioral_verdict_json: result.behavioralVerdict ? JSON.stringify(result.behavioralVerdict) : null,
  });
}

function rowToSummary(row: Record<string, unknown>): ExperimentRunSummary {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    mode: row.mode as 'python' | 'scenario',
    ok: (row.ok as number) === 1,
    error: (row.error as string | null) ?? null,
    durationMs: (row.duration_ms as number) ?? 0,
    hasScreenshot: !!(row.screenshot_path as string | null),
    label: (row.label as string) ?? '',
  };
}

function parse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export function listExperimentRuns(limit = 50): ExperimentRunSummary[] {
  ensureTable();
  const lim = Math.min(Math.max(limit, 1), 500);
  const rows = getDb()
    .prepare(`SELECT id, created_at, mode, ok, error, duration_ms, label, screenshot_path FROM experiment_runs ORDER BY created_at DESC LIMIT ?`)
    .all(lim) as Record<string, unknown>[];
  return rows.map(rowToSummary);
}

export function getExperimentRun(id: string): ExperimentRunDetail | null {
  ensureTable();
  const row = getDb().prepare('SELECT * FROM experiment_runs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ...rowToSummary(row),
    spec: parse<ExperimentSpec>(row.spec_json as string, { python: '' }),
    markers: parse<Record<string, string>>(row.markers_json as string, {}),
    observationSummary: parse<ObservationSummary | null>(row.observation_summary_json as string | null, null),
    verdict: parse<Verdict | null>(row.verdict_json as string | null, null),
    behavioralVerdict: parse<Verdict | null>(row.behavioral_verdict_json as string | null, null),
    screenshotPath: (row.screenshot_path as string | null) ?? null,
  };
}

export function deleteExperimentRun(id: string): boolean {
  ensureTable();
  return getDb().prepare('DELETE FROM experiment_runs WHERE id = ?').run(id).changes > 0;
}

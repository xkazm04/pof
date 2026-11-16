/**
 * `GET /api/games/[gameId]/build-health` — the wire shape (ticket F-10). Pure: no Node imports, so
 * the Game home panel imports these types and the budget logic without pulling `fs` into a client
 * bundle (the server half is `buildHealth.ts`).
 *
 * One row per `GodotEvidenceKind`, each PoF's verdict over the game-written evidence file
 * (`readGodotEvidence`), plus the root, the game HEAD and one aggregate. A game that is not on
 * Godot, or whose root is not on disk, is `binding: 'unbound'` with a reason: an honest payload,
 * never an error and never a fake zero.
 */
import type { GodotBenchMetric, GodotEvidenceCounts, GodotEvidenceKind } from './evidenceTypes';

/** The row's display state. `stale` and `absent` are the two common deferrals, named apart. */
export type BuildHealthState = 'pass' | 'fail' | 'stale' | 'absent' | 'deferred';

export interface BuildHealthRow {
  kind: GodotEvidenceKind;
  /** PoF's verdict (`GodotEvidenceVerdict.status`). */
  status: 'pass' | 'fail' | 'deferred';
  state: BuildHealthState;
  detail: string;
  reason?: string;
  /** The rest are copied from the evidence file when it parsed; omitted otherwise. */
  builtAt?: string;
  commit?: string;
  godotVersion?: string;
  counts?: GodotEvidenceCounts;
  metrics?: Record<string, number>;
}

export interface BuildHealthAggregate {
  /** Any fail → fail; every kind pass → pass; unbound → unbound; otherwise deferred. */
  status: 'pass' | 'fail' | 'deferred' | 'unbound';
  total: number;
  pass: number;
  fail: number;
  stale: number;
  absent: number;
  /** Deferred for any other reason (HEAD unknown). */
  deferred: number;
}

export interface BuildHealth {
  gameId: string;
  /** The lane whose worktree's `build/evidence/` this reads (`?lane=`); OMITTED = the game's own root (main). */
  lane?: string;
  engine: 'godot' | 'ue5' | 'undecided';
  binding: 'bound' | 'unbound';
  /** Why the game is unbound. Present only when `binding: 'unbound'`. */
  reason?: string;
  /** Absolute game root, or null when unbound. */
  root: string | null;
  /** Full SHA of the game repo HEAD, or null when unknown / unbound. */
  head: string | null;
  /** ISO time of this read: row ages are `readAt - builtAt`, so the client never reads a clock. */
  readAt: string;
  rows: BuildHealthRow[];
  aggregate: BuildHealthAggregate;
}

/** The display state of one verdict. Pure. */
export function buildHealthState(status: BuildHealthRow['status'], reason: string | undefined, hasEvidence: boolean): BuildHealthState {
  if (status !== 'deferred') return status;
  if (!hasEvidence) return 'absent';
  return reason?.startsWith('stale:') ? 'stale' : 'deferred';
}

export function aggregateOf(rows: readonly BuildHealthRow[], bound: boolean): BuildHealthAggregate {
  const n = (s: BuildHealthState) => rows.filter((r) => r.state === s).length;
  const counts = { total: rows.length, pass: n('pass'), fail: n('fail'), stale: n('stale'), absent: n('absent'), deferred: n('deferred') };
  const status: BuildHealthAggregate['status'] = !bound ? 'unbound'
    : counts.fail > 0 ? 'fail'
      : rows.length > 0 && counts.pass === rows.length ? 'pass'
        : 'deferred';
  return { status, ...counts };
}

/** One STANDARDS §20 hard budget a bench metric is judged against. `limit: null` = recorded, not budgeted. */
export interface BenchBudget {
  key: GodotBenchMetric;
  label: string;
  unit: 'ms' | 'fps';
  limit: number | null;
  /** `max`: the value must be at or below `limit`; `above`: strictly above it. */
  rule: 'max' | 'above';
  note: string;
}

/** STANDARDS §20 hard limits (the WLD-08 fail line). */
export const BENCH_BUDGETS: readonly BenchBudget[] = [
  { key: 'p99CpuMs', label: 'CPU frame p99', unit: 'ms', limit: 7, rule: 'max', note: '§20: p99 7 ms or less' },
  { key: 'low1Fps', label: '1% low', unit: 'fps', limit: 45, rule: 'above', note: '§20: 1% low above 45 fps' },
  { key: 'worstSwapMs', label: 'Worst swap frame', unit: 'ms', limit: 50, rule: 'max', note: '§20: no swap-window frame over 50 ms' },
  { key: 'worstFrameMs', label: 'Worst frame', unit: 'ms', limit: null, rule: 'max', note: 'no §20 hard limit; frames over 25 ms are hitch-logged (TEL-03)' },
];

export interface BenchReading extends BenchBudget {
  /** Absent when the bench evidence omits the key. */
  value?: number;
  /** `unbudgeted` = a value with no hard limit; `missing` = the key is absent. */
  verdict: 'within' | 'over' | 'unbudgeted' | 'missing';
}

/** Judge a bench `metrics` record against `BENCH_BUDGETS`. Pure. */
export function benchReadings(metrics: Readonly<Record<string, number>> | undefined): BenchReading[] {
  return BENCH_BUDGETS.map((b) => {
    const value = metrics?.[b.key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return { ...b, verdict: 'missing' };
    if (b.limit === null) return { ...b, value, verdict: 'unbudgeted' };
    const ok = b.rule === 'max' ? value <= b.limit : value > b.limit;
    return { ...b, value, verdict: ok ? 'within' : 'over' };
  });
}

/** "3 min", "5 h", "2 d" between two ISO times; null when either does not parse. Pure. */
export function ageText(builtAt: string | undefined, readAt: string): string | null {
  if (!builtAt) return null;
  const ms = Date.parse(readAt) - Date.parse(builtAt);
  if (!Number.isFinite(ms)) return null;
  if (ms < 0) return 'in the future';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

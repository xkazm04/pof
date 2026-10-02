/**
 * Nexus signal projection — the overlay layers of the Evaluator's Nexus
 * Intelligence Map, derived from the durable tables instead of client stores.
 *
 * Pure (no DB / no React). Three sources, each carried as a {@link SourceState} so
 * a layer can tell "no data" from "could not read":
 * - `runs`     — session_analytics per-module stats (`GET /api/session-analytics?action=dashboard`)
 * - `findings` — persisted deep-eval scans, newest first (`GET /api/evaluator/results`),
 *                projected through {@link scansToReports} (the Scanner tab's projection)
 * - `patterns` — the pattern-library dashboard rows (`GET /api/pattern-library?action=dashboard`)
 *
 * Honesty rules: a field is `null` when its source is not ready (loading or failed)
 * or when the module has no data of that kind that can be measured (never evaluated,
 * no recorded runs to average, no patterns) — `null` draws no badge, `0` is only
 * ever a measured zero.
 */

import type { ModuleStats } from '@/types/session-analytics';
import type { ImplementationPattern } from '@/types/pattern-library';
import type { Recommendation } from '@/types/evaluator';
import type { ScanLike } from './scan-delta';
import { scansToReports } from './scan-report';

export type SourceStatus = 'loading' | 'ready' | 'failed';

/** One data source's read state — a failure is never an empty `ready`. */
export type SourceState<T> =
  | { state: 'loading' }
  | { state: 'ready'; data: T }
  | { state: 'failed'; error: string };

export type NexusLayerId = 'patterns' | 'builds' | 'sessions' | 'genre';

export type NexusRunStats = Pick<ModuleStats, 'moduleId' | 'totalSessions' | 'successCount' | 'avgDurationMs'>;
export type NexusPatternRow = Pick<ImplementationPattern, 'moduleId' | 'successRate'>;

export interface NexusSources {
  runs?: SourceState<readonly NexusRunStats[]>;
  findings?: SourceState<readonly ScanLike[]>;
  patterns?: SourceState<readonly NexusPatternRow[]>;
}

/** The per-module signal fields every Nexus node carries. */
export interface NexusSignal {
  /** Recorded CLI runs (session_analytics). */
  sessionCount: number | null;
  runSuccessCount: number | null;
  runSuccessRate: number | null;
  avgDurationMs: number | null;
  /** Critical findings in the newest deep eval (null = module never evaluated). */
  criticalFindings: number | null;
  /** Deep-eval health 0-100 (null = module never evaluated). */
  healthScore: number | null;
  patternSuccessRate: number | null;
  patternCount: number | null;
}

export interface NexusSignalProjection<N> {
  nodes: (N & NexusSignal)[];
  layerState: Record<NexusLayerId, SourceStatus>;
  /** The newest scan's findings as recommendations, per module. */
  recommendationsByModule: ReadonlyMap<string, Recommendation[]>;
}

const LOADING = { state: 'loading' } as const;

function readyData<T>(s: SourceState<T> | undefined): T | null {
  return s?.state === 'ready' ? s.data : null;
}

/** Map a source's data, keeping its loading / failed state. */
export function mapSource<T, U>(s: SourceState<T>, f: (data: T) => U): SourceState<U> {
  return s.state === 'ready' ? { state: 'ready', data: f(s.data) } : s;
}

function runSignals(rows: readonly NexusRunStats[] | null) {
  const byModule = new Map((rows ?? []).map((r) => [r.moduleId as string, r]));
  return (moduleId: string) => {
    if (!rows) return { sessionCount: null, runSuccessCount: null, runSuccessRate: null, avgDurationMs: null };
    const r = byModule.get(moduleId);
    if (!r || r.totalSessions === 0) {
      return { sessionCount: 0, runSuccessCount: 0, runSuccessRate: null, avgDurationMs: null };
    }
    return {
      sessionCount: r.totalSessions,
      runSuccessCount: r.successCount,
      runSuccessRate: r.successCount / r.totalSessions,
      avgDurationMs: r.avgDurationMs,
    };
  };
}

function patternSignals(rows: readonly NexusPatternRow[] | null) {
  const grouped = new Map<string, number[]>();
  for (const p of rows ?? []) {
    const list = grouped.get(p.moduleId) ?? [];
    list.push(p.successRate);
    grouped.set(p.moduleId, list);
  }
  return (moduleId: string) => {
    if (!rows) return { patternSuccessRate: null, patternCount: null };
    const rates = grouped.get(moduleId);
    if (!rates?.length) return { patternSuccessRate: null, patternCount: 0 };
    return { patternSuccessRate: rates.reduce((s, r) => s + r, 0) / rates.length, patternCount: rates.length };
  };
}

function findingSignals(scans: readonly ScanLike[] | null) {
  const reports = scans ? scansToReports(scans) : [];
  const latest = reports[reports.length - 1] ?? null;
  const scores = new Map((latest?.moduleScores ?? []).map((m) => [m.moduleId as string, m.score]));
  const recommendationsByModule = new Map<string, Recommendation[]>();
  for (const rec of latest?.recommendations ?? []) {
    const list = recommendationsByModule.get(rec.moduleId) ?? [];
    list.push(rec);
    recommendationsByModule.set(rec.moduleId, list);
  }
  const signal = (moduleId: string) => {
    const score = scores.get(moduleId);
    if (score === undefined) return { criticalFindings: null, healthScore: null };
    const recs = recommendationsByModule.get(moduleId) ?? [];
    return { criticalFindings: recs.filter((r) => r.priority === 'critical').length, healthScore: score };
  };
  return { signal, recommendationsByModule };
}

/** Project the three durable sources onto the topology nodes. */
export function projectNexusSignals<N extends { moduleId: string }>(
  nodes: readonly N[],
  sources: NexusSources,
): NexusSignalProjection<N> {
  const runs = runSignals(readyData(sources.runs));
  const patterns = patternSignals(readyData(sources.patterns));
  const findings = findingSignals(readyData(sources.findings));

  return {
    nodes: nodes.map((n) => ({
      ...n,
      ...runs(n.moduleId),
      ...patterns(n.moduleId),
      ...findings.signal(n.moduleId),
    })),
    layerState: {
      patterns: (sources.patterns ?? LOADING).state,
      builds: (sources.findings ?? LOADING).state,
      sessions: (sources.runs ?? LOADING).state,
      genre: 'ready',
    },
    recommendationsByModule: findings.recommendationsByModule,
  };
}

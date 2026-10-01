import type {
  FrameBudgetCategory,
  PerformanceFinding,
  ProfilingSummary,
} from '@/types/performance-profiling';

// ── Session compare ─────────────────────────────────────────────────────────
// The before/after diff behind the profiler's compare mode: did my fix help?
// Pure — the route feeds it two sessions' summaries and triage findings.

type MetricKey = Exclude<keyof ProfilingSummary, 'frameBudgetMs'>;

interface MetricSpec {
  key: MetricKey;
  label: string;
  unit: string;
  /** Which way is better. Declared once here, never inferred from the sign. */
  direction: 'lower' | 'higher';
  /** Measured against the frame budget, so meaningless across two budgets. */
  budgetRelative?: boolean;
}

export const COMPARED_METRICS: readonly MetricSpec[] = [
  { key: 'avgFrameMs', label: 'Avg frame', unit: 'ms', direction: 'lower' },
  { key: 'p99FrameMs', label: 'P99 frame', unit: 'ms', direction: 'lower' },
  { key: 'avgFPS', label: 'Avg FPS', unit: 'fps', direction: 'higher' },
  { key: 'minFPS', label: 'Min FPS', unit: 'fps', direction: 'higher' },
  { key: 'avgGameThreadMs', label: 'Game thread', unit: 'ms', direction: 'lower' },
  { key: 'avgRenderThreadMs', label: 'Render thread', unit: 'ms', direction: 'lower' },
  { key: 'avgGpuMs', label: 'GPU', unit: 'ms', direction: 'lower' },
  { key: 'avgDrawCallsPerFrame', label: 'Draw calls / frame', unit: '', direction: 'lower' },
  { key: 'peakMemoryMB', label: 'Peak memory', unit: 'MB', direction: 'lower' },
  { key: 'maxGcPauseMs', label: 'Max GC pause', unit: 'ms', direction: 'lower' },
  { key: 'budgetHitRate', label: 'Budget hit rate', unit: '%', direction: 'higher', budgetRelative: true },
];

/** A change within 1% of the larger magnitude is capture noise, not a verdict. */
export const NOISE_FRACTION = 0.01;

export interface MetricDelta {
  key: MetricKey;
  label: string;
  unit: string;
  direction: 'lower' | 'higher';
  base: number;
  head: number;
  delta: number;
  /** null = no verdict: within noise, or budget-relative across two budgets. */
  better: boolean | null;
}

export type CompareFinding = Pick<PerformanceFinding, 'id' | 'priority' | 'estimatedSavingsMs' | 'metricValue'>
  & Partial<Pick<PerformanceFinding, 'title' | 'metric'>>;

export interface PersistingFinding {
  id: string;
  title?: string;
  metric?: string;
  baseValue: number;
  headValue: number;
  metricDelta: number;
}

export interface FindingsDiff {
  resolved: string[];
  introduced: string[];
  persisting: PersistingFinding[];
}

export type CompareOverall = 'improved' | 'regressed' | 'mixed' | 'unchanged' | 'not-comparable';

export interface SessionComparison<F extends CompareFinding = CompareFinding> {
  comparable: boolean;
  reason?: string;
  metrics: MetricDelta[];
  findings: FindingsDiff;
  /** Full records for the resolved / introduced sets, for rendering. */
  resolvedFindings: F[];
  introducedFindings: F[];
  /** Sum of the resolved findings' estimated per-frame savings. */
  realizedSavingsMs: number;
  overall: CompareOverall;
}

/** One side of a comparison as the route reports it. */
export interface ComparedSessionHead {
  id: string;
  name: string;
  importedAt: string;
  frameBudgetMs: number;
  overallScore: number;
  bottleneck: FrameBudgetCategory | 'balanced';
}

/** The route's `compare` payload: both heads plus the diff. */
export interface SessionComparisonResponse extends SessionComparison<PerformanceFinding> {
  base: ComparedSessionHead;
  head: ComparedSessionHead;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function diffMetrics(base: Partial<ProfilingSummary>, head: Partial<ProfilingSummary>, sameBudget: boolean): MetricDelta[] {
  const rows: MetricDelta[] = [];
  for (const spec of COMPARED_METRICS) {
    const b = base[spec.key];
    const h = head[spec.key];
    if (typeof b !== 'number' || typeof h !== 'number') continue;
    const delta = round2(h - b);
    const noise = Math.abs(delta) <= NOISE_FRACTION * Math.max(Math.abs(b), Math.abs(h));
    const better = noise || (spec.budgetRelative && !sameBudget)
      ? null
      : spec.direction === 'lower' ? delta < 0 : delta > 0;
    rows.push({ key: spec.key, label: spec.label, unit: spec.unit, direction: spec.direction, base: b, head: h, delta, better });
  }
  return rows;
}

/**
 * Set-diff on the triage's stable finding ids. An id may repeat within one
 * triage (e.g. `tick-freq-${className}` from two branches), so occurrences are
 * paired in order: the n-th base occurrence persists into the n-th head one,
 * and only the unpaired extras are resolved or introduced.
 */
function diffFindings<F extends CompareFinding>(base: F[], head: F[]) {
  const headById = new Map<string, F[]>();
  for (const f of head) headById.set(f.id, [...(headById.get(f.id) ?? []), f]);

  const resolved: F[] = [];
  const persisting: PersistingFinding[] = [];
  for (const b of base) {
    const queue = headById.get(b.id);
    const h = queue?.shift();
    if (!h) { resolved.push(b); continue; }
    persisting.push({
      id: b.id, title: h.title ?? b.title, metric: h.metric ?? b.metric,
      baseValue: b.metricValue, headValue: h.metricValue, metricDelta: round2(h.metricValue - b.metricValue),
    });
  }
  const introduced = [...headById.values()].flat();
  return { resolved, introduced, persisting };
}

export function compareSessions<F extends CompareFinding>(
  base: Partial<ProfilingSummary>,
  head: Partial<ProfilingSummary>,
  baseFindings: F[] = [],
  headFindings: F[] = [],
): SessionComparison<F> {
  const sameBudget = base.frameBudgetMs === head.frameBudgetMs;
  const reason = sameBudget
    ? undefined
    : `Frame budgets differ (base ${base.frameBudgetMs} ms vs head ${head.frameBudgetMs} ms): budget-relative metrics and findings carry no verdict`;

  const metrics = diffMetrics(base, head, sameBudget);
  const { resolved, introduced, persisting } = diffFindings(baseFindings, headFindings);

  const improved = metrics.some((m) => m.better === true) || resolved.length > 0;
  const regressed = metrics.some((m) => m.better === false) || introduced.length > 0;
  const overall: CompareOverall = !sameBudget ? 'not-comparable'
    : improved && regressed ? 'mixed'
      : improved ? 'improved'
        : regressed ? 'regressed'
          : 'unchanged';

  return {
    comparable: sameBudget,
    ...(reason ? { reason } : {}),
    metrics,
    findings: {
      resolved: resolved.map((f) => f.id),
      introduced: introduced.map((f) => f.id),
      persisting,
    },
    resolvedFindings: resolved,
    introducedFindings: introduced,
    realizedSavingsMs: round2(resolved.reduce((s, f) => s + f.estimatedSavingsMs, 0)),
    overall,
  };
}

import type { PerformanceFinding, ProfileSourceType, TriageResult } from '@/types/performance-profiling';
import type { SessionComparisonResponse } from '@/lib/profiling/session-compare';
import type { FindingFixFeature } from '@/components/modules/game-director/findingFix';

// ── Debug tab optimization queue ────────────────────────────────────────────
// Pure: the newest capture's triage, ranked, with a verification state that
// only a NEWER, COMPARABLE capture can move. 'Fixed' is never asserted from a
// dispatch alone — resolution is what the capture compare says.

/** What the Debug tab's reader knows about the newest capture's triage. */
export type LatestTriage =
  | { kind: 'loading' }
  | { kind: 'no-capture' }
  | { kind: 'unavailable'; reason: string }
  | {
      kind: 'ready';
      session: { id: string; name: string; source: ProfileSourceType; importedAt: string };
      triage: TriageResult | null;
      /** Previous real capture (base) -> this one (head); null when there is none. */
      comparison: SessionComparisonResponse | null;
    };

export type QueueRowState = 'open' | 'dispatched' | 'still-present' | 'resolved' | 'synthetic';

export interface QueueRow {
  finding: PerformanceFinding;
  state: QueueRowState;
}

export interface OptimizationQueueModel {
  state: 'no-capture' | 'synthetic' | 'capture';
  rows: QueueRow[];
  /** From the compare's resolved findings; null when nothing verified it. */
  realizedSavingsMs: number | null;
  /** True only when a comparable compare of two real captures backs the states. */
  verified: boolean;
}

export interface QueueInput {
  triage: TriageResult | null;
  comparison: SessionComparisonResponse | null;
  /** finding id -> epoch ms the Fix was dispatched. */
  dispatched: Record<string, number>;
  /** The newest session's source; 'manual' is a generated sample, not a capture. */
  source?: ProfileSourceType;
}

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function byRank(a: PerformanceFinding, b: PerformanceFinding): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.estimatedSavingsMs - a.estimatedSavingsMs;
}

export function buildOptimizationQueue({ triage, comparison, dispatched, source }: QueueInput): OptimizationQueueModel {
  if (!triage) return { state: 'no-capture', rows: [], realizedSavingsMs: null, verified: false };

  const ranked = [...triage.findings].sort(byRank);
  if (source === 'manual') {
    return { state: 'synthetic', rows: ranked.map((finding) => ({ finding, state: 'synthetic' })), realizedSavingsMs: null, verified: false };
  }

  // A compare across two frame budgets carries no verdict: treat it as absent.
  const verdict = comparison && comparison.comparable ? comparison : null;
  const headAt = verdict ? Date.parse(verdict.head.importedAt) : NaN;
  const persisting = new Set(verdict?.findings.persisting.map((p) => p.id) ?? []);

  const active: QueueRow[] = ranked.map((finding) => {
    const at = dispatched[finding.id];
    if (at === undefined) return { finding, state: 'open' };
    // Still present only when a capture taken AFTER the dispatch shows it again.
    return { finding, state: persisting.has(finding.id) && headAt > at ? 'still-present' : 'dispatched' };
  });
  const resolved: QueueRow[] = verdict
    ? [...verdict.resolvedFindings].sort(byRank).map((finding) => ({ finding, state: 'resolved' }))
    : [];

  return {
    state: 'capture',
    rows: [...active, ...resolved],
    realizedSavingsMs: verdict ? verdict.realizedSavingsMs : null,
    verified: verdict !== null,
  };
}

/** The `TaskFactory.featureFix` payload for one triage finding. */
export function findingFixFeature(finding: PerformanceFinding): FindingFixFeature {
  const lines = [
    `**Performance finding (${finding.priority}):** ${finding.title}`,
    finding.description,
    '',
    `**Fix:** ${finding.fixPrompt}`,
    '',
    `**Measured:** ${finding.metric}: ${finding.metricValue} (threshold ${finding.metricThreshold}); estimated saving ~${finding.estimatedSavingsMs} ms/frame.`,
  ];
  if (finding.involvedClasses.length > 0) lines.push(`**Involved classes:** ${finding.involvedClasses.join(', ')}`);
  lines.push('', 'Verification: re-capture with the profiler after building; the Debug tab marks this resolved only when the newer capture no longer shows it.');
  return {
    featureName: finding.checklistLabel,
    status: 'partial',
    nextSteps: lines.join('\n'),
    filePaths: [],
    qualityScore: null,
  };
}

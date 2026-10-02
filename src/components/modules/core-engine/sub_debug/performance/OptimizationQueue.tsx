'use client';

import { useCallback, useMemo, useState } from 'react';
import { Activity, Hammer, Loader2 } from 'lucide-react';
import { TaskFactory } from '@/lib/cli-task';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { getAppOrigin } from '@/lib/constants';
import {
  SEVERITY_TOKENS, STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, STATUS_SUBDUED,
  withOpacity, OPACITY_10, OPACITY_30, OPACITY_90,
} from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import type { PerformanceFinding } from '@/types/performance-profiling';
import { SectionHeader, BlueprintPanel } from '@/components/modules/core-engine/unique-tabs/_design';
import { ACCENT } from '@/components/modules/core-engine/sub_debug/_shared/data';
import {
  buildOptimizationQueue, findingFixFeature,
  type LatestTriage, type QueueRow, type QueueRowState,
} from '@/components/modules/core-engine/sub_debug/_shared/optimizationQueue';

/** Triage findings are labelled for arpg-polish — the module this tab belongs to. */
const FIX_MODULE: SubModuleId = 'arpg-polish';

const STATE_COLOR: Record<QueueRowState, string> = {
  open: ACCENT, dispatched: STATUS_INFO, 'still-present': STATUS_WARNING, resolved: STATUS_SUCCESS, synthetic: STATUS_SUBDUED,
};

const PROFILER_HINT = 'Take or import one in Evaluator > Performance Profiling; its triage findings are ranked here.';

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-mono text-text-muted leading-relaxed">{children}</p>;
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="text-xs font-mono uppercase tracking-[0.15em] px-1.5 py-[2px] rounded border"
      style={{ backgroundColor: withOpacity(color, OPACITY_10), color, borderColor: withOpacity(color, OPACITY_30) }}>{children}</span>
  );
}

function FixButton({ finding, again, onDispatched }: { finding: PerformanceFinding; again: boolean; onDispatched: (id: string) => void }) {
  const cli = useModuleCLI({ moduleId: FIX_MODULE, sessionKey: `debug-perf-fix-${finding.id}`, label: `Fix: ${finding.title}`, accentColor: ACCENT });
  const handleFix = useCallback(() => {
    // Dispatch happens ONLY here, on the operator's click.
    void cli.execute(TaskFactory.featureFix(FIX_MODULE, findingFixFeature(finding), `Fix: ${finding.title}`, getAppOrigin()));
    onDispatched(finding.id);
  }, [cli, finding, onDispatched]);
  return (
    <button onClick={handleFix} disabled={cli.isRunning} aria-label={`Fix: ${finding.title}`}
      className="focus-ring inline-flex items-center gap-1.5 px-2 py-[2px] rounded border text-xs font-mono uppercase tracking-[0.15em] disabled:opacity-50"
      style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), color: ACCENT, borderColor: withOpacity(ACCENT, OPACITY_30) }}>
      {cli.isRunning ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Hammer className="w-3 h-3" aria-hidden="true" />}
      {again ? 'Fix again' : 'Fix'}
    </button>
  );
}

function RowView({ row, index, onDispatched }: { row: QueueRow; index: number; onDispatched: (id: string) => void }) {
  const { finding, state } = row;
  const sev = SEVERITY_TOKENS[finding.priority];
  const fixable = state === 'open' || state === 'dispatched' || state === 'still-present';
  return (
    <BlueprintPanel color={ACCENT} className="px-3 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-6 h-6 shrink-0 rounded grid place-items-center text-xs font-bold font-mono border"
            style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), color: ACCENT, borderColor: withOpacity(ACCENT, OPACITY_30) }}>{String(index + 1).padStart(2, '0')}</span>
          <span className="text-sm font-bold font-mono truncate" style={{ color: withOpacity(ACCENT, OPACITY_90) }}>{finding.title}</span>
        </div>
        <div className="sm:ml-auto flex items-center gap-2 flex-wrap pl-9 sm:pl-0">
          <Chip color={sev.color}>{finding.priority}</Chip>
          <Chip color={STATUS_SUCCESS}>~{finding.estimatedSavingsMs.toFixed(2)} ms</Chip>
          <Chip color={STATE_COLOR[state]}>{state}</Chip>
          {fixable && <FixButton finding={finding} again={state !== 'open'} onDispatched={onDispatched} />}
        </div>
      </div>
      <p className="text-xs text-text-muted font-mono pl-9 mt-1.5">
        {finding.metric}: {finding.metricValue} (threshold {finding.metricThreshold}) · {finding.checklistLabel}
      </p>
    </BlueprintPanel>
  );
}

function verificationNote(latest: Extract<LatestTriage, { kind: 'ready' }>, realized: number | null): string {
  const c = latest.comparison;
  if (!c) return 'No earlier real capture to compare with: a Fix is verified only by the next capture.';
  if (!c.comparable) return `Not verified against ${c.base.name}: ${c.reason ?? 'the two captures are not comparable'}.`;
  return `Verified against ${c.base.name}: ${c.findings.resolved.length} resolved, ~${(realized ?? 0).toFixed(2)} ms/frame realized.`;
}

/** The Debug tab's optimization queue: the newest capture's triage, ranked, one-click Fix, verified by re-capture. */
export function OptimizationQueue({ latest }: { latest: LatestTriage }) {
  const [dispatched, setDispatched] = useState<Record<string, number>>({});
  const onDispatched = useCallback((id: string) => setDispatched((d) => ({ ...d, [id]: Date.now() })), []);
  const ready = latest.kind === 'ready' ? latest : null;
  const queue = useMemo(() => buildOptimizationQueue({
    triage: ready?.triage ?? null, comparison: ready?.comparison ?? null, dispatched, source: ready?.session.source,
  }), [ready, dispatched]);

  let body: React.ReactNode;
  if (latest.kind === 'loading') body = <Note>Reading the newest profiler session&apos;s triage…</Note>;
  else if (latest.kind === 'no-capture') body = <Note>No profiler capture yet. {PROFILER_HINT}</Note>;
  else if (latest.kind === 'unavailable') body = <Note>Could not read the newest profiler session: {latest.reason}</Note>;
  else if (!latest.triage) body = <Note>Triage could not be run for {latest.session.name}.</Note>;
  else {
    body = (
      <>
        {queue.state === 'synthetic' ? (
          <Note>{latest.session.name} is a generated sample, so these findings are synthetic and name classes your project may not have. Import a UE capture (Evaluator &gt; Performance Profiling &gt; Import CSV) to get fixable findings.</Note>
        ) : (
          <Note>{latest.session.name}: {verificationNote(latest, queue.realizedSavingsMs)}</Note>
        )}
        {queue.rows.length === 0 && <Note>Triage found nothing over its thresholds.</Note>}
        {queue.rows.map((row, i) => <RowView key={`${row.state}:${row.finding.id}:${i}`} row={row} index={i} onDispatched={onDispatched} />)}
      </>
    );
  }

  return (
    <div className="mt-2">
      <SectionHeader label="PERF_OPTIMIZATION_QUEUE" color={ACCENT} icon={Activity} />
      <div className="space-y-3 mt-2">{body}</div>
    </div>
  );
}

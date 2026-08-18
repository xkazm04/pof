'use client';

import { StatusDot, type StatusDotState } from '@/components/ui/StatusDot';
import { MeterBar } from '@/components/ui/MeterBar';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO } from '@/lib/chart-colors';
import type { HarnessStatusResponse, HarnessRunStatus } from './types';

/** Run status → the shared StatusDot semantics (shape + glyph, not hue alone). */
const DOT_STATE: Record<HarnessRunStatus, StatusDotState> = {
  idle: 'idle',
  running: 'progress',
  paused: 'pending',
  completed: 'ok',
  error: 'fail',
};

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Spend meter tint — informational until the cap is in sight, then warn, then over. */
const spendColor = (pct: number) => (pct >= 90 ? STATUS_ERROR : pct >= 70 ? STATUS_WARNING : STATUS_INFO);

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <MicroLabel as="div" uppercase>{label}</MicroLabel>
      <div className="text-xs text-text font-mono truncate">{value}</div>
    </div>
  );
}

/**
 * Live state of the run currently held by the server: which area is in flight,
 * how far the plan has got, and what it has spent against its budget. Rendered
 * from the SAME `GET /api/harness` summary the MCP status tool reads — no second
 * source of truth.
 *
 * The feature meter is keyed to the VERIFIED numerator (gate-backed), with the
 * executor's self-report shown beside it as a separate, labelled number, so the
 * honest count is the one the bar draws.
 */
export function RunStatePanel({ status }: { status: HarnessStatusResponse }) {
  const { plan, cost } = status;
  const budget = cost?.budgetUsd ?? null;
  const spendPct = budget != null && budget > 0 ? Math.min(100, (cost!.spentUsd / budget) * 100) : 0;

  return (
    <SurfaceCard level={2} className="p-3 space-y-3" data-testid="harness-run-state" data-run-status={status.status}>
      <div className="flex items-center gap-2 flex-wrap">
        <StatusDot state={DOT_STATE[status.status]} size="md" label={`Harness ${status.status}`} />
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text">{status.status}</span>
        {status.runId && <MicroLabel mono title="Run id">{status.runId}</MicroLabel>}
        {plan?.game && <MicroLabel tone="muted">{plan.game}</MicroLabel>}
      </div>

      {!plan && (
        <p className="text-xs text-text-muted">
          No plan loaded on this server — start a run below, or resume one from its state path.
        </p>
      )}

      {plan && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Iteration" value={String(plan.iteration)} />
            <Stat label="Current area" value={plan.currentArea ?? '—'} title={plan.currentArea ?? 'No area in progress'} />
            <Stat label="Areas done" value={`${plan.completedAreas}/${plan.totalAreas}`} />
            <Stat
              label="Areas failed / gapped"
              value={`${plan.failedAreas} / ${plan.gappedAreas}`}
              title="Areas the loop abandoned, and areas it accepted with known gaps"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <MicroLabel uppercase>Areas completed</MicroLabel>
              <MicroLabel mono tone="muted">{plan.completedAreas}/{plan.totalAreas}</MicroLabel>
            </div>
            <MeterBar
              value={plan.completedAreas}
              max={Math.max(1, plan.totalAreas)}
              color={STATUS_INFO}
              ariaLabel="Areas completed"
              valueText={`${plan.completedAreas} of ${plan.totalAreas} areas completed`}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <MicroLabel uppercase>Features verified</MicroLabel>
              <MicroLabel mono tone="muted">
                {plan.verifiedFeatures}/{plan.totalFeatures} ({plan.verifiedPassRate}%) · self-reported {plan.passingFeatures}
              </MicroLabel>
            </div>
            <MeterBar
              value={plan.verifiedFeatures}
              max={Math.max(1, plan.totalFeatures)}
              color={STATUS_SUCCESS}
              ariaLabel="Features verified by a passing gate"
              valueText={`${plan.verifiedFeatures} of ${plan.totalFeatures} features verified`}
            />
          </div>
        </>
      )}

      {cost && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2" data-testid="harness-spend">
            <MicroLabel uppercase>Spend</MicroLabel>
            <MicroLabel mono tone="muted">
              {budget != null
                ? `${usd(cost.spentUsd)} of ${usd(budget)} · ${cost.sessions} sessions`
                : `${usd(cost.spentUsd)} · uncapped · ${cost.sessions} sessions`}
            </MicroLabel>
          </div>
          {budget != null ? (
            <MeterBar
              value={spendPct}
              color={spendColor}
              ariaLabel="Spend against budget"
              valueText={`${usd(cost.spentUsd)} of ${usd(budget)} spent`}
            />
          ) : (
            <p className="text-xs text-text-muted">
              This run has no spend cap, so there is no ratio to draw — only the running total above.
            </p>
          )}
          {cost.paused && (
            <p role="status" className="text-xs" style={{ color: STATUS_WARNING }}>
              The budget governor paused this run — it spent its cap. Raise the budget and resume, or leave it stopped.
            </p>
          )}
        </div>
      )}

      {status.recentEvents.length > 0 && (
        <ul className="list-none p-0 m-0 space-y-0.5" aria-label="Recent harness events">
          {status.recentEvents.slice(-4).map((e, i) => (
            <li key={`${e.type}-${i}`}>
              <MicroLabel mono>{e.type}</MicroLabel>
              {typeof e.areaId === 'string' && <MicroLabel tone="muted"> · {e.areaId}</MicroLabel>}
              {typeof e.error === 'string' && <MicroLabel tone="muted"> · {e.error}</MicroLabel>}
              {typeof e.reason === 'string' && <MicroLabel tone="muted"> · {e.reason}</MicroLabel>}
            </li>
          ))}
        </ul>
      )}
    </SurfaceCard>
  );
}

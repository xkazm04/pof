'use client';

import { ArrowUpRight, Compass, Link2, Play } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULE_COLORS, OPACITY_10, statusBorder } from '@/lib/chart-colors';
import { LIFT_DIMENSION_LABELS, type HealthLift, type LiftAction } from '@/lib/evaluator/health-lifts';

const ACCENT = MODULE_COLORS.evaluator;

/** The button text for a lift's remedy. */
export function liftActionLabel(action: LiftAction): string {
  switch (action.kind) {
    case 'review': return 'Review';
    case 'open-tab': return action.tab === 'dependencies' ? 'Dependencies tab' : 'Quality tab';
    case 'open-module': return 'Open module';
  }
}

const ACTION_ICON: Record<LiftAction['kind'], LucideIcon> = {
  review: Play,
  'open-tab': Link2,
  'open-module': ArrowUpRight,
};

interface ActProps {
  onAct: (lift: HealthLift) => void;
  /** A review is already dispatched and running — its buttons are disabled. */
  reviewBusy: boolean;
}

const buttonStyle = { backgroundColor: `${ACCENT}${OPACITY_10}`, borderColor: statusBorder(ACCENT), color: ACCENT };

/** One module's lift plan: the dimensions losing points, priced, each with its remedy. */
export function ModuleLiftList({ label, lifts, onAct, reviewBusy }: ActProps & { label: string; lifts: HealthLift[] }) {
  return (
    <section
      role="region"
      aria-label={`${label} lift plan`}
      className="mt-2 rounded-lg border border-border/60 p-3 space-y-2"
    >
      <p className="text-xs font-semibold text-text">
        {label} <span className="font-normal text-text-muted">— what raises its health, in composite points</span>
      </p>
      {lifts.length === 0 ? (
        <p className="text-xs text-text-muted">Every dimension is at 100 — nothing to lift.</p>
      ) : (
        <ul className="space-y-1.5">
          {lifts.map((lift) => {
            const Icon = ACTION_ICON[lift.action.kind];
            const busy = lift.action.kind === 'review' && reviewBusy;
            return (
              <li key={lift.dimension} className="flex items-center gap-3 text-xs">
                <span className="w-28 flex-shrink-0 text-text">
                  {LIFT_DIMENSION_LABELS[lift.dimension]} <span className="text-text-muted">{lift.value}</span>
                </span>
                <span className="flex-1 min-w-0 truncate text-text-muted" title={lift.reason}>{lift.reason}</span>
                <span className="flex-shrink-0 tabular-nums text-text-muted">
                  <span className="font-semibold text-text">+{lift.moduleGain}</span> module · +{lift.projectGain} overall
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAct(lift)}
                  className="inline-flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-md border focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
                  style={buttonStyle}
                >
                  <Icon className="w-3 h-3" aria-hidden="true" />
                  {liftActionLabel(lift.action)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The project's biggest levers beside the gauge — the top remedy is one click away. */
export function ProjectLeverStrip({ lifts, onAct, reviewBusy }: ActProps & { lifts: HealthLift[] }) {
  if (lifts.length === 0) return null;
  return (
    <div className="mt-3 flex items-center gap-1.5 flex-wrap" data-testid="pof-health-levers">
      <Compass className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} aria-hidden="true" />
      <span className="text-2xs text-text-muted uppercase tracking-wider mr-1">Biggest levers</span>
      {lifts.map((lift) => {
        const verb = liftActionLabel(lift.action);
        return (
          <button
            key={`${lift.moduleId}:${lift.dimension}`}
            type="button"
            disabled={lift.action.kind === 'review' && reviewBusy}
            onClick={() => onAct(lift)}
            title={`${lift.label}: ${lift.reason}`}
            aria-label={`${verb}: ${lift.label} ${LIFT_DIMENSION_LABELS[lift.dimension]} (+${lift.projectGain} overall)`}
            className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded border focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
            style={buttonStyle}
          >
            {lift.label} · {LIFT_DIMENSION_LABELS[lift.dimension]}
            <span className="font-semibold">+{lift.projectGain}</span>
          </button>
        );
      })}
    </div>
  );
}

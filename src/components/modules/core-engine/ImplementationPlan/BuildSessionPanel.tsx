'use client';

import { CheckCircle2, Circle, Loader2, Play, Square, X } from 'lucide-react';
import { formatEffortTime } from '@/lib/implementation-planner/effort-estimator';
import type { BuildSessionStep } from '@/lib/implementation-planner/build-session';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type { UseBuildSessionResult } from './useBuildSession';

const PRESETS = [
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '4h', minutes: 240 },
];
const shortName = (key: string) => key.slice(key.indexOf('::') + 2);

type StepMark = 'landed' | 'running' | 'queued';

function StepRow({ step, mark }: { step: BuildSessionStep; mark: StepMark }) {
  const Icon = mark === 'landed' ? CheckCircle2 : mark === 'running' ? Loader2 : Circle;
  const tone = mark === 'landed' ? 'text-green-400' : mark === 'running' ? 'text-blue-400 animate-spin' : 'text-text-muted';
  return (
    <li className="flex items-center gap-2 text-xs">
      <Icon className={`w-3 h-3 flex-shrink-0 ${tone}`} />
      <span className="flex-1 truncate text-text">{step.featureName}</span>
      <StepMeta step={step} />
    </li>
  );
}

function StepMeta({ step }: { step: BuildSessionStep }) {
  return (
    <>
      <span className="text-2xs text-text-muted">
        {step.unlockedBy ? `unlocked by ${shortName(step.unlockedBy)}` : 'ready now'}
      </span>
      <span className="text-2xs font-mono text-text-muted w-12 text-right">~{formatEffortTime(step.minutes)}</span>
    </>
  );
}

/**
 * The Build session sandbox + run view. Editing the budget or the selection only
 * recomputes the proposal; Start is the single commit that dispatches.
 */
export function BuildSessionPanel({ session, onClose }: { session: UseBuildSessionResult; onClose: () => void }) {
  const { run, proposal, budgetMinutes, excluded } = session;
  const idle = run.phase === 'idle';

  return (
    <SurfaceCard level={2} className="px-3 py-2.5 space-y-2 border-l-2" style={{ borderLeftColor: MODULE_COLORS.core }}>
      <section aria-label="Build session" className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-wider text-text-muted font-medium flex-1">Build session</span>
          <span className="text-2xs text-text-muted">minutes are estimates</span>
          {run.phase !== 'running' && (
            <button onClick={onClose} aria-label="Close build session" className="p-0.5 text-text-muted hover:text-text">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {idle && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">Budget</span>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => session.setBudgetMinutes(p.minutes)}
                  aria-pressed={budgetMinutes === p.minutes}
                  className={`px-2 py-0.5 rounded text-xs ${budgetMinutes === p.minutes ? 'bg-blue-500/15 text-blue-400' : 'text-text-muted hover:text-text hover:bg-surface-hover'}`}
                >
                  {p.label}
                </button>
              ))}
              <input
                type="number"
                min={0}
                step={15}
                aria-label="Custom budget (minutes)"
                value={budgetMinutes}
                onChange={(e) => session.setBudgetMinutes(Math.max(0, Number(e.target.value) || 0))}
                className="w-16 px-1.5 py-0.5 rounded bg-surface-hover text-xs text-text"
              />
              <span className="text-2xs text-text-muted">min</span>
            </div>

            {proposal.emptyReason ? (
              <div className="text-xs text-text-muted">{proposal.emptyReason}</div>
            ) : (
              <div className="text-xs text-text">
                {proposal.steps.length} steps · ~{formatEffortTime(proposal.totalMinutes)} ·{' '}
                <span className="text-green-400">
                  +{proposal.projected.readyAfter - proposal.projected.readyBefore} ready after
                </span>{' '}
                <span className="text-text-muted">({proposal.projected.readyAfter} ready, {proposal.projected.doneAfter} done)</span>
              </div>
            )}

            <ul className="space-y-1">
              {proposal.steps.map((step) => (
                <li key={step.key} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked onChange={() => session.toggleStep(step.key)} aria-label={`Include ${step.featureName}`} />
                  <span className="flex-1 truncate text-text">{step.featureName}</span>
                  <StepMeta step={step} />
                </li>
              ))}
              {excluded.map((key) => (
                <li key={key} className="flex items-center gap-2 text-xs text-text-muted">
                  <input type="checkbox" checked={false} onChange={() => session.toggleStep(key)} aria-label={`Include ${shortName(key)}`} />
                  <span className="flex-1 truncate line-through">{shortName(key)}</span>
                  <span className="text-2xs">deselected</span>
                </li>
              ))}
            </ul>

            <button
              onClick={session.start}
              disabled={!session.canStart}
              className="flex items-center gap-1 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded disabled:opacity-40"
            >
              <Play className="w-3 h-3" /> Start session
            </button>
          </>
        )}

        {!idle && (
          <>
            <ul className="space-y-1">
              {run.steps.map((step, i) => {
                const landed = run.phase === 'done' || i < run.index;
                const mark: StepMark = landed ? 'landed' : run.phase === 'running' && i === run.index ? 'running' : 'queued';
                return <StepRow key={step.key} step={step} mark={mark} />;
              })}
            </ul>
            <div role="status" className={`text-xs ${run.phase === 'stopped' ? 'text-amber-400' : 'text-text'}`}>
              {run.phase === 'running' && `Building ${run.steps[run.index].featureName} (${run.index + 1}/${run.steps.length})`}
              {run.phase === 'done' && `Session done: ${run.built} built`}
              {run.phase === 'stopped' && `Stopped at ${run.reason}`}
            </div>
            {run.phase === 'running' ? (
              <button onClick={session.stop} className="flex items-center gap-1 text-xs text-text-muted hover:text-text px-2 py-0.5 rounded bg-surface-hover">
                <Square className="w-3 h-3" /> Stop session
              </button>
            ) : (
              <button onClick={session.reset} className="text-xs text-blue-400 hover:text-blue-300">
                Plan another session
              </button>
            )}
          </>
        )}
      </section>
    </SurfaceCard>
  );
}

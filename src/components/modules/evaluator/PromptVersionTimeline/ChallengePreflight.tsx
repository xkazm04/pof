import { FlaskConical, X, Loader2, AlertTriangle, ArrowRight, Gavel } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { PromptDiffView } from '../PromptDiffView';
import type { ArmEvidence, ChallengeBlock, ChallengePlan } from '@/lib/prompt-evolution/challenge';
import type { VariantVersionEntry } from '@/types/prompt-evolution';
import type { Result } from '@/types/result';
import { STATUS_WARNING } from '@/lib/chart-colors';
import { ACCENT } from './constants';
import { StatsBadge } from './StatsBadge';

/**
 * The one informed decision before an experiment spends real runs: what changes
 * (diff incumbent → challenger), how it was made (mutation class), what each arm
 * already has going for it (trials + judge score, or "unjudged"), and whatever
 * blocks the start. Arm A is always the current version.
 */
export function ChallengePreflight({
  plan,
  isStarting,
  startError,
  onStart,
  onCancel,
  onOpenTests,
}: {
  plan: Result<ChallengePlan, ChallengeBlock>;
  isStarting: boolean;
  startError: string | null;
  onStart: () => void;
  onCancel: () => void;
  onOpenTests: () => void;
}) {
  return (
    <SurfaceCard level={2} className="p-3 space-y-3" data-testid="challenge-preflight">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-text min-w-0">
          <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="truncate">
            {plan.ok
              ? <>Challenge the current version: {plan.data.incumbent.variant.label} (A) vs {plan.data.challenger.variant.label} (B)</>
              : 'Challenge the current version'}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="focus-ring inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-text-muted hover:text-text transition-colors flex-shrink-0"
        >
          <X className="w-3 h-3" /> Cancel
        </button>
      </div>

      {plan.ok ? <PlanBody plan={plan.data} /> : <Blocker block={plan.error} onOpenTests={onOpenTests} />}

      {startError && (
        <p role="alert" className="text-xs" style={{ color: STATUS_WARNING }} data-testid="challenge-start-error">{startError}</p>
      )}

      {plan.ok && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-text-muted">
            Each run of this checklist item is then served A or B, and the result is booked to that arm.
          </span>
          <button
            onClick={onStart}
            disabled={isStarting}
            data-testid="challenge-start"
            className="focus-ring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white disabled:opacity-40 flex-shrink-0"
            style={{ backgroundColor: ACCENT }}
          >
            {isStarting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
            Start A/B test
          </button>
        </div>
      )}
    </SurfaceCard>
  );
}

function PlanBody({ plan }: { plan: ChallengePlan }) {
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted">
        <span>How B was made:</span>
        <Badge variant="default" className="text-xs">{plan.mutationType ?? plan.challenger.variant.origin}</Badge>
        <span>
          +{plan.diff.added} / −{plan.diff.removed} lines vs the current version
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ArmCard slot="A" role="current" entry={plan.incumbent} evidence={plan.evidence.incumbent} />
        <ArmCard slot="B" role="challenger" entry={plan.challenger} evidence={plan.evidence.challenger} />
      </div>
      <PromptDiffView before={plan.incumbent.variant.prompt} after={plan.challenger.variant.prompt} maxHeightClass="max-h-56" />
    </>
  );
}

function ArmCard({ slot, role, entry, evidence }: {
  slot: 'A' | 'B';
  role: string;
  entry: VariantVersionEntry;
  evidence: ArmEvidence;
}) {
  return (
    <div className="rounded-md border border-border p-2 space-y-1" data-testid={`challenge-arm-${slot}`}>
      <div className="flex items-center gap-1.5 text-xs text-text min-w-0">
        <span className="font-semibold">{slot}</span>
        <span className="truncate">{entry.variant.label}</span>
        <span className="text-xs text-text-muted">({role})</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatsBadge stats={entry.stats} />
        <span className="inline-flex items-center gap-1 text-xs text-text-muted" title="Judge verdicts on work this version produced">
          <Gavel className="w-3 h-3" />
          {evidence.avgScore === null
            ? 'unjudged'
            : `${Math.round(evidence.avgScore)} avg · ${evidence.passRate === null ? '—' : `${Math.round(evidence.passRate * 100)}% pass`} · ${evidence.verdicts} verdict${evidence.verdicts === 1 ? '' : 's'}`}
        </span>
      </div>
    </div>
  );
}

function Blocker({ block, onOpenTests }: { block: ChallengeBlock; onOpenTests: () => void }) {
  return (
    <div className="flex items-start gap-2 text-xs" data-testid="challenge-blocker" data-kind={block.kind}>
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: STATUS_WARNING }} />
      <div className="space-y-1">
        <p className="text-text">{block.message}</p>
        {block.kind === 'test-running' && (
          <button
            onClick={onOpenTests}
            className="focus-ring inline-flex items-center gap-1 text-xs underline"
            style={{ color: ACCENT }}
          >
            Open the running test <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

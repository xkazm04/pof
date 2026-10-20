import { AlertTriangle } from 'lucide-react';
import { PromptDiffView } from '@/components/modules/evaluator/PromptDiffView';
import { STATUS_WARNING, STATUS_SUCCESS } from '@/lib/chart-colors';
import type { AdoptionPlan } from './adoption';

/** Confirm step for adopting a decided winner: what changes, and any caution. */
export function AdoptionPreview({
  plan,
  busy,
  onConfirm,
  onCancel,
}: {
  plan: AdoptionPlan;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2.5 space-y-2 rounded-md border border-border p-2.5" data-testid="adoption-preview">
      <p className="text-xs text-text">
        {plan.incumbent
          ? `Switch from “${plan.incumbent.label}” to “${plan.winner.label}”. The next run uses the new wording.`
          : `Make “${plan.winner.label}” the version in use. The next run uses it.`}
      </p>
      {plan.caution && (
        <p className="flex items-start gap-1.5 text-xs text-text" data-testid="adoption-caution">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: STATUS_WARNING }} />
          {plan.caution}
        </p>
      )}
      {plan.diff.before !== null && !plan.diff.identical && (
        <PromptDiffView before={plan.diff.before} after={plan.diff.after} maxHeightClass="max-h-48" />
      )}
      {plan.diff.identical && <p className="text-xs text-text-muted">The wording is identical to the current one.</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={onConfirm}
          disabled={busy}
          className="focus-ring px-3 py-1.5 text-xs font-medium rounded-md text-white disabled:opacity-50"
          style={{ backgroundColor: STATUS_SUCCESS }}
        >
          {busy ? 'Adopting…' : 'Confirm adopt'}
        </button>
        <button onClick={onCancel} disabled={busy} className="focus-ring px-3 py-1.5 text-xs rounded-md text-text-muted hover:text-text">
          Cancel
        </button>
      </div>
    </div>
  );
}

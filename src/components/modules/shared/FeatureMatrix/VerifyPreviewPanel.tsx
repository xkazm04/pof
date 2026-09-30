'use client';

import { useState } from 'react';
import { ShieldCheck, ArrowRight, Loader2, X } from 'lucide-react';
import type { VerificationChange, VerificationPlan } from '@/types/pof-bridge';
import { STATUS_SUCCESS, STATUS_WARNING, statusBg, statusBorder } from '@/lib/chart-colors';
import { STATUS_CONFIG } from './constants';

const EVIDENCE_SHOWN = 3;

function pickDefaults(plan: VerificationPlan): Set<string> {
  return new Set(plan.changes.filter((c) => c.selectedByDefault).map((c) => c.featureName));
}

function StatusWord({ status }: { status: VerificationChange['from'] }) {
  if (status === null) return <span className="text-text-muted italic">no row</span>;
  return <span style={{ color: STATUS_CONFIG[status].color }}>{status}</span>;
}

function Evidence({ change, assetCount }: { change: VerificationChange; assetCount: number }) {
  if (change.evidence.length === 0) {
    return (
      <span className="text-text-muted">
        no matching asset in {assetCount} (the manifest lists assets, not C++ classes)
      </span>
    );
  }
  const extra = change.evidence.length - EVIDENCE_SHOWN;
  return (
    <span className="font-mono break-all" title={change.evidence.join('\n')}>
      {change.evidence.slice(0, EVIDENCE_SHOWN).join(', ')}
      {extra > 0 && <span className="text-text-muted"> +{extra} more</span>}
    </span>
  );
}

function ChangeRow({ change, checked, onToggle, assetCount }: {
  change: VerificationChange; checked: boolean; onToggle: () => void; assetCount: number;
}) {
  const guarded = !change.selectedByDefault;
  return (
    <li data-testid={`verify-change-${change.featureName}`} className="flex items-start gap-2 py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Write ${change.featureName}`}
        className="mt-0.5 flex-shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="font-medium text-text">{change.featureName}</span>
          <StatusWord status={change.from} />
          <ArrowRight className="w-3 h-3 text-text-muted" aria-label="to" />
          <StatusWord status={change.to} />
          {change.kind === 'downgrade' && (
            <span className="text-2xs px-1 rounded" style={{ color: STATUS_WARNING, border: `1px solid ${statusBorder(STATUS_WARNING)}` }}>
              downgrade{guarded ? ` of a ${change.fromSource} verdict — not picked by default` : ''}
            </span>
          )}
        </div>
        <div className="text-2xs"><Evidence change={change} assetCount={assetCount} /></div>
      </div>
    </li>
  );
}

/**
 * Auto-Verify preview: every flip the live manifest proposes, with the assets that
 * justify it. Nothing is written until the user clicks Apply, and only the checked
 * rows are. Downgrades of review/fix verdicts start unchecked; rules for undeclared
 * features are listed as refused, never offered.
 */
export function VerifyPreviewPanel({ plan, onApply, onClose, isApplying }: {
  plan: VerificationPlan;
  onApply: (featureNames: string[]) => void;
  onClose: () => void;
  isApplying: boolean;
}) {
  // Picks reset whenever a new plan arrives (adjust-state-on-prop-change, no effect).
  const [state, setState] = useState(() => ({ plan, picked: pickDefaults(plan) }));
  const picked = state.plan === plan ? state.picked : pickDefaults(plan);
  if (state.plan !== plan) setState({ plan, picked });

  const toggle = (name: string) => {
    const next = new Set(picked);
    if (next.has(name)) next.delete(name); else next.add(name);
    setState({ plan, picked: next });
  };
  const count = plan.changes.filter((c) => picked.has(c.featureName)).length;

  return (
    <section
      data-testid="verify-preview"
      aria-label="Auto-Verify preview"
      className="rounded-lg px-3 py-2 text-xs space-y-2"
      style={{ backgroundColor: statusBg(STATUS_SUCCESS, 0.05), border: `1px solid ${statusBorder(STATUS_SUCCESS, 0.12)}` }}
    >
      <header className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
        <span className="text-text flex-1">
          <span className="font-medium">Auto-Verify preview:</span>{' '}
          {plan.changes.length} proposed change{plan.changes.length !== 1 ? 's' : ''} from a {plan.assetCount}-asset manifest.
          {' '}Nothing is written until you apply.
        </span>
        <button type="button" onClick={onClose} aria-label="Close preview" className="text-text-muted hover:text-text">
          <X className="w-3.5 h-3.5" />
        </button>
      </header>

      {plan.changes.length === 0 ? (
        <p className="text-text-muted">Every declared feature already matches the manifest.</p>
      ) : (
        <ul className="divide-y divide-border">
          {plan.changes.map((c) => (
            <ChangeRow
              key={c.featureName}
              change={c}
              checked={picked.has(c.featureName)}
              onToggle={() => toggle(c.featureName)}
              assetCount={plan.assetCount}
            />
          ))}
        </ul>
      )}

      {plan.refused.length > 0 && (
        <p data-testid="verify-refused" className="text-2xs text-text-muted">
          Not written (rule names no declared feature): {plan.refused.map((r) => r.featureName).join(', ')}
        </p>
      )}

      <footer className="flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="px-2.5 py-1 rounded-md text-text-muted hover:text-text border border-border">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onApply(plan.changes.filter((c) => picked.has(c.featureName)).map((c) => c.featureName))}
          disabled={count === 0 || isApplying}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium disabled:opacity-50"
          style={{ backgroundColor: statusBg(STATUS_SUCCESS), color: STATUS_SUCCESS, border: `1px solid ${statusBorder(STATUS_SUCCESS)}` }}
        >
          {isApplying && <Loader2 className="w-3 h-3 animate-spin" />}
          Apply {count}
        </button>
      </footer>
    </section>
  );
}

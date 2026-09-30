'use client';

import { STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { PackageFlowState, PreflightCheckKind } from '@/lib/packaging/package-flow';

const KIND_LABEL: Record<PreflightCheckKind, string> = {
  fast: 'config + plugin audit',
  'build-verify-shipping': 'Build verify (Shipping)',
  'asset-validation': 'Asset validation',
  'build-verify-editor': 'Build verify (Editor)',
};

const BUTTON = 'px-3 py-1.5 rounded text-xs transition-colors';

/**
 * The Package flow's notice under the profile cards: what it is measuring before a
 * cook, why it blocked (with a way to run the checks it is missing, then cook), and
 * what a started cook was NOT measured on.
 */
export function PreflightGateBlock({ flow, profileName, onCancel, onOverride, onMeasureMissing }: {
  flow: PackageFlowState;
  /** Display name of the profile the flow is about. */
  profileName?: string;
  onCancel: () => void;
  onOverride: () => void;
  onMeasureMissing: () => void;
}) {
  const who = profileName ? `“${profileName}”` : 'this profile';

  if (flow.phase === 'measuring') {
    return (
      <div data-testid="pof-package-flow-measuring" className="rounded border border-border p-3 text-xs space-y-2">
        <div className="text-text">
          Measuring {flow.kinds.map((k) => KIND_LABEL[k]).join(', ')} for {who}
          {' '}({flow.maps.length > 0 ? `${flow.maps.length} map(s)` : 'GameDefaultMap'}) — the cook starts when it passes.
        </div>
        <button onClick={onCancel} className={`${BUTTON} text-text-muted hover:text-text hover:bg-surface-hover`}>Cancel</button>
      </div>
    );
  }

  if (flow.phase === 'cook') {
    if (!flow.overridden && flow.disclosedNotRun.length === 0) return null;
    return (
      <div data-testid="pof-package-flow-cook-disclosure" className="text-2xs font-mono" style={{ color: STATUS_NEUTRAL }}>
        Cooking {who}{flow.overridden ? ' over a blocked pre-flight (packaged anyway)' : ''}
        {flow.disclosedNotRun.length > 0 ? ` — not measured: ${flow.disclosedNotRun.join(', ')}` : ''}.
      </div>
    );
  }

  if (flow.phase !== 'blocked') return null;
  const measurable = flow.failingKinds.length + flow.notRunKinds.length > 0;
  return (
    <div
      data-testid="pof-preflight-gate-block"
      className="rounded border p-3 text-xs space-y-2"
      style={{ borderColor: `${STATUS_ERROR}66`, background: `${STATUS_ERROR}14` }}
    >
      <div className="font-medium" style={{ color: STATUS_ERROR }}>
        {flow.failing.length > 0
          ? `Pre-flight failed for ${who}: ${flow.failing.join(', ')} — cooking now will likely fail.`
          : `Pre-flight could not measure ${who} — no verdict, so no cook.`}
      </div>
      <div className="text-text-muted">
        Fix the red checks above, run the missing checks and cook, or package anyway if you know what you&apos;re doing.
      </div>
      {flow.notRunLabels.length > 0 && (
        <div data-testid="pof-preflight-gate-block-not-run" className="text-text-muted">
          Also never measured (no verdict either way): {flow.notRunLabels.join(', ')}.
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className={`${BUTTON} text-text-muted hover:text-text hover:bg-surface-hover`}>
          Cancel
        </button>
        {measurable && (
          <button
            onClick={onMeasureMissing}
            data-testid="pof-preflight-measure-missing"
            className={`${BUTTON} border border-border-bright text-text hover:bg-surface-hover`}
          >
            Run {flow.failingKinds.length > 0 ? 'failing + missing' : 'missing'} checks, then cook
          </button>
        )}
        <button
          onClick={onOverride}
          data-testid="pof-preflight-override"
          className={`${BUTTON} font-medium text-white`}
          style={{ background: STATUS_ERROR }}
        >
          Package anyway
        </button>
      </div>
    </div>
  );
}

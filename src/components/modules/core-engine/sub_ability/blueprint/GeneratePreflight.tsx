'use client';

import { ShieldAlert, Wrench, Wand2, X, CheckCircle2 } from 'lucide-react';
import {
  ACCENT_CYAN, STATUS_ERROR, STATUS_WARNING, STATUS_SUCCESS,
  withOpacity, OPACITY_10, OPACITY_20, OPACITY_25,
} from '@/lib/chart-colors';
import type { PreflightFix, PreflightSeverity, GeneratePreflight as Preflight } from '@/lib/ability/generate-preflight';

const SEVERITY: Record<PreflightSeverity, { color: string; label: string }> = {
  block: { color: STATUS_ERROR, label: 'Blocks' },
  override: { color: STATUS_WARNING, label: 'Override' },
  todo: { color: ACCENT_CYAN, label: 'TODO' },
};

interface Props {
  preflight: Preflight;
  onFix: (fix: PreflightFix) => void;
  onConfirm: (opts: { applyFixes: boolean }) => void;
  onDismiss: () => void;
}

/**
 * Inline review shown when "Generate GAS effects" would override, TODO or refuse
 * part of the design (see `@/lib/ability/generate-preflight`). Each finding says
 * what the run will do; fixable ones carry a Fix. Surface-only findings (a design
 * call, e.g. where the catalog damage pin lands) have no Fix by design.
 */
export function GeneratePreflight({ preflight, onFix, onConfirm, onDismiss }: Props) {
  const { findings, canGenerate } = preflight;
  const fixable = findings.some((f) => f.fix);
  const btn = 'flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-semibold transition-all';

  return (
    <div
      role="region"
      aria-label="Generate preflight"
      className="mt-2 rounded-lg p-2 space-y-1.5"
      style={{ border: `1px solid ${withOpacity(STATUS_WARNING, OPACITY_25)}`, backgroundColor: withOpacity(STATUS_WARNING, OPACITY_10) }}
    >
      <div className="flex items-center gap-1.5 text-2xs font-semibold text-text">
        {findings.length ? <ShieldAlert className="w-3.5 h-3.5" style={{ color: STATUS_WARNING }} /> : <CheckCircle2 className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />}
        {findings.length
          ? `Before this run: ${findings.length} thing${findings.length === 1 ? '' : 's'} it will change or skip`
          : 'Nothing left for the run to override'}
      </div>

      <ul className="space-y-1">
        {findings.map((f, i) => (
          <li key={`${f.kind}-${f.effectName ?? f.attribute ?? i}`} className="flex items-start gap-2 text-2xs">
            <span
              className="shrink-0 px-1.5 rounded font-mono uppercase tracking-wide"
              style={{ color: SEVERITY[f.severity].color, backgroundColor: withOpacity(SEVERITY[f.severity].color, OPACITY_20) }}
            >
              {SEVERITY[f.severity].label}
            </span>
            <span className="flex-1 text-text-muted">{f.message}</span>
            {f.fix && (
              <button type="button" onClick={() => onFix(f.fix!)} className={btn} style={{ color: ACCENT_CYAN }} title="Apply this fix to the editor">
                <Wrench className="w-3 h-3" /> Fix
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-1.5 justify-end">
        {canGenerate && fixable && (
          <button
            type="button" onClick={() => onConfirm({ applyFixes: true })} className={btn}
            style={{ color: ACCENT_CYAN, backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_10), border: `1px solid ${withOpacity(ACCENT_CYAN, OPACITY_20)}` }}
          >
            <Wand2 className="w-3 h-3" /> Fix all &amp; generate
          </button>
        )}
        {canGenerate && (
          <button type="button" onClick={() => onConfirm({ applyFixes: false })} className={`${btn} text-text-muted`}>
            {findings.length ? 'Generate anyway' : 'Generate'}
          </button>
        )}
        <button type="button" onClick={onDismiss} className={`${btn} text-text-muted`} aria-label="Close preflight">
          <X className="w-3 h-3" /> Cancel
        </button>
      </div>
    </div>
  );
}

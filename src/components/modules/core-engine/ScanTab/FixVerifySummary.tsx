'use client';

import { ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import { idsIn, type FixVerification } from '@/lib/evaluator/scan-fix-verify';
import { ACCENT } from './constants';

interface FixVerifySummaryProps {
  verification: FixVerification;
  /** Dispatches the ONE verification scan — a paid module scan, so only on this click. */
  onVerify: () => void;
  disabled: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 'es' : ''}`;

/**
 * Fix & verify, stated plainly: a fix run exiting 0 resolves nothing. Fixed
 * findings wait for Verify; the verification scan's verdict — verified, still
 * found, failed — is one line, and a scan with no record says why nothing moved.
 */
export function FixVerifySummary({ verification: v, onVerify, disabled }: FixVerifySummaryProps) {
  const fixed = idsIn(v, 'fixed').length;
  const failed = idsIn(v, 'fix-failed').length;
  const failedNote = failed > 0 ? ` · ${failed} fix run${failed !== 1 ? 's' : ''} failed` : '';

  if (v.status === 'ready-to-verify') {
    return (
      <div className="flex items-center gap-3 flex-wrap rounded-md px-3 py-2 border border-border text-xs" role="status">
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} />
        <span className="text-text">
          {`${plural(fixed, 'fix')} applied — not resolved until a re-scan stops finding them${failedNote}`}
        </span>
        <button
          onClick={onVerify}
          disabled={disabled}
          className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium border transition-colors disabled:opacity-50"
          style={{ color: ACCENT, borderColor: ACCENT }}
          title="Runs ONE module scan over the fixed findings' passes; only what it no longer finds is resolved"
        >
          <ShieldCheck className="w-3 h-3" />
          {`Verify ${plural(fixed, 'fix')}`}
        </button>
      </div>
    );
  }

  if (v.status === 'verifying') {
    return (
      <div className="flex items-center gap-2 text-xs text-text-muted" role="status">
        <Loader2 className="w-3 h-3 animate-spin" style={{ color: ACCENT }} />
        {`Verifying ${plural(idsIn(v, 'verifying').length, 'fix')} — re-scanning their passes`}
      </div>
    );
  }

  if (v.status === 'unverified') {
    return (
      <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs border" style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING }} role="status">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>{`Fixes not verified — ${v.reason ?? 'no verification scan was recorded'}. Nothing was resolved.`}</span>
      </div>
    );
  }

  if (v.status === 'settled') {
    const verified = idsIn(v, 'verified').length;
    const still = idsIn(v, 'still-present').length;
    const unverified = idsIn(v, 'unverified').length;
    const total = Object.keys(v.byId).length;
    return (
      <div className="flex items-center gap-2 flex-wrap text-xs" role="status">
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: verified > 0 ? STATUS_SUCCESS : STATUS_WARNING }} />
        <span className="font-medium text-text">
          {`Verified ${verified} of ${total} · ${still} still found · ${failed} failed${unverified > 0 ? ` · ${unverified} unverified` : ''}`}
        </span>
      </div>
    );
  }

  return null;
}

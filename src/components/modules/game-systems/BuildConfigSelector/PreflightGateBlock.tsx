'use client';

import { STATUS_ERROR } from '@/lib/chart-colors';

export function PreflightGateBlock({ visible, onCancel, onOverride }: {
  visible: boolean;
  onCancel: () => void;
  onOverride: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      data-testid="pof-preflight-gate-block"
      className="rounded border p-3 text-xs space-y-2"
      style={{ borderColor: `${STATUS_ERROR}66`, background: `${STATUS_ERROR}14` }}
    >
      <div className="font-medium" style={{ color: STATUS_ERROR }}>
        Pre-flight checks failed — cooking now will likely fail.
      </div>
      <div className="text-text-muted">
        Fix the red checks above and re-run, or package anyway if you know what you&apos;re doing.
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onOverride}
          data-testid="pof-preflight-override"
          className="px-3 py-1.5 rounded text-xs font-medium text-white transition-colors"
          style={{ background: STATUS_ERROR }}
        >
          Package anyway
        </button>
      </div>
    </div>
  );
}

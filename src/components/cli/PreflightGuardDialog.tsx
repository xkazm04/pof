'use client';

import { AlertTriangle, ShieldAlert, Coins } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { usePreflightStore } from '@/stores/preflightStore';
import { formatUsd } from '@/lib/cli-spend/format';
import { STATUS_WARNING, STATUS_ERROR, OPACITY_10 } from '@/lib/chart-colors';

/**
 * Global pre-flight budget-guard confirmation.
 *
 * Mounted once in the app shell. When an expensive CLI task is about to launch
 * under budget pressure, {@link usePreflightStore} opens this dialog and the
 * user's choice resolves the awaiting dispatch. Default (no budget configured)
 * never opens it — see `evaluatePreflight`.
 */
export function PreflightGuardDialog() {
  const pending = usePreflightStore((s) => s.pending);
  const confirm = usePreflightStore((s) => s.confirm);
  const cancel = usePreflightStore((s) => s.cancel);

  const open = pending != null;
  const danger = pending?.severity === 'danger';
  const accent = danger ? STATUS_ERROR : STATUS_WARNING;
  const Icon = danger ? ShieldAlert : AlertTriangle;

  return (
    <Modal
      open={open}
      onClose={cancel}
      className="max-w-md"
      title={
        <span className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: accent }} aria-hidden="true" />
          Budget guard
        </span>
      }
    >
      {pending && (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-text-muted-hover leading-relaxed">
              You&apos;re about to launch a{' '}
              <span className="font-medium text-text">{pending.label}</span>. Review the cost before
              continuing:
            </p>
          </div>

          {pending.estimatedCostUsd != null && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md"
              style={{ backgroundColor: `${accent}${OPACITY_10}` }}
            >
              <Coins className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} aria-hidden="true" />
              <span className="text-xs text-text">
                Estimated cost{' '}
                <span className="font-semibold" style={{ color: accent }}>
                  ~{formatUsd(pending.estimatedCostUsd)}
                </span>{' '}
                <span className="text-text-muted">
                  (avg of {pending.sampleSize} past run{pending.sampleSize === 1 ? '' : 's'})
                </span>
              </span>
            </div>
          )}

          <ul className="space-y-1.5">
            {pending.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-text-muted-hover">
                <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} aria-hidden="true" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancel}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-ring"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              className="px-3 py-1.5 text-xs font-medium rounded-md text-white transition-opacity hover:opacity-90 focus-ring"
              style={{ backgroundColor: accent }}
            >
              Launch anyway
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

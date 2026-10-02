'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { STATUS_ERROR } from '@/lib/chart-colors';
import { logger } from '@/lib/logger';
import {
  CONFIRM_IDLE, CONFIRM_PENDING, isThenable, phaseAfter, settleError, settleValue,
  type ConfirmPhase, type ConfirmSettlement,
} from '@/components/ui/confirmOutcome';

export interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the user cancels, closes, or dismisses the dialog — and once the confirmed operation succeeds. */
  onClose: () => void;
  /**
   * The confirmed operation. Return its promise (or a `Result`) and the dialog owns the
   * outcome: busy while it runs, closes only when it resolves, and on a rejection or a
   * `Result` err stays open with the reason and a Retry that re-runs this same operation.
   * A synchronous callback that returns nothing closes in the same click, as it always has.
   */
  onConfirm: () => void | Promise<unknown>;
  /** Heading (e.g. "Delete this set?"). */
  title: string;
  /** Body copy explaining the consequence. */
  description: ReactNode;
  /** Confirm button label (default "Confirm"). */
  confirmLabel?: string;
  /** Cancel button label (default "Cancel"). */
  cancelLabel?: string;
  /** Confirm button label while the operation runs (default "Working…"). */
  busyLabel?: string;
  /** Confirm button label after a failure (default "Retry"). */
  retryLabel?: string;
  /** When true, the confirm button reads as destructive (red). Default true. */
  destructive?: boolean;
}

/**
 * Accessible confirmation dialog for destructive/irreversible actions.
 *
 * Replaces native `window.confirm` (blocking, unstyled, and against project
 * convention) with the shared focus-trapping {@link Modal}. Focus lands on the
 * Cancel button by default so an accidental Enter does not confirm a destructive
 * action.
 *
 * It holds the operation it confirms (outcome rules in `confirmOutcome.ts`): the
 * confirm disarms synchronously on click, Cancel / Escape / backdrop are inert
 * while the operation runs, and a failure is shown in place, never swallowed.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busyLabel = 'Working…',
  retryLabel = 'Retry',
  destructive = true,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<ConfirmPhase>(CONFIRM_IDLE);
  // Every open/close starts from idle (state adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setPhase(CONFIRM_IDLE);
  }

  /** Set in the click handler itself so a second click in the same tick is a no-op. */
  const inFlightRef = useRef(false);
  /** Bumped on every close, so an operation that outlives its opening cannot close or fail a later one. */
  const openingRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    if (open) return;
    openingRef.current += 1;
    inFlightRef.current = false;
  }, [open]);

  // A failure re-enables the button as Retry; give it focus back (it was disabled while busy).
  useEffect(() => {
    if (phase.kind === 'failed') confirmRef.current?.focus();
  }, [phase.kind]);

  const settle = (opening: number, outcome: ConfirmSettlement) => {
    if (opening !== openingRef.current || !mountedRef.current) return;
    inFlightRef.current = false;
    if (!outcome.ok) logger.warn('confirmed action failed', { title, reason: outcome.reason });
    setPhase(phaseAfter(outcome));
    if (outcome.ok) onClose();
  };

  const handleConfirm = () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const opening = openingRef.current;
    let value: unknown;
    try {
      value = onConfirm();
    } catch (e) {
      settle(opening, settleError(e));
      return;
    }
    if (!isThenable(value)) {
      settle(opening, settleValue(value));
      return;
    }
    setPhase(CONFIRM_PENDING);
    Promise.resolve(value).then(
      (resolved) => settle(opening, settleValue(resolved)),
      (e: unknown) => settle(opening, settleError(e)),
    );
  };

  // Cancel, Escape, backdrop and the header X are inert while the operation runs.
  const guardedClose = () => {
    if (inFlightRef.current) return;
    onClose();
  };

  const pending = phase.kind === 'pending';

  return (
    <Modal
      open={open}
      onClose={guardedClose}
      title={title}
      icon={destructive ? <AlertTriangle className="w-4 h-4" style={{ color: STATUS_ERROR }} /> : undefined}
      className="max-w-md"
      initialFocusRef={cancelRef}
    >
      <p className="text-xs text-text-muted leading-relaxed">{description}</p>
      {phase.kind === 'failed' && (
        <p role="alert" className="mt-3 text-xs leading-relaxed break-words" style={{ color: STATUS_ERROR }}>
          {phase.reason}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 mt-5">
        <Button ref={cancelRef} type="button" variant="ghost" size="lg" onClick={guardedClose} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          ref={confirmRef}
          type="button"
          variant="outline"
          size="lg"
          intent={destructive ? 'danger' : 'primary'}
          loading={pending}
          loadingLabel={busyLabel}
          className="min-w-[7rem] justify-center"
          onClick={handleConfirm}
        >
          {phase.kind === 'failed' ? retryLabel : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

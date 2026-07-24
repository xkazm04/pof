'use client';

import { useRef } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { STATUS_ERROR } from '@/lib/chart-colors';

export interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the user cancels, closes, or dismisses the dialog. */
  onClose: () => void;
  /** Called when the user confirms the action. */
  onConfirm: () => void;
  /** Heading (e.g. "Delete this set?"). */
  title: string;
  /** Body copy explaining the consequence. */
  description: ReactNode;
  /** Confirm button label (default "Confirm"). */
  confirmLabel?: string;
  /** Cancel button label (default "Cancel"). */
  cancelLabel?: string;
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
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={destructive ? <AlertTriangle className="w-4 h-4" style={{ color: STATUS_ERROR }} /> : undefined}
      className="max-w-md"
      initialFocusRef={cancelRef}
    >
      <p className="text-xs text-text-muted leading-relaxed">{description}</p>
      <div className="flex items-center justify-end gap-2 mt-5">
        <Button ref={cancelRef} type="button" variant="ghost" size="lg" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          intent={destructive ? 'danger' : 'primary'}
          onClick={() => { onConfirm(); onClose(); }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

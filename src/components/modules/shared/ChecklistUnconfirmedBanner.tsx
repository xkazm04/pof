'use client';

import { InlineErrorRetry } from './InlineErrorRetry';
import type { UseChecklistCLIResult } from '@/hooks/useChecklistCLI';

/**
 * The visible face of callback truth for checklist runs: when a CLI run finished
 * but its completion callback never CONFIRMED (the `/api/checklist/complete` POST
 * was missing or failed), the item was deliberately NOT marked done — this banner
 * says so and offers the retry, instead of the old silent UI/DB divergence.
 *
 * Renders nothing while everything is confirmed, so it adds zero noise on the
 * happy path. One per `useChecklistCLI` instance; wraps the shared
 * {@link InlineErrorRetry} so failed-action feedback stays one primitive.
 */
export function ChecklistUnconfirmedBanner({ cli }: { cli: UseChecklistCLIResult }) {
  if (!cli.unconfirmedItemId) return null;
  return (
    <InlineErrorRetry
      message={`"${cli.unconfirmedItemId}" finished but its completion was never confirmed — the item was not marked done.`}
      onRetry={cli.retryUnconfirmed}
      onDismiss={cli.dismissUnconfirmed}
      dismissLabel="Dismiss unconfirmed run"
      className="mb-2"
    />
  );
}

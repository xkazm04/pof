'use client';

import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';

/**
 * The property panel's failed-write surface. A refused commit used to vanish
 * into `updateDoc`'s swallowed `null`; now it says what the server said, keeps
 * the user's value on screen, and offers the retry that re-sends it.
 */
export function SaveErrorBanner({
  error, onRetry, onDismiss,
}: { error: string | null; onRetry: () => void; onDismiss: () => void }) {
  if (!error) return null;
  return (
    <InlineErrorRetry
      message={`${error} — your change is still here.`}
      onRetry={onRetry}
      onDismiss={onDismiss}
      dismissLabel="Dismiss save error"
      dense
    />
  );
}

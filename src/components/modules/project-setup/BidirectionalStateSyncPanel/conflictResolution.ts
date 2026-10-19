import { writeKey, type Ledger } from '@/lib/ue5-bridge/sync-ledger';
import type { SyncConflict, SyncWriteOutcome } from '@/types/ue5-bridge';

export type ConflictChoice = 'keep-mine' | 'revert' | 'accept-ue5';

/** What a resolution does: re-send a value, only hide the row locally, or nothing possible. */
export type ResolutionPlan =
  | { kind: 'write'; value: unknown }
  | { kind: 'dismiss' }
  | { kind: 'unavailable' };

/** The one rule the hook and the UI share for each of the three resolutions. */
export function planResolution(conflict: SyncConflict, choice: ConflictChoice): ResolutionPlan {
  switch (choice) {
    case 'keep-mine':
      return { kind: 'write', value: conflict.written };
    case 'revert':
      // base is undefined when nothing was watched on the key at write time
      return conflict.base === undefined ? { kind: 'unavailable' } : { kind: 'write', value: conflict.base };
    case 'accept-ue5':
      return { kind: 'dismiss' };
  }
}

export type WriteOutcomeLabel = 'sent' | 'applying' | 'applied' | 'conflict' | 'not sent';

const LABELS: Record<SyncWriteOutcome, WriteOutcomeLabel> = {
  unobserved: 'sent',
  pending: 'applying',
  confirmed: 'applied',
  diverged: 'conflict',
  dropped: 'not sent',
};

/** The row-facing outcome of the latest write on one property; null when none was made. */
export function outcomeFor(writes: Ledger, objectPath: string, propertyName: string): WriteOutcomeLabel | null {
  const w = writes.get(writeKey(objectPath, propertyName));
  return w ? LABELS[w.outcome] : null;
}

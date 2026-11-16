import { Check, ArrowUp, ArrowDown, AlertTriangle, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SyncStatus } from '@/types/level-design';
import { resolveSyncPresentation, NEVER_CHECKED } from '../SyncStatusPanel';

/**
 * Sync-status indicator. Communicates state with BOTH color and a glyph (not
 * color alone) plus an accessible label, so color-blind and screen-reader users
 * can distinguish synced / diverged docs.
 *
 * The verdict (label, color, and the "synced without a hash is Never checked"
 * rule) comes from `resolveSyncPresentation`, the one implementation shared with
 * the Sync panel. The dot only adds its own glyph per status: the panel reuses one
 * triangle for doc-ahead and code-ahead, but a 12px dot needs distinct shapes.
 */
const SYNC_GLYPH: Record<SyncStatus, LucideIcon> = {
  synced: Check,
  'doc-ahead': ArrowUp,
  'code-ahead': ArrowDown,
  diverged: AlertTriangle,
  unlinked: Circle,
};

export function SyncDot({ status, lastCodeHash = null }: { status: SyncStatus; lastCodeHash?: string | null }) {
  const presentation = resolveSyncPresentation(status, lastCodeHash);
  const Icon = presentation === NEVER_CHECKED ? NEVER_CHECKED.icon : (SYNC_GLYPH[status] ?? Circle);
  const { color, label } = presentation;
  return (
    <span
      role="img"
      aria-label={`Sync status: ${label}`}
      title={label}
      className="inline-flex items-center"
      style={{ color }}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
    </span>
  );
}

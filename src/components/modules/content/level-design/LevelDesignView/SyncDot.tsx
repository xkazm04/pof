import { Check, ArrowUp, ArrowDown, AlertTriangle, Circle, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SyncStatus } from '@/types/level-design';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_INFO } from '@/lib/chart-colors';

/**
 * Sync-status indicator. Communicates state with BOTH color and a glyph (not
 * color alone) plus an accessible label, so color-blind and screen-reader users
 * can distinguish synced / diverged docs. Colors come from the STATUS_* tokens.
 */
const SYNC_DISPLAY: Record<SyncStatus, { color: string; Icon: LucideIcon; label: string }> = {
  synced: { color: STATUS_SUCCESS, Icon: Check, label: 'In sync' },
  'doc-ahead': { color: STATUS_WARNING, Icon: ArrowUp, label: 'Doc ahead of code' },
  'code-ahead': { color: STATUS_INFO, Icon: ArrowDown, label: 'Code ahead of doc' },
  diverged: { color: STATUS_ERROR, Icon: AlertTriangle, label: 'Diverged' },
  unlinked: { color: 'var(--text-muted)', Icon: Circle, label: 'Not linked' },
};

/**
 * Only the sync callback writes `lastCodeHash`, so its absence proves no
 * comparison has ever run. A `synced` dot on such a document would claim a
 * verdict nobody reached — code generation sets `synced` optimistically.
 */
const NEVER_CHECKED = { color: 'var(--text-muted)', Icon: HelpCircle, label: 'Never checked against code' } as const;

export function SyncDot({ status, lastCodeHash = null }: { status: SyncStatus; lastCodeHash?: string | null }) {
  const { color, Icon, label } = status === 'synced' && !lastCodeHash
    ? NEVER_CHECKED
    : SYNC_DISPLAY[status] ?? SYNC_DISPLAY.unlinked;
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

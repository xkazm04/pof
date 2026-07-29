'use client';

import { Button } from './ui/Button';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { RefreshOutcome } from './labPipelineStore';
import type { LabTheme } from './theme';

interface RefreshFromServerProps {
  t: LabTheme;
  /** Force a refetch and reconcile the local store against it. */
  onRefresh: () => void;
  refreshing: boolean;
  /** The GET failed — nothing was reconciled (shown via the shared error+retry banner). */
  error: string | null;
  /** What the last refresh actually did, or null when none has run for this entity. */
  outcome: RefreshOutcome | null;
  onDismiss: () => void;
}

/**
 * The lab's explicit "refresh from server" affordance.
 *
 * It exists because every other path to server truth is a SIDE EFFECT of doing something
 * else — producing, draining, resetting, or reloading the page — and hydration is add-only,
 * so a step another session changed or deleted could stay on screen indefinitely. There is
 * deliberately no poll behind this: lab modules are LRU-suspended, so a background timer
 * would fight `useSuspendableEffect`. Freshness is asked for, and the ask is always visible
 * (not conditional on a drift banner that only appears on a pass-vs-fail contradiction).
 *
 * A refresh RECONCILES rather than merges, so it always REPORTS: how many steps it adopted,
 * how many it reconciled away because the server no longer has them, and — the important
 * one — how many it deliberately left alone because they hold local work the server has not
 * got. Nothing unsynced is ever silently overwritten.
 */
export function RefreshFromServer({ t, onRefresh, refreshing, error, outcome, onDismiss }: RefreshFromServerProps) {
  return (
    <div style={{ padding: '0 18px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Button
        mono
        onClick={onRefresh}
        disabled={refreshing}
        data-testid="refresh-from-server"
        title="Re-read this entity's artifacts from the server and reconcile them with what is on screen"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {refreshing ? 'Refreshing…' : '⟳ Refresh from server'}
      </Button>
      {error && (
        <InlineErrorRetry
          dense
          message={`Refresh failed — nothing was changed: ${error}`}
          onRetry={onRefresh}
          onDismiss={onDismiss}
        />
      )}
      {!error && outcome && (
        <div
          className={t.fontMono}
          role="status"
          data-testid="refresh-outcome"
          style={{ fontSize: 12, lineHeight: 1.5, color: t.muted }}
        >
          {describeOutcome(outcome)}
          {outcome.kept.length > 0 && (
            <div style={{ color: t.warn }}>
              Kept (local only, not on the server): {outcome.kept.join(', ')}
            </div>
          )}
          {outcome.removed.length > 0 && (
            <div style={{ color: t.warn }}>
              Removed (the server no longer has): {outcome.removed.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One honest sentence for the headline counts (details are listed separately above). */
function describeOutcome(o: RefreshOutcome): string {
  const total = o.adopted.length + o.removed.length + o.kept.length + o.unchanged;
  if (total === 0) return 'The server holds no artifacts for this entity.';
  if (o.adopted.length === 0 && o.removed.length === 0 && o.kept.length === 0) {
    return `Up to date — ${o.unchanged} step${o.unchanged === 1 ? '' : 's'} match the server.`;
  }
  return [
    o.adopted.length ? `${o.adopted.length} adopted` : null,
    o.removed.length ? `${o.removed.length} removed` : null,
    o.kept.length ? `${o.kept.length} kept` : null,
    o.unchanged ? `${o.unchanged} unchanged` : null,
  ].filter(Boolean).join(' · ');
}

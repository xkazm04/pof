'use client';

import { Button } from './ui/Button';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { describeCatalogRefresh, type CatalogRefreshOutcome } from './labCatalogRefresh';
import type { LabTheme } from './theme';

/** How many changed entities are named before the rest are counted. */
const MAX_NAMED_ENTITIES = 4;

interface Props {
  t: LabTheme;
  onRefresh: () => void;
  refreshing: boolean;
  /** The GET failed — nothing was reconciled. */
  error: string | null;
  outcome: CatalogRefreshOutcome | null;
  onDismiss: () => void;
}

/**
 * The Matrix's catalog-wide "refresh from server".
 *
 * The board shows a whole catalog at once, which is exactly the scope at which another
 * session's commit, a headless drain or an MCP write goes stale — and until now the only
 * way to see any of it was a hard reload. Nothing polls behind this button (lab modules are
 * LRU-suspended; a timer would fight `useSuspendableEffect`): freshness is asked for.
 *
 * A refresh RECONCILES rather than merges, so it always REPORTS — including, most
 * importantly, the steps it deliberately left alone because they hold local work the server
 * has not got. Nothing unsynced is ever silently overwritten, and nothing is silently kept
 * either.
 */
export function RefreshCatalogFromServer({ t, onRefresh, refreshing, error, outcome, onDismiss }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, maxWidth: 460 }}>
      <Button
        mono
        onClick={onRefresh}
        disabled={refreshing}
        data-testid="refresh-catalog-from-server"
        title="Re-read every entity in this catalog from the server and reconcile it with what is on screen"
      >
        {refreshing ? 'Refreshing…' : '⟳ Refresh catalog'}
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
          data-testid="catalog-refresh-outcome"
          style={{ fontSize: 12, lineHeight: 1.5, color: t.muted, textAlign: 'right' }}
        >
          {describeCatalogRefresh(outcome)}
          {outcome.entities.length > 0 && (
            <div data-testid="catalog-refresh-detail" style={{ color: t.warn }}>
              {outcome.entities.slice(0, MAX_NAMED_ENTITIES).map((e) => (
                <div key={e.entityId}>{`${e.entityName}: ${describeEntity(e.outcome)}`}</div>
              ))}
              {outcome.entities.length > MAX_NAMED_ENTITIES && (
                <div>{`+${outcome.entities.length - MAX_NAMED_ENTITIES} more entities changed`}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The per-entity line: WHICH steps moved, and which were kept because they are local-only. */
function describeEntity(o: CatalogRefreshOutcome['entities'][number]['outcome']): string {
  return [
    o.adopted.length ? `adopted ${o.adopted.join(', ')}` : null,
    o.removed.length ? `removed ${o.removed.join(', ')} (gone from the server)` : null,
    o.kept.length ? `kept ${o.kept.join(', ')} (local only)` : null,
  ].filter(Boolean).join(' · ');
}

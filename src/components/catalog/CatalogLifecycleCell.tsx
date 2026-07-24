'use client';

import { LifecycleBadge } from '@/components/catalog/LifecycleBadge';
import type { LifecycleState } from '@/lib/catalog/types';

export interface CatalogLifecycleCellProps {
  lifecycle: LifecycleState;
  ueAssetCount: number;
  busy?: boolean;
  /** When provided, renders a run button (Generate / Regenerate / Retry) next to the badge + count. */
  onRegenerate?: () => void;
}

/**
 * The action label depends on where the entity sits in the pipeline: nothing has
 * been produced yet ("Generate"), the last step errored ("Retry"), or assets
 * exist and would be replaced ("Regenerate"). One flat "(Re)generate" made the
 * first and last cases read the same.
 */
function actionLabel(lifecycle: LifecycleState): string {
  if (lifecycle === 'planned') return 'Generate';
  if (lifecycle === 'failed') return 'Retry';
  return 'Regenerate';
}

/** "1 assets" is wrong, and "0 assets" reads as a count rather than an empty state. */
function assetCountLabel(count: number): string {
  if (count === 0) return 'No assets yet';
  return `${count} ${count === 1 ? 'asset' : 'assets'}`;
}

/**
 * Reusable cell rendering a catalog entity's lifecycle badge + generated-asset
 * count, with an optional run button. Sections drop it into their existing UI to
 * surface the catalog lifecycle columns without restructuring.
 */
export function CatalogLifecycleCell({
  lifecycle, ueAssetCount, busy, onRegenerate,
}: CatalogLifecycleCellProps) {
  const label = actionLabel(lifecycle);

  return (
    <div className="flex items-center gap-2">
      <LifecycleBadge state={lifecycle} />
      <span className="text-2xs font-mono tabular-nums text-text-muted whitespace-nowrap">
        {assetCountLabel(ueAssetCount)}
      </span>
      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          aria-busy={busy}
          // The button can drive any recipe step (author / wire / verify), so the
          // in-flight copy stays step-neutral instead of claiming "Generating".
          title={busy ? 'A generation step is running…' : `${label} this entry's UE assets`}
          className="focus-ring shrink-0 text-2xs font-mono font-bold px-1.5 py-0.5 rounded border border-border/50 text-text-muted hover:text-text disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {busy ? 'Running…' : label}
        </button>
      )}
    </div>
  );
}

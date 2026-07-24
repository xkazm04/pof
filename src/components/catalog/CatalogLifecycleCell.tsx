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
  // One string for the tooltip and the accessible name, and it always leads with
  // the visible word ("Running…" / "Generate") so the accessible name contains
  // the visible label (WCAG 2.5.3). The button can drive any recipe step
  // (author / wire / verify), so the in-flight copy stays step-neutral instead
  // of claiming "Generating".
  const hint = busy
    ? 'Running… a generation step is in progress'
    : `${label} this entry's UE assets`;

  return (
    <div className="flex items-center gap-2">
      <LifecycleBadge state={lifecycle} />
      <span className="text-2xs font-mono tabular-nums text-text-muted whitespace-nowrap">
        {assetCountLabel(ueAssetCount)}
      </span>
      {onRegenerate && (
        <button
          type="button"
          // Guarded rather than `disabled`: the run it starts is what disables it,
          // and a disabled button leaves the tab order — so the very click that
          // launched the step throws focus to <body> and a keyboard user loses
          // their place in a catalog of hundreds. aria-disabled keeps the button
          // focusable while still announcing (and behaving as) unavailable.
          onClick={() => { if (!busy) onRegenerate(); }}
          aria-disabled={busy}
          aria-busy={busy}
          // The visible word repeats on every row; the accessible name carries
          // the context the mouse-only `title` gives.
          aria-label={hint}
          title={hint}
          className={[
            'focus-ring shrink-0 inline-flex items-center h-5 px-2 rounded',
            // h-5 matches the badge's height so the two sit on one line, not a
            // 4px-off stagger repeated down the column.
            'border border-border/50 text-text-muted',
            // 12px — the readable floor. 10px (`text-2xs`) is the metadata size,
            // used for the count beside it, not for an action label.
            'text-xs font-mono font-bold',
            busy
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer hover:text-text hover:border-border',
          ].join(' ')}
        >
          {busy ? 'Running…' : label}
        </button>
      )}
    </div>
  );
}

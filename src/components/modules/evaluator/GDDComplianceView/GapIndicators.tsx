import { ChevronsLeft, ChevronsRight, Minus } from 'lucide-react';
import type { GapDirection } from '@/types/gdd-compliance';
import { statusBg, statusBorder } from '@/lib/chart-colors';
import { SIDE, DIRECTION_META, type GapSide } from './constants';

/**
 * Two-sided gap indicator. A Design▕Code split bar whose fuller, brighter half is
 * the side that's ahead, with a double-chevron leaning toward it. `variant='full'`
 * adds the Design / Code end labels (expanded-panel header); the compact variant is
 * row-sized. Carries a directional `aria-label` so the lean is not color-only.
 *
 * A gap with no measured evidence has no lean: the bar splits evenly, dims both
 * sides, and the chevron becomes a flat dash — the split must not imply a
 * direction the evidence does not support.
 */
export function GapSplitIndicator({ direction, variant = 'compact' }: {
  direction: GapDirection;
  variant?: 'compact' | 'full';
}) {
  const meta = DIRECTION_META[direction];
  const designAhead = meta.ahead === 'design';
  const unmeasured = meta.ahead === null;
  const designPct = unmeasured ? 50 : designAhead ? 66 : 34;
  const aheadColor = unmeasured ? 'var(--text-subtle)' : SIDE[meta.ahead as GapSide].color;
  const Lean = unmeasured ? Minus : designAhead ? ChevronsLeft : ChevronsRight;
  const full = variant === 'full';
  const sideOpacity = (side: GapSide) => (unmeasured ? 0.4 : meta.ahead === side ? 1 : 0.55);

  return (
    <span
      className={`inline-flex items-center ${full ? 'gap-2' : 'gap-1.5'}`}
      role="img"
      aria-label={meta.label}
    >
      {full && (
        <span
          className="text-2xs font-medium"
          style={{ color: SIDE.design.color, opacity: sideOpacity('design') }}
        >
          {SIDE.design.label}
        </span>
      )}
      <span
        className={`relative ${full ? 'w-24' : 'w-12'} h-1.5 rounded-full overflow-hidden flex bg-surface`}
        aria-hidden="true"
      >
        <span
          className="h-full transition-all duration-slow"
          style={{ width: `${designPct}%`, backgroundColor: SIDE.design.color, opacity: sideOpacity('design') }}
        />
        <span
          className="h-full transition-all duration-slow"
          style={{ width: `${100 - designPct}%`, backgroundColor: SIDE.code.color, opacity: sideOpacity('code') }}
        />
      </span>
      {full && (
        <span
          className="text-2xs font-medium"
          style={{ color: SIDE.code.color, opacity: sideOpacity('code') }}
        >
          {SIDE.code.label}
        </span>
      )}
      {!full && (
        <span
          className="inline-flex items-center text-2xs font-medium flex-shrink-0"
          style={{ color: aheadColor }}
        >
          <Lean className="w-3 h-3" aria-hidden="true" />
          {meta.short}
        </span>
      )}
    </span>
  );
}

/** One side of the gap — the "Design says" / "Code says" card, tinted to its side color. */
export function GapSideCard({ side, state, ahead }: { side: GapSide; state: string; ahead: boolean }) {
  const { color, label } = SIDE[side];
  return (
    <div
      className="p-2 rounded border bg-surface border-l-2"
      style={{ borderColor: ahead ? statusBorder(color) : 'var(--border)', borderLeftColor: color }}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="inline-flex items-center gap-1 font-medium" style={{ color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          {label} says
        </span>
        {ahead && (
          <span
            className="text-2xs px-1 py-px rounded font-medium flex-shrink-0"
            style={{ color, backgroundColor: statusBg(color), border: `1px solid ${statusBorder(color)}` }}
          >
            Ahead
          </span>
        )}
      </div>
      <p className="text-text mt-0.5">{state}</p>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { STATUS_GLYPH, STATUS_WORD, statusColor, UNPRODUCED_GLYPH, UNPRODUCED_WORD, type LabDisplayStatus } from './statusLanguage';
import type { LabTheme } from './theme';

/** Glyph for a display status (STATUS_* only knows the 4 server statuses). */
export const cellGlyphOf = (s: LabDisplayStatus) => (s === 'unproduced' ? UNPRODUCED_GLYPH : STATUS_GLYPH[s]);
/** Spoken word for a display status. */
export const cellWordOf = (s: LabDisplayStatus) => (s === 'unproduced' ? UNPRODUCED_WORD : STATUS_WORD[s]);

/**
 * CatalogMatrix cell styles, one per status (extracted from `CatalogMatrix.tsx` unchanged).
 *
 * Memoized per status (only ~5 distinct statuses) instead of allocating a fresh CSSProperties
 * object for every cell on every render — the grid is entities × steps cells, so this was
 * O(rows·cols) object churn. Built EAGERLY, not lazily: the old version populated a Map from
 * inside the returned closure, i.e. it mutated a captured local while child cells rendered.
 * There are only five statuses, so building all of them up front costs nothing and keeps render
 * a pure lookup.
 */
export function useMatrixCellStyle(t: LabTheme): (status: LabDisplayStatus) => React.CSSProperties {
  return useMemo(() => {
    const styleOf = (status: LabDisplayStatus): React.CSSProperties => {
      const filled = status === 'pass' || status === 'fail';
      // `unproduced` is the faintest cell: a dotted line border, dimmed — a distinct,
      // colorblind-safe "nothing produced here yet" cue vs pending's solid hollow ring.
      const unproduced = status === 'unproduced';
      const borderWidthStyle = status === 'deferred' ? '2px dashed' : unproduced ? '1px dotted' : '1px solid';
      return {
        width: 30, height: 30, padding: 0, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: filled ? statusColor(status, t) : 'transparent',
        border: `${borderWidthStyle} ${filled ? statusColor(status, t) : status === 'pending' || unproduced ? t.line : statusColor(status, t)}`,
        color: filled ? t.onAccent : status === 'pending' || unproduced ? t.muted : statusColor(status, t),
        opacity: unproduced ? 0.55 : 1,
        fontSize: 14, fontWeight: 700, lineHeight: 1, borderRadius: t.glass ? 5 : 0,
        transition: 'background-color 160ms ease-out, border-color 160ms ease-out',
      };
    };
    // A Record (not a Map) so this is EXHAUSTIVE by type: adding a member to
    // LabDisplayStatus is a compile error until it is listed here, so the eager
    // cache can never silently miss a status and fall through to undefined.
    const cache: Record<LabDisplayStatus, React.CSSProperties> = {
      pass: styleOf('pass'),
      fail: styleOf('fail'),
      pending: styleOf('pending'),
      deferred: styleOf('deferred'),
      unproduced: styleOf('unproduced'),
    };
    return (status: LabDisplayStatus): React.CSSProperties => cache[status];
  }, [t]);
}

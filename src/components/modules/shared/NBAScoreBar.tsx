'use client';

import type { CSSProperties } from 'react';
import type { NBARecommendation } from '@/lib/nba-engine';
import { nbaFactorSegments, nbaBreakdownAriaLabel } from '@/lib/nba-breakdown';

/**
 * NBAScoreBar — the "why-recommended" bar.
 *
 * Renders a slim segmented track under a Next Best Action recommendation: one
 * colored segment per scored factor, width-weighted by the points it
 * contributed (points are already 0–100, so each doubles as its percent
 * width). Each segment grows in from zero width on mount via the shared
 * `.meter-fill-grow` keyframe (staggered, and neutralised under
 * prefers-reduced-motion globally), and a plain-language legend reveals on
 * hover/focus so a non-technical user can read *why* the action ranks first.
 *
 * Pure presentation over {@link nbaFactorSegments}; renders nothing when the
 * breakdown is empty.
 */
export function NBAScoreBar({ rec, className = '' }: { rec: NBARecommendation; className?: string }) {
  const segments = nbaFactorSegments(rec);
  if (segments.length === 0) return null;

  return (
    <div
      className={`group relative mt-2 max-w-[16rem] ${className}`}
      tabIndex={0}
      role="img"
      aria-label={nbaBreakdownAriaLabel(rec)}
    >
      {/* Segmented track — each segment grows from 0 width, staggered */}
      <div className="flex gap-px h-1.5 rounded-full overflow-hidden bg-border">
        {segments.map((seg, i) => (
          <div
            key={seg.key}
            className="h-full flex-shrink-0 meter-fill-grow"
            style={{
              width: `${seg.points}%`,
              backgroundColor: seg.color,
              '--meter-grow-delay': `${i * 70}ms`,
            } as CSSProperties}
          />
        ))}
      </div>

      {/* Plain-language legend — revealed on hover or keyboard focus. The
          transparent top padding bridges the visual gap so moving the pointer
          from the bar onto the card never drops the hover. */}
      <div
        role="tooltip"
        className="absolute left-0 top-full z-20 w-60 pt-1.5 opacity-0 invisible translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0"
      >
        <div className="rounded-lg border border-border-bright bg-surface p-2.5 shadow-xl">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Why recommended
            </span>
            <span className="text-2xs font-mono text-text-muted">{rec.score}/100</span>
          </div>
          <ul className="space-y-1">
            {segments.map((seg) => (
              <li key={seg.key} className="flex items-center gap-2 text-2xs">
                <span
                  className="flex-shrink-0 w-2 h-2 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-text leading-snug">{seg.plain}</span>
                <span className="ml-auto flex-shrink-0 font-mono text-text-muted">
                  {seg.points}/{seg.max}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

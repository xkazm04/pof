'use client';

import {
  Clock, Hammer, Sparkles, Plug, CheckCircle, AlertOctagon, type LucideIcon,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_NEUTRAL,
  withOpacity, OPACITY_15,
} from '@/lib/chart-colors';
import { lookupGlossary } from '@/lib/ecw/glossary';
import type { LifecycleState } from '@/lib/catalog/types';

const LIFECYCLE_COLOR: Record<LifecycleState, string> = {
  planned: STATUS_NEUTRAL,
  scaffolded: STATUS_INFO,
  generated: STATUS_INFO,
  wired: STATUS_WARNING,
  verified: STATUS_SUCCESS,
  failed: STATUS_ERROR,
};

/** One glyph per state so a catalog of hundreds reads at a glance, not by color alone. */
const LIFECYCLE_ICON: Record<LifecycleState, LucideIcon> = {
  planned: Clock,
  scaffolded: Hammer,
  generated: Sparkles,
  wired: Plug,
  verified: CheckCircle,
  failed: AlertOctagon,
};

/** Mid-pipeline states get a pulsing dot to signal "work is happening here". */
const IN_FLIGHT: ReadonlySet<LifecycleState> = new Set([
  'scaffolded', 'generated', 'wired',
]);

export function LifecycleBadge({ state }: { state: LifecycleState }) {
  const color = LIFECYCLE_COLOR[state];
  const Icon = LIFECYCLE_ICON[state];
  const inFlight = IN_FLIGHT.has(state);
  // The six state names are pipeline jargon ("wired", "scaffolded"). Decode them
  // from the shared glossary — on hover and in the accessible name below —
  // rather than restating the copy here.
  const meaning = lookupGlossary(state);

  return (
    <span
      // The chip is one atomic status token (glyph + word), so it gets one
      // accessible name instead of a glyph and a bare "wired" read separately.
      // The name carries the decoder too — it used to live only in `title`,
      // i.e. mouse-hover only, leaving a screen-reader user with jargon and no
      // way to resolve it.
      role="img"
      aria-label={`Lifecycle: ${state}${meaning ? ` — ${meaning}` : ''}`}
      title={meaning ? `${state} — ${meaning}` : undefined}
      className={[
        'inline-flex items-center gap-1 h-5 px-1.5 rounded',
        'text-2xs font-mono font-bold capitalize',
        // Pulsing leading dot (::before) on in-flight states — animate-pulse is a 2s loop.
        inFlight &&
          "before:content-[''] before:size-1 before:rounded-full before:bg-current before:animate-pulse",
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ backgroundColor: withOpacity(color, OPACITY_15), color }}
    >
      {/* Both children are presentational under role="img" — the aria-label above
          is the single spoken name, so the old sr-only "Lifecycle: " prefix is
          folded into it rather than being read as a separate fragment. */}
      <Icon className="size-3 shrink-0" aria-hidden />
      {state}
    </span>
  );
}

'use client';

import { ACCENT } from '../_shared/data';
import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';

// This tile used to print "~X MB estimated" for the project's animation memory.
// Every term was a fixture: a montage count from an invented timing table, a
// blend-clip count from an invented blend space, and a bone count from a literal
// budget `current` value. Nothing read a project, so the megabytes described no
// project. Animation memory is measured in UE (Sizemap / the asset audit), not
// here — until that reaches PoF the tile says so.

export function AssetsMetric() {
  return (
    <div className="text-xs font-mono leading-tight">
      <span className="font-bold" style={{ color: ACCENT }}>unread</span>
      <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> no size measured</span>
    </div>
  );
}

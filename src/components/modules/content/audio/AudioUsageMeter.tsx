'use client';

import { Gauge, PiggyBank } from 'lucide-react';
import { MeterBar } from '@/components/ui/MeterBar';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import type { AudioUsageSummary } from '@/types/audio-asset';

/** Green under 70% of quota, amber 70–90%, red above. */
function quotaColor(pct: number): string {
  if (pct >= 90) return STATUS_ERROR;
  if (pct >= 70) return STATUS_WARNING;
  return STATUS_SUCCESS;
}

/**
 * Generation usage meter for the audio library. Bills are real provider calls
 * this month against an informational monthly budget; cache hits are calls the
 * content-hash cache let us skip (spend saved).
 *
 * The budget is INFORMATIONAL and the meter now says so on screen. A filling bar
 * that reddens at 90% reads as a limit about to stop you — but POST
 * /api/audio-gen never consults the quota, and the 200 is a default nobody
 * chose. Of the two ways to close that gap (enforce it, or state it), stating it
 * is the one that cannot refuse a generation the user never asked to have
 * limited; a silent 402 would be a new lie in place of the old one.
 */
export function AudioUsageMeter({ usage }: { usage: AudioUsageSummary }) {
  const { generated, cached, quota } = usage;
  const pct = quota > 0 ? Math.round((generated / quota) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-surface-deep p-3" data-testid="audio-usage-meter">
      <div className="flex items-center gap-2 mb-2">
        <Gauge className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Generation usage</span>
        <span className="ml-auto text-xs tabular-nums text-text" data-testid="audio-usage-count">
          {generated}
          <span className="text-text-muted"> / {quota}</span>
        </span>
      </div>

      <MeterBar
        value={generated}
        max={quota}
        color={quotaColor}
        height={6}
        ariaLabel="Monthly generations used"
        valueText={`${generated} of ${quota} generations this month (${pct}%) — informational budget, not enforced`}
      />

      <p className="mt-1.5 text-2xs text-text-muted" data-testid="audio-usage-informational">
        Informational budget — generation is never blocked at this limit.
      </p>

      <div className="flex items-center gap-1.5 mt-2 text-2xs text-text-muted" data-testid="audio-usage-saved">
        <PiggyBank className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
        <span>
          <span className="tabular-nums text-text">{cached}</span> call{cached === 1 ? '' : 's'} saved by cache this month
        </span>
      </div>
    </div>
  );
}

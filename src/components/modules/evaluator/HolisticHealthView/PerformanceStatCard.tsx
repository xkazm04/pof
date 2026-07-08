import { Gauge } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { ACCENT_EMERALD, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';

export function PerformanceStatCard({
  score,
  bottleneck,
  avgFPS,
  onDrill,
}: {
  score: number | null;
  bottleneck: string | null;
  avgFPS: number | null;
  onDrill?: () => void;
}) {
  const color = score === null
    ? STATUS_NEUTRAL
    : score >= 70
      ? ACCENT_EMERALD
      : score >= 40
        ? STATUS_WARNING
        : STATUS_ERROR;

  const subtitle = score === null
    ? 'No trace triaged'
    : bottleneck && bottleneck !== 'balanced'
      ? `${bottleneck}-bound`
      : avgFPS != null
        ? `${Math.round(avgFPS)} FPS`
        : 'balanced load';

  const inner = (
    <div className="flex items-center gap-3">
      <ProgressRing value={score ?? 0} size={48} strokeWidth={5} color={color} />
      <div className="min-w-0">
        <p className="text-2xs text-text-muted flex items-center gap-1">
          <Gauge className="w-3 h-3" /> Performance
        </p>
        <p className="text-lg font-bold text-text">{score !== null ? score : '—'}</p>
        <p className="text-2xs text-text-muted truncate">{subtitle}</p>
      </div>
    </div>
  );

  if (!onDrill) {
    return <SurfaceCard level={2}>{inner}</SurfaceCard>;
  }
  return (
    <SurfaceCard level={2}>
      <button
        type="button"
        onClick={onDrill}
        aria-label="Open performance profiling"
        className="w-full text-left rounded-md focus-ring"
      >
        {inner}
      </button>
    </SurfaceCard>
  );
}

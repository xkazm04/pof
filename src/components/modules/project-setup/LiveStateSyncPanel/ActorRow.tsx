import { Crosshair, Eye } from 'lucide-react';
import { ACCENT_PINK, ACCENT_EMERALD } from '@/lib/chart-colors';
import type { SelectedActor } from '@/types/ue5-bridge';
import { formatVec3 } from './helpers';

// ── Actor row ─────────────────────────────────────────────────────────────

interface ActorRowProps {
  actor: SelectedActor;
  /** Active watches already on this actor's object path. */
  watchCount?: number;
  /** Start a property watch on this actor; omitted when it has no object path. */
  onWatch?: () => void;
}

export function ActorRow({ actor, watchCount = 0, onWatch }: ActorRowProps) {
  return (
    <div
      data-actor-path={actor.path}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/20 hover:bg-surface/30 transition-colors"
    >
      <Crosshair className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT_PINK }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono font-bold text-text truncate">{actor.label}</div>
        <div className="text-2xs font-mono text-text-muted/60 truncate">{actor.className}</div>
      </div>
      {actor.location && (
        <span className="text-2xs font-mono text-text-muted flex-shrink-0">{formatVec3(actor.location)}</span>
      )}
      {watchCount > 0 && (
        <span className="text-2xs font-mono flex-shrink-0" style={{ color: ACCENT_EMERALD }}>
          {watchCount} watched
        </span>
      )}
      {onWatch && (
        <button
          type="button"
          onClick={onWatch}
          aria-label={`Watch a property on ${actor.label}`}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold border flex-shrink-0 transition-colors focus-ring"
          style={{ borderColor: `${ACCENT_EMERALD}40`, color: ACCENT_EMERALD }}
        >
          <Eye className="w-3 h-3" />
          Watch…
        </button>
      )}
    </div>
  );
}

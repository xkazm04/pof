import { Crosshair } from 'lucide-react';
import { ACCENT_PINK } from '@/lib/chart-colors';
import type { SelectedActor } from '@/types/ue5-bridge';
import { formatVec3 } from './helpers';

// ── Actor row ─────────────────────────────────────────────────────────────

export function ActorRow({ actor }: { actor: SelectedActor }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/20 hover:bg-surface/30 transition-colors">
      <Crosshair className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT_PINK }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono font-bold text-text truncate">{actor.label}</div>
        <div className="text-2xs font-mono text-text-muted/60 truncate">{actor.className}</div>
      </div>
      {actor.location && (
        <span className="text-2xs font-mono text-text-muted flex-shrink-0">{formatVec3(actor.location)}</span>
      )}
    </div>
  );
}

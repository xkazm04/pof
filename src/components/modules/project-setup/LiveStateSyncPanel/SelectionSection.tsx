import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { STATUS_NEUTRAL, ACCENT_PINK, OPACITY_15 } from '@/lib/chart-colors';
import type { UE5EditorSnapshot } from '@/types/ue5-bridge';
import { ActorRow } from './ActorRow';

interface SelectionSectionProps {
  snapshot: UE5EditorSnapshot;
  showSelection: boolean;
  setShowSelection: (v: boolean) => void;
}

export function SelectionSection({ snapshot, showSelection, setShowSelection }: SelectionSectionProps) {
  return (
    <div>
      <button
        type="button"
        onClick={() => setShowSelection(!showSelection)}
        aria-expanded={showSelection}
        aria-controls="lss-selection-panel"
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors focus-ring-inset"
      >
        {showSelection ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <MapPin className="w-3.5 h-3.5" style={{ color: ACCENT_PINK }} />
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT_PINK }}>
          Selected Actors
        </span>
        <span
          className="text-2xs font-mono px-1.5 py-0.5 rounded"
          style={{
            color: snapshot.selectedActors.length > 0 ? ACCENT_PINK : STATUS_NEUTRAL,
            backgroundColor: snapshot.selectedActors.length > 0 ? `${ACCENT_PINK}${OPACITY_15}` : 'transparent',
          }}
        >
          {snapshot.selectedActors.length}
        </span>
      </button>
      {showSelection && (
        <div id="lss-selection-panel" role="region" aria-label="Selected Actors" className="px-4 pb-3">
          {snapshot.selectedActors.length === 0 ? (
            <p className="text-2xs text-text-muted py-1">No actors selected in the editor</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
              {snapshot.selectedActors.map((actor, i) => (
                <ActorRow key={actor.path || i} actor={actor} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

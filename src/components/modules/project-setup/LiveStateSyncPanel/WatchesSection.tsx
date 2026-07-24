import { ChevronDown, ChevronRight, Eye, X } from 'lucide-react';
import { STATUS_ERROR, ACCENT_EMERALD } from '@/lib/chart-colors';
import type { PropertyWatchRequest, PropertyWatchUpdate } from '@/types/ue5-bridge';
import { PropertyWatchForm } from './PropertyWatchForm';

interface WatchesSectionProps {
  watchEntries: [string, PropertyWatchUpdate][];
  showWatches: boolean;
  setShowWatches: (v: boolean) => void;
  unwatchProperty: (watchId: string) => void;
  handleAddWatch: (req: PropertyWatchRequest) => void;
}

export function WatchesSection({
  watchEntries,
  showWatches,
  setShowWatches,
  unwatchProperty,
  handleAddWatch,
}: WatchesSectionProps) {
  return (
    <div>
      <button
        onClick={() => setShowWatches(!showWatches)}
        aria-expanded={showWatches}
        aria-controls="lss-watches-panel"
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
      >
        {showWatches ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <Eye className="w-3.5 h-3.5" style={{ color: ACCENT_EMERALD }} />
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT_EMERALD }}>
          Property Watches
        </span>
        <span className="text-2xs text-text-muted">{watchEntries.length}</span>
      </button>
      {showWatches && (
        <div id="lss-watches-panel" role="region" aria-label="Property Watches" className="px-4 pb-3 space-y-2">
          {/* Active watches */}
          {watchEntries.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {watchEntries.map(([watchId, update]) => (
                <div key={watchId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/20 group">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACCENT_EMERALD }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-2xs font-mono text-text-muted truncate">{update.objectPath}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-text">{update.propertyName}</span>
                      <span className="text-xs font-mono" style={{ color: ACCENT_EMERALD }}>
                        {typeof update.value === 'object' ? JSON.stringify(update.value) : String(update.value)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => unwatchProperty(watchId)}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity flex items-center justify-center touch-target"
                    style={{ color: STATUS_ERROR }}
                    aria-label={`Remove watch for ${update.propertyName}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add watch form */}
          <PropertyWatchForm onAdd={handleAddWatch} />
        </div>
      )}
    </div>
  );
}

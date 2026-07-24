import { Activity } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN,
  OPACITY_15,
  withOpacity, OPACITY_10, OPACITY_12, OPACITY_30,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { EditorAttribute, SimSnapshot } from './types';
import { CAT_COLORS } from './constants';
import { Sparkline } from './Sparkline';

export function SimGraphs({
  accent,
  attributes,
  trackableAttrs,
  trackedAttrNames,
  toggleTrack,
  snapshots,
  sparklineData,
  playbackIdx,
  eventLog,
  currentSnap,
  overrides,
}: {
  accent: string;
  attributes: EditorAttribute[];
  trackableAttrs: EditorAttribute[];
  trackedAttrNames: Set<string>;
  toggleTrack: (name: string) => void;
  snapshots: SimSnapshot[];
  sparklineData: Record<string, number[]>;
  playbackIdx: number | null;
  eventLog: { time: number; event: string }[];
  currentSnap: SimSnapshot | undefined;
  overrides: Record<string, number>;
}) {
  return (
    <div className="lg:col-span-2 space-y-3">
      {/* Attribute toggle pills */}
      <div className="flex flex-wrap gap-1">
        {trackableAttrs.map(attr => {
          const isTracked = trackedAttrNames.has(attr.name);
          const color = CAT_COLORS[attr.category];
          return (
            <button
              key={attr.id}
              onClick={() => toggleTrack(attr.name)}
              className="px-2 py-0.5 rounded-full text-xs font-mono font-medium transition-all"
              style={{
                backgroundColor: isTracked ? `${withOpacity(color, OPACITY_12)}` : 'transparent',
                color: isTracked ? color : 'var(--text-muted)',
                border: `1px solid ${isTracked ? withOpacity(color, OPACITY_30) : 'var(--border)'}`,
                opacity: isTracked ? 1 : 0.5,
              }}
            >
              {attr.name}
            </button>
          );
        })}
      </div>

      {/* Sparklines */}
      <SurfaceCard level={3} className="p-3">
        {snapshots.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-text-muted text-xs">
            <Activity className="w-4 h-4 mr-2 opacity-50" />
            Press &quot;Run Simulation&quot; to see attribute changes over time
          </div>
        ) : (
          <div className="space-y-3">
            {[...trackedAttrNames].map(name => {
              const data = sparklineData[name];
              const attr = attributes.find(a => a.name === name);
              if (!data || !attr) return null;
              const color = CAT_COLORS[attr.category];
              return (
                <Sparkline
                  key={name}
                  data={data}
                  color={color}
                  label={name}
                  currentIdx={playbackIdx}
                  width={400}
                  height={36}
                />
              );
            })}
            {trackedAttrNames.size === 0 && (
              <div className="text-xs text-text-muted italic text-center py-4">
                Select attributes above to track their changes
              </div>
            )}
          </div>
        )}
      </SurfaceCard>

      {/* Event Log + Active Tags */}
      <div className="grid grid-cols-2 gap-3">
        <SurfaceCard level={3} className="p-2.5">
          <span className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-1.5">Event Log</span>
          <div className="space-y-0.5 max-h-[140px] overflow-y-auto custom-scrollbar">
            {eventLog.length === 0 && (
              <div className="text-xs text-text-muted italic">No events yet</div>
            )}
            {eventLog.map((entry, i) => {
              const isApply = entry.event.includes('applied');
              const isTick = entry.event.includes('tick');
              const isExpired = entry.event.includes('expired');
              const color = isApply ? STATUS_SUCCESS : isTick ? ACCENT_CYAN : isExpired ? STATUS_WARNING : 'var(--text-muted)';
              return (
                <div key={i} className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-text-muted w-10 text-right flex-shrink-0">{entry.time.toFixed(1)}s</span>
                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span style={{ color }}>{entry.event}</span>
                </div>
              );
            })}
          </div>
        </SurfaceCard>

        <SurfaceCard level={3} className="p-2.5">
          <span className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-1.5">Active Tags</span>
          <div className="flex flex-wrap gap-1">
            {(!currentSnap || currentSnap.activeTags.length === 0) && (
              <div className="text-xs text-text-muted italic">No active tags</div>
            )}
            {currentSnap?.activeTags.map((tag) => (
              <span
                key={tag}
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${withOpacity(accent, OPACITY_10)}`, color: accent, border: `1px solid ${withOpacity(accent, OPACITY_15)}` }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Quick attribute snapshot */}
          {currentSnap && (
            <div className="mt-2 pt-2 border-t border-border/30">
              <span className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-1">Snapshot</span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {attributes.filter(a => a.category === 'vital' || a.category === 'combat').map(attr => {
                  const val = currentSnap.values[attr.name] ?? 0;
                  const initial = overrides[attr.name] ?? attr.defaultValue;
                  const delta = val - initial;
                  return (
                    <div key={attr.id} className="flex items-center justify-between text-xs font-mono">
                      <span className="text-text-muted truncate">{attr.name}</span>
                      <span className="flex items-center gap-1">
                        <span style={{ color: CAT_COLORS[attr.category] }}>
                          {val % 1 === 0 ? val : val.toFixed(1)}
                        </span>
                        {delta !== 0 && (
                          <span style={{ color: delta > 0 ? STATUS_SUCCESS : STATUS_ERROR, fontSize: 10 }}>
                            {delta > 0 ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(1)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}

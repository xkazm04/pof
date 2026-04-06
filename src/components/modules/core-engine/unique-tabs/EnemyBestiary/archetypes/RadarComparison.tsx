'use client';

import { useState, useMemo } from 'react';
import { Target, Search } from 'lucide-react';
import { MODULE_COLORS, ACCENT_ORANGE } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { RadarChart } from '../../_shared';
import { ARCHETYPES, RADAR_PLAYER, RADAR_AXES } from '../data';

interface RadarComparisonProps {
  radarOverlays: Record<string, boolean>;
  onToggleOverlay: (key: string) => void;
  activeOverlays: { data: import('@/types/unique-tab-improvements').RadarDataPoint[]; color: string; label: string }[];
  accent: string;
}

const MAX_VISIBLE = 20;

export function RadarComparison({ radarOverlays, onToggleOverlay, activeOverlays, accent }: RadarComparisonProps) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const enabledCount = useMemo(
    () => ARCHETYPES.filter(a => radarOverlays[a.id]).length,
    [radarOverlays],
  );

  const filteredArchetypes = useMemo(() => {
    if (!search) return ARCHETYPES;
    const lower = search.toLowerCase();
    return ARCHETYPES.filter(a => a.label.toLowerCase().includes(lower) || a.category.toLowerCase().includes(lower) || a.role.includes(lower));
  }, [search]);

  const visibleList = showAll ? filteredArchetypes : filteredArchetypes.slice(0, MAX_VISIBLE);

  return (
    <BlueprintPanel color={accent} className="p-3">
      <SectionHeader icon={Target} label="Archetype Comparison Radar" color={accent} />
      <div className="mt-3 flex flex-col md:flex-row items-start gap-4">
        <div className="flex-shrink-0">
          <RadarChart
            data={radarOverlays.player ? RADAR_PLAYER : RADAR_AXES.map(a => ({ axis: a, value: 0 }))}
            size={200}
            accent={radarOverlays.player ? MODULE_COLORS.core : 'transparent'}
            overlays={activeOverlays}
            showLabels
          />
        </div>
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
              Toggle Overlays
            </div>
            <span className="text-xs font-mono text-text-muted ml-auto">
              {enabledCount} / {ARCHETYPES.length} active
            </span>
          </div>

          {/* Player toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-sm group">
            <input
              type="checkbox"
              checked={radarOverlays.player ?? false}
              onChange={() => onToggleOverlay('player')}
              className="rounded border-border"
              style={{ accentColor: ACCENT_ORANGE }}
            />
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: MODULE_COLORS.core }} />
            <span className="text-text-muted group-hover:text-text transition-colors font-medium">
              Player (base)
            </span>
            <span className="text-xs text-text-muted opacity-60 ml-1">(dashed)</span>
          </label>

          {/* Search filter */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter enemies..."
              className="w-full pl-7 pr-2 py-1 rounded border border-border/30 bg-surface-deep/60 text-xs font-mono text-text placeholder:text-text-muted/50 outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Scrollable enemy list */}
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-0.5">
            {visibleList.map(a => (
              <label key={a.id} className="flex items-center gap-2 cursor-pointer text-xs group py-0.5">
                <input
                  type="checkbox"
                  checked={radarOverlays[a.id] ?? false}
                  onChange={() => onToggleOverlay(a.id)}
                  className="rounded border-border w-3 h-3"
                  style={{ accentColor: ACCENT_ORANGE }}
                />
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                <span className="text-text-muted group-hover:text-text transition-colors font-medium truncate">
                  {a.label}
                </span>
                <span className="text-text-muted/50 text-[10px] font-mono ml-auto flex-shrink-0">
                  {a.category} / {a.role}
                </span>
              </label>
            ))}
          </div>

          {/* Show more / less */}
          {filteredArchetypes.length > MAX_VISIBLE && (
            <button
              onClick={() => setShowAll(prev => !prev)}
              className="text-xs text-text-muted hover:text-text cursor-pointer underline"
            >
              {showAll ? 'Show fewer' : `Show all ${filteredArchetypes.length}`}
            </button>
          )}

          <p className="text-xs text-text-muted leading-relaxed">
            7-axis comparison: HP, Damage, Speed, Range, Aggression, Resilience, Intelligence. Values normalized 0-1.
          </p>
        </div>
      </div>
    </BlueprintPanel>
  );
}

'use client';

import { Target } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { RadarChart } from '../_shared';
import { ARCHETYPES, RADAR_DATA, RADAR_PLAYER, RADAR_AXES } from './data';

interface RadarComparisonProps {
  radarOverlays: Record<string, boolean>;
  onToggleOverlay: (key: string) => void;
  activeOverlays: { data: import('@/types/unique-tab-improvements').RadarDataPoint[]; color: string; label: string }[];
  accent: string;
}

export function RadarComparison({ radarOverlays, onToggleOverlay, activeOverlays, accent }: RadarComparisonProps) {
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
        <div className="space-y-3 flex-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
            Toggle Overlays
          </div>
          {[
            ...ARCHETYPES.map(a => ({ key: a.id, label: a.label, color: a.color })),
            { key: 'player', label: 'Player (base)', color: MODULE_COLORS.core },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-2 cursor-pointer text-sm group">
              <input
                type="checkbox"
                checked={radarOverlays[item.key]}
                onChange={() => onToggleOverlay(item.key)}
                className="rounded border-border accent-blue-500"
              />
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-text-muted group-hover:text-text transition-colors font-medium">
                {item.label}
              </span>
              {item.key === 'player' && (
                <span className="text-xs text-text-muted opacity-60 ml-1">(dashed)</span>
              )}
            </label>
          ))}
          <p className="text-sm text-text-muted mt-2 leading-relaxed">
            7-axis comparison: HP, Damage, Speed, Range, Aggression, Resilience, Intelligence. Values normalized 0-1.
          </p>
        </div>
      </div>
    </BlueprintPanel>
  );
}

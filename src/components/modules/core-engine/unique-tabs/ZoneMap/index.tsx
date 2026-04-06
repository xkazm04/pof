'use client';

import { useState, useCallback, useMemo } from 'react';
import { Map as MapIcon, SlidersHorizontal, LayoutGrid } from 'lucide-react';
import {
  STATUS_ERROR,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_VIOLET, ACCENT_EMERALD,
  withOpacity, OPACITY_10, OPACITY_5, OPACITY_25, OPACITY_8,
} from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { TabHeader, LoadingSpinner, SubTabNavigation, type SubTab } from '../_shared';
import type { SubModuleId } from '@/types/modules';
import type { PlaytimePathMode } from './data';
import { ZONES } from './data';

import { CollapsibleGroup } from './CollapsibleGroup';
import { MapTopologyGroup } from './map/MapTopologyGroup';
import { PlaytimeTopologyOverlay, PlaytimeBreakdownTable } from './playtime/PlaytimeEstimator';
import { DensityLevelGroup } from './density/DensityLevelGroup';
import { PoiEncountersGroup } from './travel/PoiEncountersGroup';
import { TravelProgressionGroup } from './travel/TravelProgressionGroup';
import FeatureMapTab from '../FeatureMapTab';
import { VisibleSection } from '../VisibleSection';

const ACCENT = ACCENT_CYAN;

interface ZoneMapProps {
  moduleId: SubModuleId;
}

export function ZoneMap({ moduleId }: ZoneMapProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);

  const [playerLevel, setPlayerLevel] = useState(1);
  const [playtimeMode, setPlaytimeMode] = useState<PlaytimePathMode>('critical');
  const [openGroups, setOpenGroups] = useState<Set<number>>(() => new Set([0]));
  const [activeTab, setActiveTab] = useState('map');

  const tabs: SubTab[] = useMemo(() => [
    { id: 'features', label: 'Features', icon: LayoutGrid },
    { id: 'map', label: 'Map' },
    { id: 'playtime', label: 'Playtime' },
    { id: 'density', label: 'Density' },
    { id: 'travel', label: 'Travel' },
  ], []);

  const matchingZones = useMemo(
    () => ZONES.filter(z => z.levelMin <= playerLevel && playerLevel <= z.levelMax),
    [playerLevel],
  );
  const matchingIds = useMemo(() => new Set(matchingZones.map(z => z.id)), [matchingZones]);
  const toggleGroup = useCallback((idx: number) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-4">
      <TabHeader icon={MapIcon} title="Zone & Level Architecture" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />

      {/* Player level filter */}
      <div className="rounded-lg border p-3" style={{ borderColor: `${withOpacity(ACCENT, OPACITY_10)}`, backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
        <div className="flex items-center gap-2 mb-2">
          <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          <span className="text-xs font-mono uppercase tracking-wider" style={{ color: ACCENT }}>
            Player Level Filter
          </span>
          <span className="ml-auto text-sm font-mono font-bold" style={{ color: ACCENT }}>Lv {playerLevel}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_10)}`, color: ACCENT }}>
            {matchingZones.length}/{ZONES.length} zones
          </span>
        </div>
        <input type="range" min={1} max={50} value={playerLevel} onChange={e => setPlayerLevel(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: ACCENT }} />
        <div className="flex justify-between text-[10px] font-mono text-text-muted mt-1">
          <span>1</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span>
        </div>
        {matchingZones.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {matchingZones.map(z => (
              <span key={z.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                style={{ borderColor: `${withOpacity(z.color, OPACITY_25)}`, color: z.color, backgroundColor: `${withOpacity(z.color, OPACITY_8)}` }}>
                {z.name} ({z.levelRange})
              </span>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} />}

      {activeTab === 'map' && (
        <VisibleSection moduleId={moduleId} sectionId="topology">
        <CollapsibleGroup title="Map & Topology" accent={ACCENT} sectionCount={3} isOpen={openGroups.has(0)} onToggle={() => toggleGroup(0)}>
          <MapTopologyGroup featureMap={featureMap} defs={defs} />
        </CollapsibleGroup>
        </VisibleSection>
      )}

      {activeTab === 'playtime' && (
        <VisibleSection moduleId={moduleId} sectionId="playtime">
        <CollapsibleGroup title="Playtime Estimator" accent={ACCENT_ORANGE} sectionCount={2} isOpen={openGroups.has(1)} onToggle={() => toggleGroup(1)}>
          <PlaytimeTopologyOverlay mode={playtimeMode} onModeChange={setPlaytimeMode} />
          <PlaytimeBreakdownTable mode={playtimeMode} />
        </CollapsibleGroup>
        </VisibleSection>
      )}

      {activeTab === 'density' && (
        <VisibleSection moduleId={moduleId} sectionId="heatmap">
        <CollapsibleGroup title="Density & Level Range" accent={STATUS_ERROR} sectionCount={3} isOpen={openGroups.has(2)} onToggle={() => toggleGroup(2)}>
          <DensityLevelGroup />
        </CollapsibleGroup>
        </VisibleSection>
      )}

      {activeTab === 'travel' && (
        <VisibleSection moduleId={moduleId} sectionId="fast-travel">
          <CollapsibleGroup title="POI & Encounters" accent={ACCENT_EMERALD} sectionCount={4} isOpen={openGroups.has(3)} onToggle={() => toggleGroup(3)}>
            <PoiEncountersGroup />
          </CollapsibleGroup>

          <CollapsibleGroup title="Travel & Progression" accent={ACCENT_VIOLET} sectionCount={3} isOpen={openGroups.has(4)} onToggle={() => toggleGroup(4)}>
            <TravelProgressionGroup />
          </CollapsibleGroup>
        </VisibleSection>
      )}
    </div>
  );
}

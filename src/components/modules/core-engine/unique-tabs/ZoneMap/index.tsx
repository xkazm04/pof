'use client';

import { useState, useCallback } from 'react';
import { Map as MapIcon } from 'lucide-react';
import {
  STATUS_ERROR,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_VIOLET, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { TabHeader, LoadingSpinner } from '../_shared';
import type { SubModuleId } from '@/types/modules';
import type { PlaytimePathMode } from './data';

import { CollapsibleGroup } from './CollapsibleGroup';
import { MapTopologyGroup } from './MapTopologyGroup';
import { PlaytimeTopologyOverlay, PlaytimeBreakdownTable } from './PlaytimeEstimator';
import { DensityLevelGroup } from './DensityLevelGroup';
import { PoiEncountersGroup } from './PoiEncountersGroup';
import { TravelProgressionGroup } from './TravelProgressionGroup';

const ACCENT = ACCENT_CYAN;

interface ZoneMapProps {
  moduleId: SubModuleId;
}

export function ZoneMap({ moduleId }: ZoneMapProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);

  const [playtimeMode, setPlaytimeMode] = useState<PlaytimePathMode>('critical');
  const [openGroups, setOpenGroups] = useState<Set<number>>(() => new Set([0]));
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

      <CollapsibleGroup title="Map & Topology" accent={ACCENT} sectionCount={3} isOpen={openGroups.has(0)} onToggle={() => toggleGroup(0)}>
        <MapTopologyGroup featureMap={featureMap} defs={defs} />
      </CollapsibleGroup>

      <CollapsibleGroup title="Playtime Estimator" accent={ACCENT_ORANGE} sectionCount={2} isOpen={openGroups.has(1)} onToggle={() => toggleGroup(1)}>
        <PlaytimeTopologyOverlay mode={playtimeMode} onModeChange={setPlaytimeMode} />
        <PlaytimeBreakdownTable mode={playtimeMode} />
      </CollapsibleGroup>

      <CollapsibleGroup title="Density & Level Range" accent={STATUS_ERROR} sectionCount={3} isOpen={openGroups.has(2)} onToggle={() => toggleGroup(2)}>
        <DensityLevelGroup />
      </CollapsibleGroup>

      <CollapsibleGroup title="POI & Encounters" accent={ACCENT_EMERALD} sectionCount={4} isOpen={openGroups.has(3)} onToggle={() => toggleGroup(3)}>
        <PoiEncountersGroup />
      </CollapsibleGroup>

      <CollapsibleGroup title="Travel & Progression" accent={ACCENT_VIOLET} sectionCount={3} isOpen={openGroups.has(4)} onToggle={() => toggleGroup(4)}>
        <TravelProgressionGroup />
      </CollapsibleGroup>
    </div>
  );
}

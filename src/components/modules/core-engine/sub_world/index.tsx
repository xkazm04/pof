'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Map as MapIcon, SlidersHorizontal, LayoutGrid, Database, Info } from 'lucide-react';
import {
  STATUS_ERROR,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_VIOLET, ACCENT_EMERALD,
  withOpacity, OPACITY_10, OPACITY_5, OPACITY_25, OPACITY_8,
} from '@/lib/chart-colors';
import { DURATION, EASE_OUT, motionSafe } from '@/lib/motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { CountUp } from './_shared/CountUp';
import { RipplePulse } from './_shared/RipplePulse';
import { TabHeader, LoadingSpinner, SubTabNavigation, type SubTab } from '../unique-tabs/_shared';
import type { SubModuleId } from '@/types/modules';
import type { PlaytimePathMode } from './_shared/data';
import { ZONES } from './_shared/data';

import { CollapsibleGroup } from './_shared/CollapsibleGroup';
import { MapTopologyGroup } from './map/MapTopologyGroup';
import {
  PlaytimeTopologyOverlay, PlaytimeBreakdownTable,
  PlaytimeBudgetTargeter, InterestCurveChart,
} from './playtime/PlaytimeEstimator';
import { DensityLevelGroup } from './density/DensityLevelGroup';
import { PoiEncountersGroup } from './travel/PoiEncountersGroup';
import { TravelProgressionGroup } from './travel/TravelProgressionGroup';
import FeatureMapTab from '../unique-tabs/FeatureMapTab';
import { VisibleSection } from '../unique-tabs/VisibleSection';
import { useCatalogEntities } from '@/stores/catalogStore';
import { useGeneration } from '@/hooks/useGeneration';
import { CatalogLifecycleCell } from '@/components/catalog/CatalogLifecycleCell';
import type { ZoneEntry } from '@/lib/catalog/types';
import type { GenerationStep } from '@/lib/catalog/recipe';

const ACCENT = ACCENT_CYAN;

interface ZoneMapProps {
  moduleId: SubModuleId;
}

export function ZoneMap({ moduleId }: ZoneMapProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const prefersReduced = useReducedMotion();

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
  /* Stable content signature — pulses the active panel only when the matching
     set actually changes, not on every slider tick within the same band. */
  const matchSignature = useMemo(() => matchingZones.map(z => z.id).join('|'), [matchingZones]);
  /* Derive the Set from the signature (not from `matchingZones`, a fresh
     `.filter()` array every tick) so its identity stays stable across slider
     ticks within the same level band — that's what lets the memo boundary on the
     map/topology children below actually skip work. Reading only `matchSignature`
     also keeps the deps honest (no manual-memoization / exhaustive-deps escape). */
  const matchingIds = useMemo(
    () => new Set(matchSignature ? matchSignature.split('|') : []),
    [matchSignature],
  );

  /* folder-09 R3 UI: lifecycle + (Re)generate for the primary (first matching) zone. */
  const zoneEntries = useCatalogEntities('zone-map') as ZoneEntry[];
  const entryByZoneId = useMemo(
    () => new Map(zoneEntries.map((e) => [e.data.id, e])),
    [zoneEntries],
  );
  /* Resolve the catalog entry for the level-filtered primary zone ONLY.
     Never substitute an arbitrary entry (`zoneEntries[0]`) when the lookup
     misses — a Regenerate fired against the wrong zone is destructive. A miss
     renders an explicit "not in catalog" notice instead (below). */
  const primaryZone = matchingZones[0] ?? ZONES[0];
  const primaryEntry = primaryZone ? entryByZoneId.get(primaryZone.id) : undefined;
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

      {/* folder-09 R3: catalog lifecycle cell for the primary zone.
          Three explicit states — resolved entry, zone missing from catalog
          (generation disabled, never retargeted), and empty catalog. */}
      {primaryEntry ? (
        <ZoneLifecycleBar entry={primaryEntry} />
      ) : zoneEntries.length === 0 ? (
        <div
          role="status"
          className="rounded-lg border border-border/40 bg-surface-deep/30 px-4 py-6 flex flex-col items-center justify-center gap-2 text-center"
        >
          <Database className="w-5 h-5 text-text-muted opacity-40" />
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            Zone catalog is empty
          </span>
          <span className="text-2xs text-text-muted/80 max-w-sm leading-relaxed">
            No zones are registered in the catalog yet — seed or reload the catalog to enable lifecycle tracking and generation.
          </span>
        </div>
      ) : primaryZone ? (
        <div role="status" className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            {primaryZone.displayName}
          </span>
          <span className="flex items-center gap-1.5 text-2xs font-mono text-text-muted border border-border/50 rounded px-1.5 py-0.5">
            <Info className="w-3 h-3 opacity-60 shrink-0" />
            Not in catalog yet — generation unavailable for this zone
          </span>
        </div>
      ) : null}

      {/* Player level filter */}
      <div className="rounded-lg border p-3" style={{ borderColor: `${withOpacity(ACCENT, OPACITY_10)}`, backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
        <div className="flex items-center gap-2 mb-2">
          <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          <span className="text-xs font-mono uppercase tracking-wider" style={{ color: ACCENT }}>
            Player Level Filter
          </span>
          <span className="ml-auto text-sm font-mono font-bold" style={{ color: ACCENT }}>Lv {playerLevel}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded tabular-nums"
            style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_10)}`, color: ACCENT }}>
            <CountUp value={matchingZones.length} />/{ZONES.length} zones
          </span>
        </div>
        <input type="range" min={1} max={50} value={playerLevel} onChange={e => setPlayerLevel(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: ACCENT }} />
        <div className="relative h-4 text-[10px] font-mono text-text-muted mt-1">
          {[1, 10, 20, 30, 40, 50].map(v => (
            <span
              key={v}
              className="absolute -translate-x-1/2 tabular-nums"
              style={{ left: `${((v - 1) / 49) * 100}%` }}
            >
              {v}
            </span>
          ))}
        </div>
        {matchingZones.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            <AnimatePresence initial={false} mode="popLayout">
              {matchingZones.map((z, i) => (
                <motion.span
                  key={z.id}
                  layout
                  initial={prefersReduced ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  transition={motionSafe({ duration: DURATION.base, ease: EASE_OUT, delay: i * 0.03 }, prefersReduced)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                  style={{ borderColor: `${withOpacity(z.color, OPACITY_25)}`, color: z.color, backgroundColor: `${withOpacity(z.color, OPACITY_8)}` }}
                >
                  {z.name} ({z.levelRange})
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Ring-pulse the active panel when the level filter actually changes the
          matching set, threading the slider action to its downstream effect. */}
      <RipplePulse trigger={matchSignature} color={ACCENT}>
      {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} />}

      {activeTab === 'map' && (
        <VisibleSection moduleId={moduleId} sectionId="topology">
        <CollapsibleGroup title="Map & Topology" accent={ACCENT} sectionCount={3} isOpen={openGroups.has(0)} onToggle={() => toggleGroup(0)}>
          <MapTopologyGroup featureMap={featureMap} defs={defs} matchingIds={matchingIds} />
        </CollapsibleGroup>
        </VisibleSection>
      )}

      {activeTab === 'playtime' && (
        <VisibleSection moduleId={moduleId} sectionId="playtime">
        <CollapsibleGroup title="Playtime Estimator" accent={ACCENT_ORANGE} sectionCount={4} isOpen={openGroups.has(1)} onToggle={() => toggleGroup(1)}>
          <PlaytimeTopologyOverlay mode={playtimeMode} onModeChange={setPlaytimeMode} />
          <PlaytimeBreakdownTable mode={playtimeMode} />
          <PlaytimeBudgetTargeter mode={playtimeMode} />
          <InterestCurveChart mode={playtimeMode} />
        </CollapsibleGroup>
        </VisibleSection>
      )}

      {activeTab === 'density' && (
        <VisibleSection moduleId={moduleId} sectionId="heatmap">
        <CollapsibleGroup title="Density & Level Range" accent={STATUS_ERROR} sectionCount={3} isOpen={openGroups.has(2)} onToggle={() => toggleGroup(2)}>
          <DensityLevelGroup matchingIds={matchingIds} playerLevel={playerLevel} />
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
      </RipplePulse>
    </div>
  );
}

/* folder-09 R3: lifecycle + (Re)generate for one resolved catalog entry.
   Split into its own component so `useGeneration` — which dereferences the
   entity immediately — is only ever mounted with a real entry: no non-null
   assertions, no conditional hook calls in the parent. */
function ZoneLifecycleBar({ entry }: { entry: ZoneEntry }) {
  const gen = useGeneration(entry);
  const nextStep: GenerationStep =
    entry.lifecycle === 'generated' ? 'wire'
      : entry.lifecycle === 'wired' ? 'verify'
        : 'author-python';

  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
        {entry.data.displayName ?? entry.data.id}
      </span>
      <CatalogLifecycleCell
        lifecycle={entry.lifecycle}
        ueAssetCount={entry.ueAssets?.length ?? 0}
        busy={gen.isRunning}
        onRegenerate={() => gen.generate(nextStep)}
      />
    </div>
  );
}

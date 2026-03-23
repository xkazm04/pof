'use client';

import { useState, useCallback } from 'react';
import { Compass, Navigation, Info, Map as MapIcon, Anchor, Lock, Unlock, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_WARNING, STATUS_SUCCESS, ACCENT_CYAN,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { PipelineFlow, FeatureGrid } from '../_shared';
import { ZONES, ASSET_FEATURES } from './data';
import type { ZoneRecord } from './data';
import type { FeatureRow } from '@/types/feature-matrix';
import { ZoneMapCanvas } from './MapCanvas';
import { FeatureList } from './FeatureList';
import { TopologyGraph } from './TopologyGraph';

const ACCENT = ACCENT_CYAN;

interface MapTopologyGroupProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

export function MapTopologyGroup({ featureMap, defs }: MapTopologyGroupProps) {
  const [selectedZone, setSelectedZone] = useState<ZoneRecord>(ZONES[0]);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const toggleAsset = useCallback((name: string) => {
    setExpandedAsset((prev) => (prev === name ? null : name));
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Canvas */}
        <div className="lg:col-span-2 space-y-4">
          <BlueprintPanel color={ACCENT} className="p-3">
            <div className="flex justify-between items-center mb-2.5 relative z-10">
              <SectionHeader icon={Compass} label="World Map Preview" color={ACCENT} />
              <div className="flex gap-4 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted bg-surface-deep px-3 py-1.5 rounded-full border border-border/40">
                <span className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-help">
                  <span className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: STATUS_SUCCESS, color: STATUS_SUCCESS }} /> Completed
                </span>
                <span className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-help">
                  <span className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: STATUS_WARNING, color: STATUS_WARNING }} /> Active
                </span>
                <span className="flex items-center gap-1.5 hover:text-red-400 transition-colors cursor-help">
                  <span className="w-2 h-2 rounded bg-border text-border" /> Locked
                </span>
              </div>
            </div>

            <div className="w-full aspect-video bg-surface-deep/30 rounded-xl relative overflow-hidden border border-border/60 shadow-inner min-h-[200px]">
              <div className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `linear-gradient(${ACCENT} 1px, transparent 1px), linear-gradient(90deg, ${ACCENT} 1px, transparent 1px)`,
                  backgroundSize: '20px 20px',
                }}
              />
              <ZoneMapCanvas zones={ZONES} selectedZone={selectedZone} onSelectZone={setSelectedZone} />
              <div className="absolute bottom-2 right-3 text-[10px] font-mono uppercase tracking-[0.15em] text-cyan-500/50">
                WRLD.X: {Math.round(selectedZone.cx * 100)} / Y: {Math.round(selectedZone.cy * 100)}
              </div>
            </div>
          </BlueprintPanel>

          {/* Level Streaming Pipeline */}
          <BlueprintPanel color={ACCENT} className="p-3">
            <SectionHeader icon={Navigation} label="World Partition Flow" color={ACCENT} />
            <PipelineFlow steps={['Persistent Level', 'Grid Cells', 'HLODs', 'Data Layers', 'Streaming Bounds']} accent={ACCENT} />
          </BlueprintPanel>
        </div>

        {/* Details Panel */}
        <div className="space-y-4">
          <RegionDetails selectedZone={selectedZone} featureMap={featureMap} />
        </div>
      </div>

      {/* Environment Assets */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader icon={MapIcon} label="Environment Tech" color={ACCENT} />
        <FeatureGrid featureNames={ASSET_FEATURES} featureMap={featureMap} defs={defs} expanded={expandedAsset} onToggle={toggleAsset} accent={ACCENT} />
      </BlueprintPanel>

      <TopologyGraph />
    </>
  );
}

/* ── Region Details Sub-panel ─────────────────────────────────────────── */

function RegionDetails({ selectedZone, featureMap }: { selectedZone: ZoneRecord; featureMap: Map<string, FeatureRow> }) {
  return (
    <BlueprintPanel color={ACCENT_CYAN} className="p-4 h-full">
      <SectionHeader icon={Info} label="Region Details" color={ACCENT_CYAN} />

      <AnimatePresence mode="sync">
        <motion.div
          key={selectedZone.id}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="bg-surface-deep p-4 rounded-xl border border-border/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-20">
              {selectedZone.type === 'hub' ? <Anchor className="w-12 h-12" /> :
                selectedZone.type === 'boss' ? <MapIcon className="w-12 h-12 text-red-500" /> :
                  <Navigation className="w-12 h-12" />}
            </div>

            <div className="flex items-center gap-2 mb-1.5 relative z-10">
              <span className="text-lg font-bold text-text">{selectedZone.displayName}</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-text-muted font-mono mb-2.5 relative z-10">
              <span className="bg-surface px-2 py-0.5 rounded border border-border/40 text-cyan-400">
                LVL {selectedZone.levelRange}
              </span>
              <span className={`px-2 py-0.5 rounded flex items-center gap-1 border ${selectedZone.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                selectedZone.status === 'active' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                  'bg-surface text-text-muted border-border/40'
                }`}>
                {selectedZone.status === 'completed' ? <Unlock className="w-3 h-3" /> :
                  selectedZone.status === 'active' ? <MapIcon className="w-3 h-3" /> :
                    <Lock className="w-3 h-3" />}
                {selectedZone.status.toUpperCase()}
              </span>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Connections</div>
              {selectedZone.connections.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedZone.connections.map(connId => {
                    const connZone = ZONES.find(z => z.id === connId);
                    return (
                      <span key={connId} className="text-xs bg-surface-hover px-2 py-1 rounded text-text-muted flex items-center gap-1 border border-border/40">
                        <ChevronRight className="w-3 h-3 opacity-50" />
                        {connZone?.displayName}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-text-muted italic opacity-70">End of current path</div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-border/40">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted font-bold mb-3">Feature State</div>
            <div className="space-y-3">
              {selectedZone.type === 'hub' && (
                <FeatureList itemNames={['Game instance', 'Base PlayerController']} featureMap={featureMap} />
              )}
              {selectedZone.type === 'combat' && (
                <FeatureList itemNames={['Spawn point system', 'Enemy AI controller']} featureMap={featureMap} />
              )}
              {selectedZone.type === 'boss' && (
                <FeatureList itemNames={['Death flow', 'Combat feedback']} featureMap={featureMap} />
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </BlueprintPanel>
  );
}

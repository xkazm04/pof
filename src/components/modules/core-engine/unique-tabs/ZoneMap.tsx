'use client';

import { useMemo, useState, useCallback } from 'react';
import { Map as MapIcon, Compass, Anchor, Navigation, Info, ExternalLink, ChevronDown, ChevronRight, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS,
  ACCENT_CYAN,
  OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_COLORS, TabHeader, PipelineFlow, FeatureGrid, LoadingSpinner } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

const ACCENT = ACCENT_CYAN;

/* ── Zone Data ─────────────────────────────────────────────────────────────── */

interface ZoneNode {
  id: string;
  name: string;
  cx: number;
  cy: number;
  type: 'hub' | 'combat' | 'boss';
  status: 'active' | 'locked' | 'completed';
  levelRange: string;
  connections: string[]; // ids of connected zones
}

const ZONES: ZoneNode[] = [
  { id: 'z1', name: 'Sanctuary (Hub)', cx: 20, cy: 50, type: 'hub', status: 'completed', levelRange: '1', connections: ['z2', 'z3'] },
  { id: 'z2', name: 'Whispering Woods', cx: 45, cy: 30, type: 'combat', status: 'completed', levelRange: '1-3', connections: ['z4'] },
  { id: 'z3', name: 'Crystal Caves', cx: 40, cy: 75, type: 'combat', status: 'active', levelRange: '2-4', connections: ['z5'] },
  { id: 'z4', name: 'Bandit Camp', cx: 70, cy: 25, type: 'combat', status: 'locked', levelRange: '3-5', connections: ['z6'] },
  { id: 'z5', name: 'Deep Core', cx: 65, cy: 85, type: 'combat', status: 'locked', levelRange: '4-6', connections: ['z6'] },
  { id: 'z6', name: 'Ruined Keep (Boss)', cx: 85, cy: 50, type: 'boss', status: 'locked', levelRange: '5-7', connections: [] },
];

/* ── Asset list ────────────────────────────────────────────────────────────── */

const ASSET_FEATURES = [
  'Level Streaming setup',
  'World Partition grid',
  'HLOD generation',
  'Environment lighting (Lumen)',
  'Foliage instancing',
  'Water system (plugin)',
];

/* ── Component ─────────────────────────────────────────────────────────────── */

interface ZoneMapProps {
  moduleId: SubModuleId;
}

export function ZoneMap({ moduleId }: ZoneMapProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneNode>(ZONES[0]);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0;
    for (const d of defs) {
      const s = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (s === 'implemented' || s === 'improved') implemented++;
      else if (s === 'partial') partial++;
    }
    return { total, implemented, partial };
  }, [defs, featureMap]);

  const toggleAsset = useCallback((name: string) => {
    setExpandedAsset((prev) => (prev === name ? null : name));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-4">
      <TabHeader icon={MapIcon} title="Zone & Level Architecture" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Canvas - takes up more space */}
        <div className="lg:col-span-2 space-y-4">
          <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-cyan-500/10 transition-colors duration-1000" />

            <div className="flex justify-between items-center mb-4 relative z-10">
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" /> World Map Preview
              </div>
              <div className="flex gap-4 text-[10px] font-mono text-text-muted bg-surface-deep px-3 py-1.5 rounded-full border border-border/40">
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

            <div className="w-full aspect-video bg-surface-deep/80 rounded-xl relative overflow-hidden border border-border/60 shadow-inner">
              {/* Grid background */}
              <div className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `linear-gradient(${ACCENT} 1px, transparent 1px), linear-gradient(90deg, ${ACCENT} 1px, transparent 1px)`,
                  backgroundSize: '20px 20px'
                }}
              />

              <ZoneMapCanvas
                zones={ZONES}
                selectedZone={selectedZone}
                onSelectZone={setSelectedZone}
              />

              {/* Coordinates display overlay */}
              <div className="absolute bottom-2 right-3 text-[10px] font-mono text-cyan-500/50">
                WRLD.X: {Math.round(selectedZone.cx * 100)} / Y: {Math.round(selectedZone.cy * 100)}
              </div>
            </div>
          </SurfaceCard>

          {/* Level Streaming Pipeline */}
          <SurfaceCard level={2} className="p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent" />
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-cyan-400" /> World Partition Flow
            </div>
            <PipelineFlow steps={['Persistent Level', 'Grid Cells', 'HLODs', 'Data Layers', 'Streaming Bounds']} accent={ACCENT} />
          </SurfaceCard>
        </div>

        {/* Details Panel */}
        <div className="space-y-4">
          <SurfaceCard level={2} className="p-4 h-full relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" /> Region Details
            </div>

            <AnimatePresence mode="wait">
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
                    <span className="text-lg font-bold text-text">{selectedZone.name}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-text-muted font-mono mb-4 relative z-10">
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

                  <div className="space-y-2.5 relative z-10">
                    <div className="text-2xs uppercase tracking-wider text-text-muted font-bold">Connections</div>
                    {selectedZone.connections.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedZone.connections.map(connId => {
                          const connZone = ZONES.find(z => z.id === connId);
                          return (
                            <span key={connId} className="text-xs bg-surface-hover px-2 py-1 rounded text-text-muted flex items-center gap-1 border border-border/40">
                              <ChevronRight className="w-3 h-3 opacity-50" />
                              {connZone?.name}
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
                  <div className="text-2xs uppercase tracking-wider text-text-muted font-bold mb-3">Feature State</div>
                  <div className="space-y-2">
                    {/* Render a specific feature card based on zone type as an example */}
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
          </SurfaceCard>
        </div>
      </div>

      {/* Environment Assets */}
      <SurfaceCard level={2} className="p-4 relative">
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-cyan-400" /> Environment Tech
        </div>
        <FeatureGrid
          featureNames={ASSET_FEATURES}
          featureMap={featureMap}
          defs={defs}
          expanded={expandedAsset}
          onToggle={toggleAsset}
          accent={ACCENT}
        />
      </SurfaceCard>
    </div>
  );
}

/* ── Specific Zone Feature List Component ────────────────────────────────── */
function FeatureList({ itemNames, featureMap }: { itemNames: string[], featureMap: Map<string, FeatureRow> }) {
  return (
    <>
      {itemNames.map(name => {
        const status = featureMap.get(name)?.status ?? 'unknown';
        const sc = STATUS_COLORS[status];
        return (
          <div key={name} className="flex items-center justify-between text-xs bg-surface/50 p-2 rounded-lg border border-border/50">
            <span className="text-text font-medium">{name}</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface shadow-sm border border-border/40">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot, boxShadow: `0 0 5px ${sc.dot}80` }} />
              <span style={{ color: sc.dot }}>{sc.label}</span>
            </span>
          </div>
        )
      })}
    </>
  );
}

/* ── Map Canvas SVG ────────────────────────────────────────────────────────── */

function ZoneMapCanvas({
  zones, selectedZone, onSelectZone
}: {
  zones: ZoneNode[];
  selectedZone: ZoneNode;
  onSelectZone: (z: ZoneNode) => void;
}) {
  const getZoneColor = (z: ZoneNode) => {
    switch (z.status) {
      case 'completed': return STATUS_SUCCESS;
      case 'active': return STATUS_WARNING;
      case 'locked': return '#475569'; // slate-600
    }
  };

  const getStrokeColor = (z: ZoneNode) => {
    switch (z.status) {
      case 'completed': return `${STATUS_SUCCESS}80`;
      case 'active': return `${STATUS_WARNING}80`;
      case 'locked': return '#334155'; // slate-700
    }
  };

  return (
    <svg className="w-full h-full absolute inset-0 text-text cursor-crosshair">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.8" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Draw connections first so they're behind nodes */}
      {zones.map((zone) =>
        zone.connections.map((connId) => {
          const target = zones.find((z) => z.id === connId);
          if (!target) return null;
          return (
            <motion.line
              key={`${zone.id}-${connId}`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              x1={`${zone.cx}%`}
              y1={`${zone.cy}%`}
              x2={`${target.cx}%`}
              y2={`${target.cy}%`}
              stroke={`url(#lineGrad)`}
              strokeWidth="2"
              strokeDasharray="4 4"
              className="opacity-50"
            />
          );
        })
      )}

      {/* Draw nodes */}
      {zones.map((zone, i) => {
        const isSelected = zone.id === selectedZone.id;
        const color = getZoneColor(zone);
        const strokeColor = getStrokeColor(zone);
        const isBoss = zone.type === 'boss';
        const isHub = zone.type === 'hub';

        return (
          <g
            key={zone.id}
            onClick={() => onSelectZone(zone)}
            className="cursor-pointer group"
          >
            {/* Hover ring */}
            <motion.circle
              initial={{ r: 0 }}
              animate={{ r: isSelected ? 24 : 18 }}
              cx={`${zone.cx}%`}
              cy={`${zone.cy}%`}
              fill="transparent"
              stroke={isSelected ? color : 'transparent'}
              strokeWidth={1}
              className="opacity-50 group-hover:stroke-text-muted transition-colors duration-300"
              style={{ filter: isSelected ? 'url(#glow)' : 'none' }}
            />

            {/* Pulsing ring for active zone */}
            {zone.status === 'active' && (
              <motion.circle
                cx={`${zone.cx}%`}
                cy={`${zone.cy}%`}
                r="12"
                fill="transparent"
                stroke={color}
                strokeWidth="1.5"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}

            {/* Base shape based on type */}
            {isBoss ? (
              <motion.polygon
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: i * 0.1, type: "spring" }}
                points={`${zone.cx},${zone.cy - 12} ${zone.cx + 12},${zone.cy} ${zone.cx},${zone.cy + 12} ${zone.cx - 12},${zone.cy}`}
                fill={color}
                stroke={isSelected ? '#fff' : strokeColor}
                strokeWidth="2"
                style={{ transformOrigin: `${zone.cx}% ${zone.cy}%` }}
              />
            ) : isHub ? (
              <motion.rect
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1, type: "spring" }}
                x={`${zone.cx}%`} y={`${zone.cy}%`} width="20" height="20"
                transform={`translate(-10, -10)`}
                fill={color}
                stroke={isSelected ? '#fff' : strokeColor}
                strokeWidth="2"
                rx="4"
              />
            ) : (
              <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1, type: "spring" }}
                cx={`${zone.cx}%`}
                cy={`${zone.cy}%`}
                r={isSelected ? "10" : "8"}
                fill={color}
                stroke={isSelected ? '#fff' : strokeColor}
                strokeWidth="2"
                style={{ filter: zone.status !== 'locked' ? 'url(#glow)' : 'none' }}
              />
            )}

            {/* Selected Indicator */}
            {isSelected && (
              <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                cx={`${zone.cx}%`}
                cy={`${zone.cy}%`}
                r="3"
                fill={isBoss ? '#fff' : '#000'}
              />
            )}

            {/* Label - visible on hover or if selected */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: isSelected ? 1 : 0.6 }}
              className="pointer-events-none transition-opacity duration-300 group-hover:opacity-100"
            >
              <rect
                x={`${zone.cx}%`}
                y={`${zone.cy + 5}%`}
                transform={`translate(-${(zone.name.length * 6) / 2}, 16)`}
                width={zone.name.length * 6 + 10}
                height="18"
                rx="4"
                fill="var(--surface-deep)"
                stroke="var(--border)"
                strokeWidth="1"
                className="opacity-90"
              />
              <text
                x={`${zone.cx}%`}
                y={`${zone.cy + 5}%`}
                transform={`translate(0, 29)`}
                textAnchor="middle"
                fontSize="10"
                fontFamily="monaco, monospace"
                fill="var(--text)"
                className="font-semibold"
              >
                {zone.name}
              </text>
            </motion.g>
          </g>
        );
      })}
    </svg>
  );
}

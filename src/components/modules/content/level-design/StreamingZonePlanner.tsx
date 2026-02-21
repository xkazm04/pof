'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Plus, X, Send, Loader2, ChevronDown,
  Eraser, Link2,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_INFO, STATUS_SUCCESS, ACCENT_VIOLET, STATUS_ERROR, STATUS_BLOCKER, STATUS_WARNING } from '@/lib/chart-colors';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ──

export type ZoneType = 'town' | 'forest' | 'ruins' | 'catacombs' | 'boss-arena' | 'hub' | 'dungeon' | 'custom';
export type LoadPriority = 'always' | 'high' | 'normal' | 'low';
export type TransitionStyle = 'seamless' | 'loading-screen' | 'fade' | 'portal';

export interface StreamingZone {
  id: string;
  name: string;
  type: ZoneType;
  gridX: number;
  gridY: number;
  loadPriority: LoadPriority;
  alwaysLoaded: boolean;
  /** Streaming distance — how many cells away to begin loading */
  preloadRadius: number;
}

export interface ZoneTransition {
  id: string;
  fromId: string;
  toId: string;
  style: TransitionStyle;
  triggerType: 'proximity' | 'interaction' | 'automatic';
  /** Optional condition text, e.g. "Defeat Boss" */
  condition: string;
}

export interface StreamingZonePlannerConfig {
  zones: StreamingZone[];
  transitions: ZoneTransition[];
  gridSize: number;
}

// ── Constants ──

const CELL_SIZE = 72;

const ZONE_TYPES: Record<ZoneType, { color: string; label: string; letter: string }> = {
  'town': { color: STATUS_INFO, label: 'Town', letter: 'T' },
  'forest': { color: STATUS_SUCCESS, label: 'Forest', letter: 'F' },
  'ruins': { color: ACCENT_VIOLET, label: 'Ruins', letter: 'R' },
  'catacombs': { color: '#8b8fb0', label: 'Catacombs', letter: 'C' },
  'boss-arena': { color: STATUS_ERROR, label: 'Boss Arena', letter: 'B' },
  'hub': { color: '#2dd4bf', label: 'Hub', letter: 'H' },
  'dungeon': { color: STATUS_BLOCKER, label: 'Dungeon', letter: 'D' },
  'custom': { color: 'var(--text-muted)', label: 'Custom', letter: '?' },
};

const PRIORITY_COLORS: Record<LoadPriority, string> = {
  always: STATUS_ERROR,
  high: STATUS_WARNING,
  normal: STATUS_INFO,
  low: 'var(--text-muted)',
};

const DEFAULT_ZONES: StreamingZone[] = [
  { id: 'z-town', name: 'Town', type: 'town', gridX: 2, gridY: 2, loadPriority: 'always', alwaysLoaded: true, preloadRadius: 2 },
  { id: 'z-forest', name: 'Dark Forest', type: 'forest', gridX: 3, gridY: 1, loadPriority: 'normal', alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-ruins', name: 'Old Ruins', type: 'ruins', gridX: 4, gridY: 2, loadPriority: 'normal', alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-cata', name: 'Catacombs', type: 'catacombs', gridX: 3, gridY: 3, loadPriority: 'low', alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-boss', name: 'Boss Arena', type: 'boss-arena', gridX: 5, gridY: 2, loadPriority: 'high', alwaysLoaded: false, preloadRadius: 2 },
];

const DEFAULT_TRANSITIONS: ZoneTransition[] = [
  { id: 'tr-1', fromId: 'z-town', toId: 'z-forest', style: 'seamless', triggerType: 'proximity', condition: '' },
  { id: 'tr-2', fromId: 'z-forest', toId: 'z-ruins', style: 'seamless', triggerType: 'proximity', condition: '' },
  { id: 'tr-3', fromId: 'z-town', toId: 'z-cata', style: 'fade', triggerType: 'interaction', condition: '' },
  { id: 'tr-4', fromId: 'z-ruins', toId: 'z-boss', style: 'loading-screen', triggerType: 'interaction', condition: 'Collect 3 Rune Fragments' },
];

// ── Props ──

interface StreamingZonePlannerProps {
  onGenerate: (config: StreamingZonePlannerConfig) => void;
  isGenerating: boolean;
}

// ── Component ──

export function StreamingZonePlanner({ onGenerate, isGenerating }: StreamingZonePlannerProps) {
  const [zones, setZones] = useState<StreamingZone[]>(() => structuredClone(DEFAULT_ZONES));
  const [transitions, setTransitions] = useState<ZoneTransition[]>(() => structuredClone(DEFAULT_TRANSITIONS));
  const [gridSize] = useState(7);
  const [paintType, setPaintType] = useState<ZoneType | 'erase' | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);

  // ── Grid helpers ──

  const zoneAt = useCallback((x: number, y: number) => {
    return zones.find((z) => z.gridX === x && z.gridY === y) ?? null;
  }, [zones]);

  const getAdjacentZoneIds = useCallback((zone: StreamingZone): string[] => {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const adj: string[] = [];
    for (const [dx, dy] of dirs) {
      const neighbor = zoneAt(zone.gridX + dx, zone.gridY + dy);
      if (neighbor) adj.push(neighbor.id);
    }
    return adj;
  }, [zoneAt]);

  // ── Zone CRUD ──

  const handleCellClick = useCallback((x: number, y: number) => {
    const existing = zoneAt(x, y);

    if (linkingFrom) {
      // Linking mode — connect linkingFrom to clicked zone
      if (existing && existing.id !== linkingFrom) {
        const exists = transitions.some(
          (t) => (t.fromId === linkingFrom && t.toId === existing.id) ||
            (t.fromId === existing.id && t.toId === linkingFrom)
        );
        if (!exists) {
          setTransitions((prev) => [
            ...prev,
            {
              id: `tr-${Date.now()}`,
              fromId: linkingFrom,
              toId: existing.id,
              style: 'seamless',
              triggerType: 'proximity',
              condition: '',
            },
          ]);
        }
      }
      setLinkingFrom(null);
      return;
    }

    if (paintType === 'erase') {
      if (existing) {
        setZones((prev) => prev.filter((z) => z.id !== existing.id));
        setTransitions((prev) => prev.filter((t) => t.fromId !== existing.id && t.toId !== existing.id));
        if (selectedZoneId === existing.id) setSelectedZoneId(null);
      }
      return;
    }

    if (paintType) {
      if (existing) {
        // Overwrite the zone type
        setZones((prev) => prev.map((z) =>
          z.id === existing.id ? { ...z, type: paintType, name: ZONE_TYPES[paintType].label } : z
        ));
        setSelectedZoneId(existing.id);
      } else {
        // Place a new zone
        const id = `z-${Date.now()}`;
        const newZone: StreamingZone = {
          id,
          name: ZONE_TYPES[paintType].label,
          type: paintType,
          gridX: x,
          gridY: y,
          loadPriority: 'normal',
          alwaysLoaded: false,
          preloadRadius: 1,
        };
        setZones((prev) => [...prev, newZone]);
        setSelectedZoneId(id);
      }
      return;
    }

    // No paint mode — select
    if (existing) {
      setSelectedZoneId(existing.id);
    } else {
      setSelectedZoneId(null);
    }
  }, [zoneAt, paintType, linkingFrom, transitions, selectedZoneId, zones]);

  const updateZone = useCallback((id: string, patch: Partial<StreamingZone>) => {
    setZones((prev) => prev.map((z) => z.id === id ? { ...z, ...patch } : z));
  }, []);

  const deleteTransition = useCallback((id: string) => {
    setTransitions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTransition = useCallback((id: string, patch: Partial<ZoneTransition>) => {
    setTransitions((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  }, []);

  // ── Derived ──

  const selectedZone = useMemo(
    () => selectedZoneId ? zones.find((z) => z.id === selectedZoneId) ?? null : null,
    [selectedZoneId, zones]
  );

  const transitionLines = useMemo(() => {
    return transitions.map((tr) => {
      const from = zones.find((z) => z.id === tr.fromId);
      const to = zones.find((z) => z.id === tr.toId);
      if (!from || !to) return null;
      return {
        ...tr,
        x1: from.gridX * CELL_SIZE + CELL_SIZE / 2,
        y1: from.gridY * CELL_SIZE + CELL_SIZE / 2,
        x2: to.gridX * CELL_SIZE + CELL_SIZE / 2,
        y2: to.gridY * CELL_SIZE + CELL_SIZE / 2,
        fromName: from.name,
        toName: to.name,
      };
    }).filter(Boolean) as (ZoneTransition & { x1: number; y1: number; x2: number; y2: number; fromName: string; toName: string })[];
  }, [transitions, zones]);

  const config: StreamingZonePlannerConfig = useMemo(() => ({ zones, transitions, gridSize }), [zones, transitions, gridSize]);

  const stats = useMemo(() => ({
    total: zones.length,
    alwaysLoaded: zones.filter((z) => z.alwaysLoaded).length,
    transitions: transitions.length,
  }), [zones, transitions]);

  return (
    <div className="p-6 space-y-6 overflow-y-auto w-full max-w-6xl mx-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      {/* Paint palette */}
      <div className="flex items-center gap-2 flex-wrap bg-[#03030a] p-3 rounded-2xl border border-violet-900/40 shadow-[inset_0_0_40px_rgba(167,139,250,0.05)]">
        <span className="text-[10px] uppercase tracking-widest font-mono text-violet-400/80 font-bold mx-2">PAINT_MODE</span>
        {(Object.entries(ZONE_TYPES) as [ZoneType, typeof ZONE_TYPES[ZoneType]][]).map(([type, cfg]) => {
          const active = paintType === type;
          return (
            <button
              key={type}
              onClick={() => setPaintType(active ? null : type)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors border"
              style={{
                color: active ? cfg.color : 'var(--text-muted)',
                borderColor: active ? `${cfg.color}50` : 'var(--border)',
                backgroundColor: active ? `${cfg.color}15` : 'var(--surface)',
              }}
            >
              <span
                className="w-3 h-3 rounded-sm text-2xs font-bold flex items-center justify-center"
                style={{ backgroundColor: `${cfg.color}25`, color: cfg.color }}
              >
                {cfg.letter}
              </span>
              {cfg.label}
            </button>
          );
        })}
        <div className="w-px h-6 bg-violet-900/40 mx-2" />
        <button
          onClick={() => setPaintType(paintType === 'erase' ? null : 'erase')}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border"
          style={{
            color: paintType === 'erase' ? STATUS_ERROR : 'var(--text-muted)',
            borderColor: paintType === 'erase' ? `${STATUS_ERROR}40` : 'var(--border)',
            backgroundColor: paintType === 'erase' ? `${STATUS_ERROR}10` : 'var(--surface)',
          }}
        >
          <Eraser className="w-3 h-3" />
          Erase
        </button>
        {selectedZoneId && !linkingFrom && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <button
              onClick={() => setLinkingFrom(selectedZoneId)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border text-[#fbbf24] border-[#fbbf2430] bg-[#fbbf2408]"
            >
              <Link2 className="w-3 h-3" />
              Link
            </button>
          </>
        )}
        {linkingFrom && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <button
              onClick={() => setLinkingFrom(null)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border text-[#f87171] border-[#f8717130] bg-[#f8717108]"
            >
              <X className="w-3 h-3" />
              Cancel Link
            </button>
          </>
        )}
      </div>

      {/* Dynamic Grid Layout */}
      <div className="flex flex-col lg:flex-row gap-6 relative z-10">

        {/* Main Grid Canvas */}
        <div className="flex-1 min-w-[550px] bg-[#03030a] rounded-2xl border-2 border-surface-deep shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] p-4 relative overflow-hidden flex items-center justify-center">

          {/* Ambient Glows */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/5 blur-[80px] rounded-full pointer-events-none" />
          </div>

          <svg
            width={gridSize * CELL_SIZE + 2}
            height={gridSize * CELL_SIZE + 2}
            className="block"
            style={{
              cursor: paintType ? 'crosshair' : linkingFrom ? 'crosshair' : 'default',
            }}
          >
            {/* Grid dots background */}
            <defs>
              <pattern id="sz-grid" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
                {/* Micro tech pattern within cells */}
                <rect width={CELL_SIZE} height={CELL_SIZE} fill="none" stroke="rgba(167,139,250,0.1)" strokeWidth={0.5} />
                <circle cx={CELL_SIZE} cy={CELL_SIZE} r={1.5} fill="rgba(167,139,250,0.3)" />
                <path d={`M ${CELL_SIZE / 2} 0 L ${CELL_SIZE / 2} ${CELL_SIZE} M 0 ${CELL_SIZE / 2} L ${CELL_SIZE} ${CELL_SIZE / 2}`} stroke="rgba(167,139,250,0.05)" strokeWidth={0.5} strokeDasharray="2,2" />
              </pattern>
              {/* Glow Filters */}
              <filter id="sz-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <rect x={1} y={1} width={gridSize * CELL_SIZE} height={gridSize * CELL_SIZE} fill="url(#sz-grid)" />

            {/* Transition lines */}
            {transitionLines.map((ln) => {
              const styleColor =
                ln.style === 'loading-screen' ? STATUS_ERROR
                  : ln.style === 'fade' ? ACCENT_VIOLET
                    : ln.style === 'portal' ? STATUS_WARNING
                      : '#3a3a6a';
              const isDashed = ln.style === 'loading-screen' || ln.style === 'portal';
              return (
                <g key={ln.id}>
                  <line
                    x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                    stroke={styleColor}
                    strokeWidth={2}
                    strokeDasharray={isDashed ? '6,4' : undefined}
                    opacity={0.3}
                    className="transition-colors duration-300"
                  />

                  {/* Data Flow Core */}
                  <line
                    x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                    stroke={styleColor}
                    strokeWidth={1}
                    strokeDasharray="4 12"
                    className="pointer-events-none"
                  >
                    <animate attributeName="stroke-dashoffset" from="16" to="0" dur="1s" repeatCount="indefinite" />
                  </line>

                  {/* Condition badge at midpoint */}
                  {ln.condition && (
                    <g transform={`translate(${(ln.x1 + ln.x2) / 2}, ${(ln.y1 + ln.y2) / 2 - 12})`}>
                      <rect
                        x={-ln.condition.length * 3 - 6}
                        y={-8}
                        width={ln.condition.length * 6 + 12}
                        height={16}
                        rx={4}
                        fill="rgba(5,5,16,0.9)"
                        stroke={STATUS_WARNING}
                        strokeWidth={1}
                        style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))" }}
                      />
                      <text
                        x={0} y={3}
                        fontSize={8}
                        fill={STATUS_WARNING}
                        textAnchor="middle"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {ln.condition.length > 20 ? ln.condition.slice(0, 20) + '...' : ln.condition.toUpperCase()}
                      </text>
                    </g>
                  )}
                  {/* Hit area for click */}
                  <line
                    x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                    stroke="transparent" strokeWidth={12}
                    style={{ cursor: 'pointer' }}
                    onContextMenu={(e) => { e.preventDefault(); deleteTransition(ln.id); }}
                  />
                </g>
              );
            })}

            {/* Grid cells — clickable empty areas */}
            {Array.from({ length: gridSize }, (_, y) =>
              Array.from({ length: gridSize }, (_, x) => {
                const zone = zoneAt(x, y);
                if (zone) return null; // drawn separately
                return (
                  <rect
                    key={`${x}-${y}`}
                    x={x * CELL_SIZE + 1}
                    y={y * CELL_SIZE + 1}
                    width={CELL_SIZE - 1}
                    height={CELL_SIZE - 1}
                    fill="transparent"
                    onClick={() => handleCellClick(x, y)}
                    style={{ cursor: paintType ? 'crosshair' : 'default' }}
                  />
                );
              })
            )}

            {/* Zone cells */}
            {zones.map((zone) => {
              const cfg = ZONE_TYPES[zone.type];
              const isSelected = selectedZoneId === zone.id;
              const isLinkTarget = linkingFrom !== null && linkingFrom !== zone.id;
              const cx = zone.gridX * CELL_SIZE;
              const cy = zone.gridY * CELL_SIZE;

              return (
                <g
                  key={zone.id}
                  onClick={() => handleCellClick(zone.gridX, zone.gridY)}
                  style={{ cursor: paintType ? 'crosshair' : linkingFrom ? 'crosshair' : 'pointer' }}
                >
                  {/* Preload radius indicator (animated radar ring) */}
                  {isSelected && zone.preloadRadius > 0 && (
                    <g>
                      {/* Inner fill area */}
                      <rect
                        x={cx - (zone.preloadRadius - 0.5) * CELL_SIZE + 4}
                        y={cy - (zone.preloadRadius - 0.5) * CELL_SIZE + 4}
                        width={(zone.preloadRadius * 2) * CELL_SIZE + CELL_SIZE - 8}
                        height={(zone.preloadRadius * 2) * CELL_SIZE + CELL_SIZE - 8}
                        rx={12}
                        fill={`${cfg.color}10`}
                        className="pointer-events-none"
                      />
                      {/* Pulsing border */}
                      <rect
                        x={cx - (zone.preloadRadius - 0.5) * CELL_SIZE + 4}
                        y={cy - (zone.preloadRadius - 0.5) * CELL_SIZE + 4}
                        width={(zone.preloadRadius * 2) * CELL_SIZE + CELL_SIZE - 8}
                        height={(zone.preloadRadius * 2) * CELL_SIZE + CELL_SIZE - 8}
                        rx={12}
                        fill="none"
                        stroke={`${cfg.color}50`}
                        strokeWidth={1}
                        strokeDasharray="8,8"
                        className="pointer-events-none"
                      >
                        <animate attributeName="stroke-dashoffset" from="32" to="0" dur="2s" repeatCount="indefinite" />
                      </rect>
                    </g>
                  )}

                  {/* Selection Highlight (Tech Brackets) */}
                  {isSelected && (
                    <g className="pointer-events-none" stroke={MODULE_COLORS.content} strokeWidth={2} fill="none">
                      <path d={`M ${cx - 2} ${cy + 10} L ${cx - 2} ${cy - 2} L ${cx + 10} ${cy - 2}`} />
                      <path d={`M ${cx + CELL_SIZE - 10} ${cy - 2} L ${cx + CELL_SIZE + 2} ${cy - 2} L ${cx + CELL_SIZE + 2} ${cy + 10}`} />
                      <path d={`M ${cx + CELL_SIZE + 2} ${cy + CELL_SIZE - 10} L ${cx + CELL_SIZE + 2} ${cy + CELL_SIZE + 2} L ${cx + CELL_SIZE - 10} ${cy + CELL_SIZE + 2}`} />
                      <path d={`M ${cx + 10} ${cy + CELL_SIZE + 2} L ${cx - 2} ${cy + CELL_SIZE + 2} L ${cx - 2} ${cy + CELL_SIZE - 10}`} />
                    </g>
                  )}

                  {/* Link target highlight */}
                  {isLinkTarget && (
                    <rect
                      x={cx} y={cy}
                      width={CELL_SIZE} height={CELL_SIZE}
                      rx={8}
                      fill="none"
                      stroke={STATUS_WARNING}
                      strokeWidth={2}
                      strokeDasharray="4,4"
                      opacity={0.8}
                      className="pointer-events-none animate-pulse"
                    />
                  )}

                  {/* Zone cell body - Glassmorphism Block */}
                  <rect
                    x={cx + 3} y={cy + 3}
                    width={CELL_SIZE - 6} height={CELL_SIZE - 6}
                    rx={8}
                    fill={`rgba(3,3,10,0.6)`}
                    stroke={isSelected ? cfg.color : `${cfg.color}50`}
                    strokeWidth={isSelected ? 1.5 : 1}
                    className="transition-colors duration-300"
                    style={{ backdropFilter: 'blur(4px)', filter: isSelected ? 'url(#sz-glow)' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}
                  />

                  {/* Inner Gradient Tint */}
                  <rect
                    x={cx + 4} y={cy + 4}
                    width={CELL_SIZE - 8} height={CELL_SIZE - 8}
                    rx={6}
                    fill={`${cfg.color}15`}
                    className="pointer-events-none"
                  />

                  {/* Always-loaded indicator bar */}
                  {zone.alwaysLoaded && (
                    <rect
                      x={cx + 4} y={cy + 4}
                      width={CELL_SIZE - 8} height={4}
                      rx={2}
                      fill={PRIORITY_COLORS.always}
                      opacity={0.9}
                      filter="url(#sz-glow)"
                    />
                  )}

                  {/* Zone letter */}
                  <text
                    x={cx + CELL_SIZE / 2}
                    y={cy + CELL_SIZE / 2 - 2}
                    fontSize={18}
                    fill={isSelected ? '#fff' : cfg.color}
                    textAnchor="middle"
                    fontFamily="monospace"
                    fontWeight={800}
                    opacity={0.9}
                    className="transition-colors duration-300 pointer-events-none"
                    style={{ textShadow: isSelected ? `0 0 10px ${cfg.color}80` : 'none' }}
                  >
                    {cfg.letter}
                  </text>

                  {/* Zone name */}
                  <text
                    x={cx + CELL_SIZE / 2}
                    y={cy + CELL_SIZE / 2 + 14}
                    fontSize={8}
                    fill="var(--text)"
                    textAnchor="middle"
                    fontFamily="monospace"
                    fontWeight={600}
                    letterSpacing={0.5}
                    className="uppercase pointer-events-none"
                  >
                    {zone.name.length > 10 ? zone.name.slice(0, 8) + '…' : zone.name}
                  </text>

                  {/* Priority dot / scanline */}
                  <g className="pointer-events-none">
                    <circle
                      cx={cx + CELL_SIZE - 12}
                      cy={cy + CELL_SIZE - 12}
                      r={3.5}
                      fill={PRIORITY_COLORS[zone.loadPriority]}
                      opacity={0.9}
                      filter="url(#sz-glow)"
                    />
                    <line
                      x1={cx + 4} y1={cy + CELL_SIZE - 12}
                      x2={cx + CELL_SIZE - 16} y2={cy + CELL_SIZE - 12}
                      stroke={PRIORITY_COLORS[zone.loadPriority]}
                      strokeWidth={0.5}
                      opacity={0.3}
                    />
                  </g>

                  {/* Preload radius label */}
                  <text
                    x={cx + 8}
                    y={cy + CELL_SIZE - 10}
                    fontSize={8}
                    fill="var(--text-muted)"
                    fontFamily="monospace"
                    fontWeight={600}
                    className="pointer-events-none"
                  >
                    R{zone.preloadRadius}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Floating Hint Overlay */}
          {linkingFrom && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none">
              <div className="bg-black/80 backdrop-blur border border-amber-500/50 rounded-full px-4 py-1.5 text-[10px] uppercase tracking-widest text-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-bounce font-mono">
                Select target node to establish flow pipeline
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Editor & Transitions) */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-6 relative z-10">
          {selectedZone && !linkingFrom && (
            <ZoneEditor
              zone={selectedZone!}
              onUpdate={(patch) => updateZone(selectedZone!.id, patch)}
              onClose={() => setSelectedZoneId(null)}
            />
          )}

          {/* Transition list */}
          {transitions.length > 0 && (
            <div className="bg-[#03030a] rounded-xl border border-violet-900/30 shadow-[inset_0_0_20px_rgba(167,139,250,0.05)] p-4 flex-1 overflow-y-auto">
              <div className="text-[10px] uppercase font-mono tracking-widest text-violet-400 mb-3 font-bold border-b border-violet-900/30 pb-2">
                Zone Pipelines ({transitions.length})
              </div>
              <div className="space-y-2">
                {transitions.map((tr) => {
                  const from = zones.find((z) => z.id === tr.fromId);
                  const to = zones.find((z) => z.id === tr.toId);
                  if (!from || !to) return null;
                  const styleCfg = TRANSITION_STYLES[tr.style];
                  return (
                    <div
                      key={tr.id}
                      className="flex flex-col gap-2 p-2.5 rounded-lg bg-surface-deep/50 border border-violet-900/20 text-xs shadow-inner"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-[10px] truncate max-w-[140px]">
                          <span className="text-violet-200 capitalize font-bold">{from.name}</span>
                          <span className="text-violet-500">→</span>
                          <span className="text-violet-200 capitalize font-bold">{to.name}</span>
                        </div>
                        <button
                          onClick={() => deleteTransition(tr.id)}
                          className="text-text-muted hover:text-red-400 transition-colors p-1 bg-surface rounded hover:bg-surface-hover"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={tr.style}
                          onChange={(e) => updateTransition(tr.id, { style: e.target.value as TransitionStyle })}
                          className="flex-1 text-[10px] bg-black/40 border border-violet-900/40 rounded px-1.5 py-1 text-violet-200 outline-none uppercase font-mono tracking-wide"
                          style={{
                            color: styleCfg.color,
                          }}
                        >
                          {(Object.entries(TRANSITION_STYLES) as [TransitionStyle, { label: string }][]).map(([key, v]) => (
                            <option key={key} value={key}>{v.label}</option>
                          ))}
                        </select>

                        <span className="text-[9px] text-violet-400 font-mono tracking-wider uppercase px-2 py-1 rounded bg-violet-900/20">{tr.triggerType}</span>
                      </div>

                      {/* Condition */}
                      {tr.condition && (
                        <div className="text-[9px] text-amber-400/90 truncate bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded font-mono mt-1">
                          REQ: {tr.condition}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary & Generate */}
          <div className="bg-[#03030a] rounded-xl border border-violet-900/30 shadow-[inset_0_0_20px_rgba(167,139,250,0.05)] p-4">
            <div className="flex items-center justify-between mb-3 text-[9px] font-mono tracking-widest uppercase text-violet-300">
              <span>{stats.total} ZONES</span>
              <span className="text-violet-800">|</span>
              <span>{stats.alwaysLoaded} PERSISTENT</span>
              <span className="text-violet-800">|</span>
              <span>{stats.transitions} PIPELINES</span>
            </div>
            <button
              onClick={() => onGenerate(config)}
              disabled={isGenerating || zones.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg"
              style={{
                backgroundColor: `${MODULE_COLORS.content}20`,
                color: MODULE_COLORS.content,
                border: `1px solid ${MODULE_COLORS.content}50`,
                boxShadow: `0 0 20px ${MODULE_COLORS.content}30, inset 0 0 10px ${MODULE_COLORS.content}20`,
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Config...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Generate Map Matrix
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Transition style config ──

const TRANSITION_STYLES: Record<TransitionStyle, { color: string; label: string }> = {
  seamless: { color: STATUS_SUCCESS, label: 'Seamless' },
  'loading-screen': { color: STATUS_ERROR, label: 'Loading' },
  fade: { color: ACCENT_VIOLET, label: 'Fade' },
  portal: { color: STATUS_WARNING, label: 'Portal' },
};

// ── Zone Editor ──

function ZoneEditor({
  zone,
  onUpdate,
  onClose,
}: {
  zone: StreamingZone;
  onUpdate: (patch: Partial<StreamingZone>) => void;
  onClose: () => void;
}) {
  const cfg = ZONE_TYPES[zone.type];

  return (
    <SurfaceCard level={2} className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
          >
            {cfg.letter}
          </span>
          <span className="text-xs font-semibold text-text">Edit Zone</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Name */}
        <div className="space-y-1">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Name</label>
          <input
            type="text"
            value={zone.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text outline-none focus:border-status-amber-strong transition-colors"
          />
        </div>

        {/* Type */}
        <div className="space-y-1">
          <label className="text-[9px] uppercase tracking-widest font-mono text-violet-400 font-bold mb-1 block">ZONE TYPE</label>
          <div className="relative">
            <select
              value={zone.type}
              onChange={(e) => onUpdate({ type: e.target.value as ZoneType })}
              className="w-full px-3 py-2 bg-black/40 border border-violet-900/40 rounded-lg text-xs font-mono text-violet-100 outline-none focus:border-violet-500 appearance-none transition-colors"
            >
              {(Object.entries(ZONE_TYPES) as [ZoneType, typeof ZONE_TYPES[ZoneType]][]).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-violet-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Load priority */}
        <div className="space-y-1 col-span-2 mt-2">
          <label className="text-[9px] uppercase tracking-widest font-mono text-violet-400 font-bold block mb-1">LOAD PRIORITY</label>
          <div className="flex gap-2">
            {(['low', 'normal', 'high', 'always'] as LoadPriority[]).map((p) => {
              const active = zone.loadPriority === p;
              const pColor = PRIORITY_COLORS[p];
              return (
                <button
                  key={p}
                  onClick={() => onUpdate({ loadPriority: p, alwaysLoaded: p === 'always' })}
                  className="flex-1 py-1.5 rounded-lg text-[10px] uppercase font-mono font-bold transition-all border shadow-sm"
                  style={{
                    color: active ? pColor : 'var(--text-muted)',
                    borderColor: active ? `${pColor}50` : 'var(--border)',
                    backgroundColor: active ? `${pColor}20` : 'rgba(0,0,0,0.3)',
                    boxShadow: active ? `inset 0 0 10px ${pColor}20` : 'none',
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preload radius */}
        <div className="space-y-1 col-span-2 pt-2 border-t border-violet-900/30">
          <label className="text-[9px] uppercase tracking-widest font-mono text-violet-400 font-bold block mb-1">PRELOAD SECS / RADIUS</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              value={zone.preloadRadius}
              onChange={(e) => onUpdate({ preloadRadius: Math.max(0, Math.min(4, Number(e.target.value) || 0)) })}
              min={0} max={4} step={1}
              className="flex-1 accent-violet-500"
            />
            <div className="w-8 h-8 rounded-lg bg-black/40 border border-violet-900/40 flex items-center justify-center text-xs font-mono font-bold text-violet-300">
              {zone.preloadRadius}
            </div>
          </div>
          <p className="text-[10px] text-violet-500/60 font-mono mt-1">Adjacent cell load threshold</p>
        </div>
      </div>

      {/* Always loaded toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={zone.alwaysLoaded}
          onChange={(e) => onUpdate({ alwaysLoaded: e.target.checked, loadPriority: e.target.checked ? 'always' : zone.loadPriority })}
          className="accent-[#f59e0b] w-3 h-3"
        />
        <span className="text-xs text-[#d0d4e8]">Always loaded (persistent zone)</span>
      </label>

      {/* Grid position */}
      <div className="flex items-center gap-4 text-2xs text-text-muted">
        <span>Grid: ({zone.gridX}, {zone.gridY})</span>
        <span className="text-[#2a2a4a]">|</span>
        <span>Priority: <span style={{ color: PRIORITY_COLORS[zone.loadPriority] }}>{zone.loadPriority}</span></span>
      </div>
    </SurfaceCard>
  );
}

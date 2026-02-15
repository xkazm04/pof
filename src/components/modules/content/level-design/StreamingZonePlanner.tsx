'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Plus, X, Send, Loader2, ChevronDown,
  Eraser, Link2,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

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

const CONTENT_ACCENT = '#f59e0b';
const CELL_SIZE = 72;

const ZONE_TYPES: Record<ZoneType, { color: string; label: string; letter: string }> = {
  'town':        { color: '#60a5fa', label: 'Town',        letter: 'T' },
  'forest':      { color: '#4ade80', label: 'Forest',      letter: 'F' },
  'ruins':       { color: '#a78bfa', label: 'Ruins',       letter: 'R' },
  'catacombs':   { color: '#8b8fb0', label: 'Catacombs',   letter: 'C' },
  'boss-arena':  { color: '#f87171', label: 'Boss Arena',  letter: 'B' },
  'hub':         { color: '#2dd4bf', label: 'Hub',         letter: 'H' },
  'dungeon':     { color: '#fb923c', label: 'Dungeon',     letter: 'D' },
  'custom':      { color: 'var(--text-muted)', label: 'Custom',      letter: '?' },
};

const PRIORITY_COLORS: Record<LoadPriority, string> = {
  always: '#f87171',
  high:   '#fbbf24',
  normal: '#60a5fa',
  low:    'var(--text-muted)',
};

const DEFAULT_ZONES: StreamingZone[] = [
  { id: 'z-town',   name: 'Town',        type: 'town',       gridX: 2, gridY: 2, loadPriority: 'always', alwaysLoaded: true,  preloadRadius: 2 },
  { id: 'z-forest', name: 'Dark Forest', type: 'forest',     gridX: 3, gridY: 1, loadPriority: 'normal', alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-ruins',  name: 'Old Ruins',   type: 'ruins',      gridX: 4, gridY: 2, loadPriority: 'normal', alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-cata',   name: 'Catacombs',   type: 'catacombs',  gridX: 3, gridY: 3, loadPriority: 'low',    alwaysLoaded: false, preloadRadius: 1 },
  { id: 'z-boss',   name: 'Boss Arena',  type: 'boss-arena', gridX: 5, gridY: 2, loadPriority: 'high',   alwaysLoaded: false, preloadRadius: 2 },
];

const DEFAULT_TRANSITIONS: ZoneTransition[] = [
  { id: 'tr-1', fromId: 'z-town',  toId: 'z-forest', style: 'seamless',       triggerType: 'proximity',    condition: '' },
  { id: 'tr-2', fromId: 'z-forest', toId: 'z-ruins',  style: 'seamless',       triggerType: 'proximity',    condition: '' },
  { id: 'tr-3', fromId: 'z-town',  toId: 'z-cata',   style: 'fade',           triggerType: 'interaction',  condition: '' },
  { id: 'tr-4', fromId: 'z-ruins', toId: 'z-boss',   style: 'loading-screen', triggerType: 'interaction',  condition: 'Collect 3 Rune Fragments' },
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
    <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      {/* Paint palette */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold mr-1">Paint:</span>
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
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={() => setPaintType(paintType === 'erase' ? null : 'erase')}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border"
          style={{
            color: paintType === 'erase' ? '#f87171' : 'var(--text-muted)',
            borderColor: paintType === 'erase' ? '#f8717140' : 'var(--border)',
            backgroundColor: paintType === 'erase' ? '#f8717110' : 'var(--surface)',
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

      {/* Grid */}
      <div className="bg-[#080818] rounded-lg border border-border p-3 overflow-auto">
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
              <rect width={CELL_SIZE} height={CELL_SIZE} fill="none" stroke="#1a1a30" strokeWidth={0.5} />
            </pattern>
          </defs>
          <rect x={1} y={1} width={gridSize * CELL_SIZE} height={gridSize * CELL_SIZE} fill="url(#sz-grid)" />

          {/* Transition lines */}
          {transitionLines.map((ln) => {
            const styleColor =
              ln.style === 'loading-screen' ? '#f87171'
                : ln.style === 'fade' ? '#a78bfa'
                  : ln.style === 'portal' ? '#fbbf24'
                    : '#3a3a6a';
            const isDashed = ln.style === 'loading-screen' || ln.style === 'portal';
            return (
              <g key={ln.id}>
                <line
                  x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                  stroke={styleColor}
                  strokeWidth={2}
                  strokeDasharray={isDashed ? '6,4' : undefined}
                  opacity={0.7}
                />
                {/* Condition badge at midpoint */}
                {ln.condition && (
                  <g transform={`translate(${(ln.x1 + ln.x2) / 2}, ${(ln.y1 + ln.y2) / 2 - 10})`}>
                    <rect
                      x={-ln.condition.length * 2.5 - 4}
                      y={-6}
                      width={ln.condition.length * 5 + 8}
                      height={12}
                      rx={3}
                      fill="var(--surface)"
                      stroke="var(--border)"
                    />
                    <text
                      x={0} y={3}
                      fontSize={7}
                      fill="#fbbf24"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      {ln.condition.length > 20 ? ln.condition.slice(0, 20) + '...' : ln.condition}
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
                {/* Preload radius indicator */}
                {isSelected && zone.preloadRadius > 0 && (
                  <rect
                    x={cx - (zone.preloadRadius - 0.5) * CELL_SIZE}
                    y={cy - (zone.preloadRadius - 0.5) * CELL_SIZE}
                    width={(zone.preloadRadius * 2) * CELL_SIZE + CELL_SIZE}
                    height={(zone.preloadRadius * 2) * CELL_SIZE + CELL_SIZE}
                    rx={4}
                    fill={`${cfg.color}04`}
                    stroke={`${cfg.color}15`}
                    strokeWidth={1}
                    strokeDasharray="4,3"
                  />
                )}

                {/* Selection highlight */}
                {isSelected && (
                  <rect
                    x={cx - 1} y={cy - 1}
                    width={CELL_SIZE + 2} height={CELL_SIZE + 2}
                    rx={8}
                    fill="none"
                    stroke={CONTENT_ACCENT}
                    strokeWidth={2}
                    opacity={0.7}
                  />
                )}

                {/* Link target highlight */}
                {isLinkTarget && (
                  <rect
                    x={cx} y={cy}
                    width={CELL_SIZE} height={CELL_SIZE}
                    rx={6}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    strokeDasharray="3,2"
                    opacity={0.7}
                  />
                )}

                {/* Zone cell body */}
                <rect
                  x={cx + 2} y={cy + 2}
                  width={CELL_SIZE - 4} height={CELL_SIZE - 4}
                  rx={6}
                  fill={`${cfg.color}12`}
                  stroke={`${cfg.color}50`}
                  strokeWidth={1}
                />

                {/* Always-loaded indicator bar */}
                {zone.alwaysLoaded && (
                  <rect
                    x={cx + 2} y={cy + 2}
                    width={CELL_SIZE - 4} height={3}
                    rx={6}
                    fill={PRIORITY_COLORS.always}
                    opacity={0.8}
                  />
                )}

                {/* Zone letter */}
                <text
                  x={cx + CELL_SIZE / 2}
                  y={cy + CELL_SIZE / 2 - 6}
                  fontSize={16}
                  fill={cfg.color}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  fontWeight={700}
                  opacity={0.9}
                >
                  {cfg.letter}
                </text>

                {/* Zone name */}
                <text
                  x={cx + CELL_SIZE / 2}
                  y={cy + CELL_SIZE / 2 + 8}
                  fontSize={8}
                  fill="var(--text)"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  fontWeight={500}
                >
                  {zone.name.length > 10 ? zone.name.slice(0, 10) + '…' : zone.name}
                </text>

                {/* Priority dot */}
                <circle
                  cx={cx + CELL_SIZE - 10}
                  cy={cy + CELL_SIZE - 10}
                  r={3}
                  fill={PRIORITY_COLORS[zone.loadPriority]}
                  opacity={0.9}
                />

                {/* Preload radius label */}
                <text
                  x={cx + 10}
                  y={cy + CELL_SIZE - 7}
                  fontSize={7}
                  fill="var(--text-muted)"
                  fontFamily="sans-serif"
                >
                  r{zone.preloadRadius}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hint */}
      {linkingFrom && (
        <div className="text-center text-xs text-[#fbbf24]">
          Click a zone to create a transition, or Cancel.
        </div>
      )}

      {/* Zone editor panel */}
      {selectedZone && !linkingFrom && (
        <ZoneEditor
          zone={selectedZone}
          onUpdate={(patch) => updateZone(selectedZone.id, patch)}
          onClose={() => setSelectedZoneId(null)}
        />
      )}

      {/* Transition list */}
      {transitions.length > 0 && (
        <SurfaceCard level={2} className="p-3">
          <div className="text-2xs uppercase tracking-wider text-text-muted font-semibold mb-2">
            Zone Transitions ({transitions.length})
          </div>
          <div className="space-y-1">
            {transitions.map((tr) => {
              const from = zones.find((z) => z.id === tr.fromId);
              const to = zones.find((z) => z.id === tr.toId);
              if (!from || !to) return null;
              const styleCfg = TRANSITION_STYLES[tr.style];
              return (
                <div
                  key={tr.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface border border-border text-xs"
                >
                  <span className="text-text font-medium">{from.name}</span>
                  <span className="text-text-muted">→</span>
                  <span className="text-text font-medium">{to.name}</span>

                  {/* Style badge */}
                  <span
                    className="text-2xs px-1.5 py-0.5 rounded border font-medium"
                    style={{
                      color: styleCfg.color,
                      borderColor: `${styleCfg.color}30`,
                      backgroundColor: `${styleCfg.color}10`,
                    }}
                  >
                    {styleCfg.label}
                  </span>

                  {/* Trigger */}
                  <span className="text-2xs text-text-muted">{tr.triggerType}</span>

                  {/* Condition */}
                  {tr.condition && (
                    <span className="text-2xs text-[#fbbf24] ml-auto truncate max-w-[120px]">
                      {tr.condition}
                    </span>
                  )}

                  {/* Style select */}
                  <select
                    value={tr.style}
                    onChange={(e) => updateTransition(tr.id, { style: e.target.value as TransitionStyle })}
                    className="ml-auto text-2xs bg-surface-deep border border-border rounded px-1 py-0.5 text-text-muted-hover outline-none"
                  >
                    {(Object.entries(TRANSITION_STYLES) as [TransitionStyle, { label: string }][]).map(([key, v]) => (
                      <option key={key} value={key}>{v.label}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => deleteTransition(tr.id)}
                    className="text-text-muted hover:text-[#f87171] transition-colors flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* Summary & Generate */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4 text-xs text-text-muted-hover">
            <span>{stats.total} zones</span>
            <span className="text-[#2a2a4a]">|</span>
            <span>{stats.alwaysLoaded} always loaded</span>
            <span className="text-[#2a2a4a]">|</span>
            <span>{stats.transitions} transitions</span>
          </div>
        </div>
        <button
          onClick={() => onGenerate(config)}
          disabled={isGenerating || zones.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${CONTENT_ACCENT}18`,
            color: CONTENT_ACCENT,
            border: `1px solid ${CONTENT_ACCENT}35`,
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Streaming Setup...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Generate Level Streaming with Claude
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Transition style config ──

const TRANSITION_STYLES: Record<TransitionStyle, { color: string; label: string }> = {
  seamless:        { color: '#4ade80', label: 'Seamless' },
  'loading-screen': { color: '#f87171', label: 'Loading' },
  fade:            { color: '#a78bfa', label: 'Fade' },
  portal:          { color: '#fbbf24', label: 'Portal' },
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
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Zone Type</label>
          <div className="relative">
            <select
              value={zone.type}
              onChange={(e) => onUpdate({ type: e.target.value as ZoneType })}
              className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text outline-none focus:border-status-amber-strong appearance-none transition-colors"
            >
              {(Object.entries(ZONE_TYPES) as [ZoneType, typeof ZONE_TYPES[ZoneType]][]).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Load priority */}
        <div className="space-y-1">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Load Priority</label>
          <div className="flex gap-1">
            {(['low', 'normal', 'high', 'always'] as LoadPriority[]).map((p) => {
              const active = zone.loadPriority === p;
              const pColor = PRIORITY_COLORS[p];
              return (
                <button
                  key={p}
                  onClick={() => onUpdate({ loadPriority: p, alwaysLoaded: p === 'always' })}
                  className="flex-1 py-1.5 rounded text-2xs font-medium transition-colors border capitalize"
                  style={{
                    color: active ? pColor : 'var(--text-muted)',
                    borderColor: active ? `${pColor}40` : 'var(--border)',
                    backgroundColor: active ? `${pColor}10` : 'var(--surface)',
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preload radius */}
        <div className="space-y-1">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Preload Radius</label>
          <input
            type="number"
            value={zone.preloadRadius}
            onChange={(e) => onUpdate({ preloadRadius: Math.max(0, Math.min(4, Number(e.target.value) || 0)) })}
            min={0} max={4}
            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text outline-none focus:border-status-amber-strong transition-colors"
          />
          <p className="text-2xs text-text-muted">Cells ahead to begin async loading</p>
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

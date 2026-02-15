'use client';

import { useState, useCallback, useRef } from 'react';
import { Plus, Volume2, Radio } from 'lucide-react';
import type { AudioZone, SoundEmitter, AudioZoneShape, EmitterType } from '@/types/audio-scene';

// ── Constants ──

const ZONE_COLORS: Record<string, string> = {
  'none':           'var(--text-muted)',
  'small-room':     '#60a5fa',
  'large-hall':     '#a78bfa',
  'cave':           '#8b8fb0',
  'outdoor':        '#4ade80',
  'underwater':     '#22d3ee',
  'metal-corridor': '#fb923c',
  'stone-chamber':  '#fbbf24',
  'forest':         '#34d399',
  'custom':         '#f472b6',
};

const EMITTER_COLORS: Record<EmitterType, string> = {
  ambient: '#4ade80',
  point:   '#60a5fa',
  loop:    '#a78bfa',
  oneshot: '#fbbf24',
  music:   '#f472b6',
};

interface AudioScenePainterProps {
  zones: AudioZone[];
  emitters: SoundEmitter[];
  onUpdateZones: (zones: AudioZone[]) => void;
  onUpdateEmitters: (emitters: SoundEmitter[]) => void;
  onSelectZone: (zoneId: string | null) => void;
  onSelectEmitter: (emitterId: string | null) => void;
  selectedZoneId: string | null;
  selectedEmitterId: string | null;
  accentColor: string;
}

type PaintMode = 'select' | 'zone-rect' | 'zone-circle' | 'emitter';

interface DrawState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  shape: AudioZoneShape;
}

export function AudioScenePainter({
  zones,
  emitters,
  onUpdateZones,
  onUpdateEmitters,
  onSelectZone,
  onSelectEmitter,
  selectedZoneId,
  selectedEmitterId,
  accentColor,
}: AudioScenePainterProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paintMode, setPaintMode] = useState<PaintMode>('select');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dragState, setDragState] = useState<{ id: string; type: 'zone' | 'emitter'; offsetX: number; offsetY: number } | null>(null);
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [resizeState, setResizeState] = useState<{ zoneId: string; handle: string; startX: number; startY: number; origW: number; origH: number } | null>(null);

  const getSVGPoint = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - pan.x,
      y: e.clientY - rect.top - pan.y,
    };
  }, [pan]);

  // ── Zone drawing ──

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as SVGElement;
    if (target !== svgRef.current && target.tagName !== 'rect') {
      return;
    }

    if (paintMode === 'zone-rect' || paintMode === 'zone-circle') {
      const pt = getSVGPoint(e);
      setDrawState({
        startX: pt.x,
        startY: pt.y,
        currentX: pt.x,
        currentY: pt.y,
        shape: paintMode === 'zone-rect' ? 'rect' : 'circle',
      });
      return;
    }

    if (paintMode === 'emitter') {
      const pt = getSVGPoint(e);
      const id = `emitter-${Date.now()}`;
      const newEmitter: SoundEmitter = {
        id,
        name: `Emitter ${emitters.length + 1}`,
        type: 'ambient',
        x: pt.x,
        y: pt.y,
        soundCueRef: '',
        attenuationRadius: 60,
        volumeMultiplier: 1.0,
        pitchMin: 0.9,
        pitchMax: 1.1,
        spawnChance: 1.0,
        cooldownSeconds: 0,
        zoneId: findContainingZone(pt.x, pt.y, zones),
      };
      onUpdateEmitters([...emitters, newEmitter]);
      onSelectEmitter(id);
      onSelectZone(null);
      setPaintMode('select');
      return;
    }

    // Select mode — start panning
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setIsPanning(true);
    onSelectZone(null);
    onSelectEmitter(null);
  }, [paintMode, getSVGPoint, emitters, zones, onUpdateEmitters, onSelectEmitter, onSelectZone, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (drawState) {
      const pt = getSVGPoint(e);
      setDrawState({ ...drawState, currentX: pt.x, currentY: pt.y });
      return;
    }

    if (resizeState) {
      const pt = getSVGPoint(e);
      const dx = pt.x - resizeState.startX;
      const dy = pt.y - resizeState.startY;
      const newW = Math.max(40, resizeState.origW + dx);
      const newH = Math.max(40, resizeState.origH + dy);
      onUpdateZones(zones.map((z) =>
        z.id === resizeState.zoneId ? { ...z, width: newW, height: newH } : z
      ));
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x + panStart.current.panX,
        y: e.clientY - panStart.current.y + panStart.current.panY,
      });
      return;
    }

    if (dragState) {
      const pt = getSVGPoint(e);
      if (dragState.type === 'zone') {
        onUpdateZones(zones.map((z) =>
          z.id === dragState.id ? { ...z, x: pt.x - dragState.offsetX, y: pt.y - dragState.offsetY } : z
        ));
      } else {
        onUpdateEmitters(emitters.map((em) =>
          em.id === dragState.id ? { ...em, x: pt.x - dragState.offsetX, y: pt.y - dragState.offsetY } : em
        ));
      }
    }
  }, [drawState, resizeState, isPanning, dragState, getSVGPoint, zones, emitters, onUpdateZones, onUpdateEmitters]);

  const handleMouseUp = useCallback(() => {
    if (drawState) {
      const x = Math.min(drawState.startX, drawState.currentX);
      const y = Math.min(drawState.startY, drawState.currentY);
      const w = Math.abs(drawState.currentX - drawState.startX);
      const h = Math.abs(drawState.currentY - drawState.startY);

      if (w > 20 || h > 20) {
        const id = `zone-${Date.now()}`;
        const isCircle = drawState.shape === 'circle';
        const newZone: AudioZone = {
          id,
          name: `Zone ${zones.length + 1}`,
          shape: drawState.shape,
          x: isCircle ? drawState.startX : x,
          y: isCircle ? drawState.startY : y,
          width: isCircle ? Math.max(w, h) : w,
          height: isCircle ? Math.max(w, h) : h,
          soundscapeDescription: '',
          reverbPreset: 'none',
          reverbDecayTime: 1.5,
          reverbDiffusion: 0.7,
          reverbWetDry: 0.5,
          attenuationRadius: 200,
          occlusionMode: 'medium',
          priority: 5,
          color: Object.values(ZONE_COLORS)[zones.length % Object.values(ZONE_COLORS).length],
          linkedFiles: [],
        };
        onUpdateZones([...zones, newZone]);
        onSelectZone(id);
        onSelectEmitter(null);
      }

      setDrawState(null);
      setPaintMode('select');
      return;
    }

    setResizeState(null);
    setDragState(null);
    setIsPanning(false);
  }, [drawState, zones, onUpdateZones, onSelectZone, onSelectEmitter]);

  // ── Item interaction ──

  const handleZoneMouseDown = useCallback((e: React.MouseEvent, zoneId: string) => {
    if (paintMode !== 'select') return;
    e.stopPropagation();
    const pt = getSVGPoint(e);
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    setDragState({ id: zoneId, type: 'zone', offsetX: pt.x - zone.x, offsetY: pt.y - zone.y });
    onSelectZone(zoneId);
    onSelectEmitter(null);
  }, [paintMode, getSVGPoint, zones, onSelectZone, onSelectEmitter]);

  const handleEmitterMouseDown = useCallback((e: React.MouseEvent, emitterId: string) => {
    if (paintMode !== 'select') return;
    e.stopPropagation();
    const pt = getSVGPoint(e);
    const em = emitters.find((em) => em.id === emitterId);
    if (!em) return;
    setDragState({ id: emitterId, type: 'emitter', offsetX: pt.x - em.x, offsetY: pt.y - em.y });
    onSelectEmitter(emitterId);
    onSelectZone(null);
  }, [paintMode, getSVGPoint, emitters, onSelectEmitter, onSelectZone]);

  const handleResizeStart = useCallback((e: React.MouseEvent, zoneId: string, handle: string) => {
    e.stopPropagation();
    const pt = getSVGPoint(e);
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    setResizeState({ zoneId, handle, startX: pt.x, startY: pt.y, origW: zone.width, origH: zone.height });
  }, [getSVGPoint, zones]);

  const deleteZone = useCallback((zoneId: string) => {
    onUpdateZones(zones.filter((z) => z.id !== zoneId));
    // Unlink emitters from this zone
    onUpdateEmitters(emitters.map((em) => em.zoneId === zoneId ? { ...em, zoneId: null } : em));
    if (selectedZoneId === zoneId) onSelectZone(null);
  }, [zones, emitters, onUpdateZones, onUpdateEmitters, selectedZoneId, onSelectZone]);

  const deleteEmitter = useCallback((emitterId: string) => {
    onUpdateEmitters(emitters.filter((em) => em.id !== emitterId));
    if (selectedEmitterId === emitterId) onSelectEmitter(null);
  }, [emitters, onUpdateEmitters, selectedEmitterId, onSelectEmitter]);

  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (drawState) return 'crosshair';
    if (paintMode === 'zone-rect' || paintMode === 'zone-circle') return 'crosshair';
    if (paintMode === 'emitter') return 'crosshair';
    return 'grab';
  };

  return (
    <div className="relative w-full h-full bg-[#080818] overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
        <ToolBtn
          active={paintMode === 'select'}
          onClick={() => setPaintMode('select')}
          label="Select"
        />
        <ToolBtn
          active={paintMode === 'zone-rect'}
          onClick={() => setPaintMode('zone-rect')}
          label="Zone"
          icon={<Volume2 className="w-3 h-3" />}
        />
        <ToolBtn
          active={paintMode === 'zone-circle'}
          onClick={() => setPaintMode('zone-circle')}
          label="Radial"
          icon={<Radio className="w-3 h-3" />}
        />
        <ToolBtn
          active={paintMode === 'emitter'}
          onClick={() => setPaintMode('emitter')}
          label="Emitter"
          icon={<Plus className="w-3 h-3" />}
        />
      </div>

      {/* Stats badge */}
      <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded text-xs bg-surface border border-border text-text-muted">
        {zones.length} zones &middot; {emitters.length} emitters
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: getCursor() }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid */}
        <defs>
          <pattern id="audio-grid" width="24" height="24" patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x % 24},${pan.y % 24})`}
          >
            <circle cx="12" cy="12" r="0.5" fill="var(--border)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#audio-grid)" />

        <g transform={`translate(${pan.x},${pan.y})`}>
          {/* Audio zones */}
          {zones.map((zone) => {
            const isSelected = selectedZoneId === zone.id;
            const zoneColor = zone.color || ZONE_COLORS[zone.reverbPreset] || 'var(--text-muted)';

            return (
              <g key={zone.id}>
                {/* Attenuation radius (outer glow) */}
                {zone.shape === 'circle' ? (
                  <circle
                    cx={zone.x} cy={zone.y}
                    r={zone.attenuationRadius}
                    fill={`${zoneColor}05`}
                    stroke={`${zoneColor}15`}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                ) : (
                  <rect
                    x={zone.x - 30} y={zone.y - 30}
                    width={zone.width + 60} height={zone.height + 60}
                    rx={12}
                    fill={`${zoneColor}05`}
                    stroke={`${zoneColor}15`}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                )}

                {/* Zone body */}
                {zone.shape === 'circle' ? (
                  <circle
                    cx={zone.x} cy={zone.y}
                    r={zone.width / 2}
                    fill={`${zoneColor}12`}
                    stroke={isSelected ? accentColor : `${zoneColor}60`}
                    strokeWidth={isSelected ? 2 : 1}
                    onMouseDown={(e) => handleZoneMouseDown(e, zone.id)}
                    style={{ cursor: paintMode === 'select' ? 'pointer' : undefined }}
                  />
                ) : (
                  <rect
                    x={zone.x} y={zone.y}
                    width={zone.width} height={zone.height}
                    rx={6}
                    fill={`${zoneColor}12`}
                    stroke={isSelected ? accentColor : `${zoneColor}60`}
                    strokeWidth={isSelected ? 2 : 1}
                    onMouseDown={(e) => handleZoneMouseDown(e, zone.id)}
                    style={{ cursor: paintMode === 'select' ? 'pointer' : undefined }}
                  />
                )}

                {/* Zone label */}
                {zone.shape === 'circle' ? (
                  <text
                    x={zone.x} y={zone.y - zone.width / 2 - 8}
                    textAnchor="middle"
                    fontSize={10} fill={zoneColor} fontFamily="sans-serif" fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    {zone.name}
                  </text>
                ) : (
                  <text
                    x={zone.x + 8} y={zone.y + 16}
                    fontSize={10} fill={zoneColor} fontFamily="sans-serif" fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    {zone.name}
                  </text>
                )}

                {/* Reverb badge */}
                {zone.shape === 'rect' && (
                  <text
                    x={zone.x + 8} y={zone.y + 30}
                    fontSize={8} fill={`${zoneColor}80`} fontFamily="sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {zone.reverbPreset} · {zone.occlusionMode}
                  </text>
                )}

                {/* Selection controls */}
                {isSelected && paintMode === 'select' && (
                  <>
                    {/* Delete button */}
                    <g
                      transform={zone.shape === 'circle'
                        ? `translate(${zone.x + zone.width / 2 - 8},${zone.y - zone.width / 2 - 24})`
                        : `translate(${zone.x + zone.width - 16},${zone.y - 20})`}
                      onClick={(e) => { e.stopPropagation(); deleteZone(zone.id); }}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect x={0} y={0} width={16} height={16} rx={4} fill="#f8717125" />
                      <text x={4} y={12} fontSize={10} fill="#f87171">&times;</text>
                    </g>

                    {/* Resize handle (rect only) */}
                    {zone.shape === 'rect' && (
                      <rect
                        x={zone.x + zone.width - 6}
                        y={zone.y + zone.height - 6}
                        width={12} height={12}
                        rx={2}
                        fill={accentColor}
                        opacity={0.6}
                        style={{ cursor: 'se-resize' }}
                        onMouseDown={(e) => handleResizeStart(e, zone.id, 'se')}
                      />
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* Sound emitters */}
          {emitters.map((em) => {
            const isSelected = selectedEmitterId === em.id;
            const emColor = EMITTER_COLORS[em.type] || '#60a5fa';

            return (
              <g key={em.id}>
                {/* Attenuation circle */}
                <circle
                  cx={em.x} cy={em.y}
                  r={em.attenuationRadius}
                  fill={`${emColor}08`}
                  stroke={`${emColor}20`}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Emitter body */}
                <circle
                  cx={em.x} cy={em.y}
                  r={8}
                  fill={`${emColor}30`}
                  stroke={isSelected ? accentColor : emColor}
                  strokeWidth={isSelected ? 2 : 1.5}
                  onMouseDown={(e) => handleEmitterMouseDown(e, em.id)}
                  style={{ cursor: paintMode === 'select' ? 'pointer' : undefined }}
                />

                {/* Inner dot */}
                <circle
                  cx={em.x} cy={em.y}
                  r={3}
                  fill={emColor}
                  style={{ pointerEvents: 'none' }}
                />

                {/* Sound wave arcs */}
                {em.type === 'ambient' || em.type === 'loop' ? (
                  <>
                    <path
                      d={`M ${em.x + 11} ${em.y - 4} A 6 6 0 0 1 ${em.x + 11} ${em.y + 4}`}
                      fill="none" stroke={`${emColor}50`} strokeWidth={1}
                      style={{ pointerEvents: 'none' }}
                    />
                    <path
                      d={`M ${em.x + 14} ${em.y - 7} A 10 10 0 0 1 ${em.x + 14} ${em.y + 7}`}
                      fill="none" stroke={`${emColor}30`} strokeWidth={1}
                      style={{ pointerEvents: 'none' }}
                    />
                  </>
                ) : null}

                {/* Label */}
                <text
                  x={em.x} y={em.y - 14}
                  textAnchor="middle"
                  fontSize={8} fill={emColor} fontFamily="sans-serif" fontWeight={600}
                  style={{ pointerEvents: 'none' }}
                >
                  {em.name}
                </text>

                {/* Delete on selection */}
                {isSelected && paintMode === 'select' && (
                  <g
                    transform={`translate(${em.x + 10},${em.y - 20})`}
                    onClick={(e) => { e.stopPropagation(); deleteEmitter(em.id); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect x={0} y={0} width={14} height={14} rx={3} fill="#f8717125" />
                    <text x={3} y={11} fontSize={9} fill="#f87171">&times;</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Drawing preview */}
          {drawState && (() => {
            const x = Math.min(drawState.startX, drawState.currentX);
            const y = Math.min(drawState.startY, drawState.currentY);
            const w = Math.abs(drawState.currentX - drawState.startX);
            const h = Math.abs(drawState.currentY - drawState.startY);

            if (drawState.shape === 'circle') {
              const r = Math.max(w, h) / 2;
              return (
                <circle
                  cx={drawState.startX} cy={drawState.startY}
                  r={r}
                  fill={`${accentColor}14`}
                  stroke={accentColor}
                  strokeWidth={2}
                  strokeDasharray="6,3"
                />
              );
            }

            return (
              <rect
                x={x} y={y} width={w} height={h}
                rx={6}
                fill={`${accentColor}14`}
                stroke={accentColor}
                strokeWidth={2}
                strokeDasharray="6,3"
              />
            );
          })()}
        </g>
      </svg>
    </div>
  );
}

// ── Helpers ──

function findContainingZone(x: number, y: number, zones: AudioZone[]): string | null {
  for (const zone of zones) {
    if (zone.shape === 'circle') {
      const dx = x - zone.x;
      const dy = y - zone.y;
      if (dx * dx + dy * dy <= (zone.width / 2) * (zone.width / 2)) return zone.id;
    } else {
      if (x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height) return zone.id;
    }
  }
  return null;
}

function ToolBtn({ active, onClick, label, icon }: {
  active: boolean; onClick: () => void; label: string; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active
          ? 'bg-surface-hover border-[#3e3e6a] text-text'
          : 'bg-surface border-border-bright text-text-muted-hover hover:bg-surface-hover hover:text-text'
      }`}
      style={{ border: `1px solid ${active ? '#3e3e6a' : 'var(--border-bright)'}` }}
    >
      {icon}
      {label}
    </button>
  );
}

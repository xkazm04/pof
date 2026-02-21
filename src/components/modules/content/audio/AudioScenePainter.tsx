'use client';

import { useState, useCallback, useRef } from 'react';
import { Plus, Volume2, Radio } from 'lucide-react';
import type { AudioZone, SoundEmitter, AudioZoneShape, EmitterType } from '@/types/audio-scene';
import {
  STATUS_INFO, ACCENT_VIOLET, STATUS_SUCCESS, STATUS_BLOCKER,
  STATUS_WARNING, ACCENT_EMERALD, ACCENT_PINK, STATUS_ERROR,
} from '@/lib/chart-colors';

// ── Constants ──

const ZONE_COLORS: Record<string, string> = {
  'none': 'var(--text-muted)',
  'small-room': STATUS_INFO,
  'large-hall': ACCENT_VIOLET,
  'cave': '#8b8fb0',
  'outdoor': STATUS_SUCCESS,
  'underwater': '#22d3ee',
  'metal-corridor': STATUS_BLOCKER,
  'stone-chamber': STATUS_WARNING,
  'forest': ACCENT_EMERALD,
  'custom': ACCENT_PINK,
};

const EMITTER_COLORS: Record<EmitterType, string> = {
  ambient: STATUS_SUCCESS,
  point: STATUS_INFO,
  loop: ACCENT_VIOLET,
  oneshot: STATUS_WARNING,
  music: ACCENT_PINK,
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
    <div className="relative w-full h-full bg-[#03030a] overflow-hidden rounded-2xl border border-blue-900/30 shadow-[inset_0_0_80px_rgba(59,130,246,0.05)]">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 blur-[120px] rounded-full" />
      </div>

      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-black/40 border border-blue-900/40 p-1.5 rounded-xl backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)] flex items-center gap-1">
          <ToolBtn
            active={paintMode === 'select'}
            onClick={() => setPaintMode('select')}
            label="SELECT"
          />
          <div className="w-px h-6 bg-blue-900/60 mx-1" />
          <ToolBtn
            active={paintMode === 'zone-rect'}
            onClick={() => setPaintMode('zone-rect')}
            label="VOL_RECT"
            icon={<Volume2 className="w-3.5 h-3.5" />}
          />
          <ToolBtn
            active={paintMode === 'zone-circle'}
            onClick={() => setPaintMode('zone-circle')}
            label="VOL_RADIAL"
            icon={<Radio className="w-3.5 h-3.5" />}
          />
          <div className="w-px h-6 bg-blue-900/60 mx-1" />
          <ToolBtn
            active={paintMode === 'emitter'}
            onClick={() => setPaintMode('emitter')}
            label="EMITTER"
            icon={<Plus className="w-3.5 h-3.5" />}
          />
        </div>
      </div>

      {/* Stats badge */}
      <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-[10px] font-mono font-bold text-blue-300 backdrop-blur-md uppercase tracking-widest shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center gap-3">
        <span className="flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 text-blue-500" /> {zones.length}</span>
        <span className="text-blue-500/50">/</span>
        <span className="flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-cyan-500" /> {emitters.length}</span>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full relative z-0"
        style={{ cursor: getCursor() }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid and defs */}
        <defs>
          <pattern id="audio-grid-major" width="96" height="96" patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x % 96},${pan.y % 96})`}>
            <path d="M 96 0 L 0 0 0 96" fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
          </pattern>
          <pattern id="audio-grid-minor" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x % 24},${pan.y % 24})`}>
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(59,130,246,0.05)" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(59,130,246,0.05)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#audio-grid-minor)" />
        <rect width="100%" height="100%" fill="url(#audio-grid-major)" />

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
                    fill={`url(#radar-glow)`}
                    stroke={`${zoneColor}20`}
                    strokeWidth={1}
                    strokeDasharray="4,8"
                  />
                ) : (
                  <rect
                    x={zone.x - 30} y={zone.y - 30}
                    width={zone.width + 60} height={zone.height + 60}
                    rx={12}
                    fill={`url(#radar-glow)`}
                    stroke={`${zoneColor}20`}
                    strokeWidth={1}
                    strokeDasharray="4,8"
                  />
                )}

                {/* Zone body */}
                {zone.shape === 'circle' ? (
                  <circle
                    cx={zone.x} cy={zone.y}
                    r={zone.width / 2}
                    fill={`${zoneColor}10`}
                    stroke={isSelected ? accentColor : `${zoneColor}60`}
                    strokeWidth={isSelected ? 2 : 1.5}
                    onMouseDown={(e) => handleZoneMouseDown(e, zone.id)}
                    style={{ cursor: paintMode === 'select' ? 'pointer' : undefined, filter: isSelected ? `drop-shadow(0 0 10px ${accentColor}40)` : 'none' }}
                  />
                ) : (
                  <rect
                    x={zone.x} y={zone.y}
                    width={zone.width} height={zone.height}
                    rx={2}
                    fill={`${zoneColor}10`}
                    stroke={isSelected ? accentColor : `${zoneColor}60`}
                    strokeWidth={isSelected ? 2 : 1.5}
                    onMouseDown={(e) => handleZoneMouseDown(e, zone.id)}
                    style={{ cursor: paintMode === 'select' ? 'pointer' : undefined, filter: isSelected ? `drop-shadow(0 0 10px ${accentColor}40)` : 'none' }}
                  />
                )}

                {/* Zone label */}
                <g style={{ pointerEvents: 'none' }}>
                  {zone.shape === 'circle' ? (
                    <>
                      <rect x={zone.x - 40} y={zone.y - zone.width / 2 - 16} width={80} height={14} rx={2} fill="rgba(0,0,0,0.6)" stroke={`${zoneColor}40`} strokeWidth={1} />
                      <text x={zone.x} y={zone.y - zone.width / 2 - 6} textAnchor="middle" fontSize={8} fill={zoneColor} fontFamily="monospace" fontWeight={700} style={{ textTransform: 'uppercase' }}>{zone.name}</text>
                    </>
                  ) : (
                    <>
                      <rect x={zone.x + 8} y={zone.y + 8} width={Math.max(80, zone.name.length * 6 + 10)} height={14} rx={2} fill="rgba(0,0,0,0.6)" stroke={`${zoneColor}40`} strokeWidth={1} />
                      <text x={zone.x + 12} y={zone.y + 18} fontSize={8} fill={zoneColor} fontFamily="monospace" fontWeight={700} style={{ textTransform: 'uppercase' }}>{zone.name}</text>

                      <text x={zone.x + 12} y={zone.y + 32} fontSize={7} fill={`${zoneColor}80`} fontFamily="monospace" style={{ textTransform: 'uppercase' }}>[{zone.reverbPreset}]</text>
                    </>
                  )}
                </g>

                {/* Selection controls */}
                {isSelected && paintMode === 'select' && (
                  <>
                    {/* Corner brackets for rect */}
                    {zone.shape === 'rect' && (
                      <>
                        <path d={`M ${zone.x - 4} ${zone.y + 10} L ${zone.x - 4} ${zone.y - 4} L ${zone.x + 10} ${zone.y - 4}`} fill="none" stroke={accentColor} strokeWidth={2} />
                        <path d={`M ${zone.x + zone.width - 10} ${zone.y - 4} L ${zone.x + zone.width + 4} ${zone.y - 4} L ${zone.x + zone.width + 4} ${zone.y + 10}`} fill="none" stroke={accentColor} strokeWidth={2} />
                        <path d={`M ${zone.x - 4} ${zone.y + zone.height - 10} L ${zone.x - 4} ${zone.y + zone.height + 4} L ${zone.x + 10} ${zone.y + zone.height + 4}`} fill="none" stroke={accentColor} strokeWidth={2} />
                        <path d={`M ${zone.x + zone.width - 10} ${zone.y + zone.height + 4} L ${zone.x + zone.width + 4} ${zone.y + zone.height + 4} L ${zone.x + zone.width + 4} ${zone.y + zone.height - 10}`} fill="none" stroke={accentColor} strokeWidth={2} />
                      </>
                    )}

                    {/* Delete button */}
                    <g
                      transform={zone.shape === 'circle'
                        ? `translate(${zone.x + zone.width / 2 - 8},${zone.y - zone.width / 2 - 24})`
                        : `translate(${zone.x + zone.width - 24},${zone.y + 8})`}
                      onClick={(e) => { e.stopPropagation(); deleteZone(zone.id); }}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect x={0} y={0} width={16} height={16} rx={4} fill={`${STATUS_ERROR}20`} stroke={`${STATUS_ERROR}50`} />
                      <text x={5} y={12} fontSize={10} fill={STATUS_ERROR} fontFamily="sans-serif" fontWeight={700}>×</text>
                    </g>

                    {/* Resize handle (rect only) */}
                    {zone.shape === 'rect' && (
                      <rect
                        x={zone.x + zone.width - 8}
                        y={zone.y + zone.height - 8}
                        width={16} height={16}
                        fill="transparent"
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
            const emColor = EMITTER_COLORS[em.type] || STATUS_INFO;

            return (
              <g key={em.id}>
                {/* Attenuation circle */}
                <circle
                  cx={em.x} cy={em.y}
                  r={em.attenuationRadius}
                  fill={`url(#radar-glow)`}
                  stroke={`${emColor}30`}
                  strokeWidth={1}
                  strokeDasharray="2,6"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Emitter body */}
                <circle
                  cx={em.x} cy={em.y}
                  r={10}
                  fill="rgba(0,0,0,0.6)"
                  stroke={isSelected ? accentColor : emColor}
                  strokeWidth={isSelected ? 2 : 1.5}
                  onMouseDown={(e) => handleEmitterMouseDown(e, em.id)}
                  style={{ cursor: paintMode === 'select' ? 'pointer' : undefined, filter: isSelected ? `drop-shadow(0 0 10px ${accentColor}50)` : `drop-shadow(0 0 5px ${emColor}40)` }}
                />

                {/* Inner dot */}
                <circle
                  cx={em.x} cy={em.y}
                  r={isSelected ? 4 : 3}
                  fill={isSelected ? accentColor : emColor}
                  style={{ pointerEvents: 'none', transition: 'all 0.3s' }}
                />

                {/* Sound wave arcs (radar ripples) */}
                {em.type === 'ambient' || em.type === 'loop' || em.type === 'music' ? (
                  <g style={{ pointerEvents: 'none' }}>
                    <circle cx={em.x} cy={em.y} r={16} fill="none" stroke={emColor} strokeWidth={1} opacity={0.4} strokeDasharray="4,8" />
                    <circle cx={em.x} cy={em.y} r={24} fill="none" stroke={emColor} strokeWidth={0.5} opacity={0.2} strokeDasharray="2,6" />
                  </g>
                ) : null}

                {/* Label */}
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={em.x - 30} y={em.y - 28} width={60} height={14} rx={2} fill="rgba(0,0,0,0.7)" stroke={`${emColor}40`} strokeWidth={1} />
                  <text x={em.x} y={em.y - 18} textAnchor="middle" fontSize={7} fill={emColor} fontFamily="monospace" fontWeight={700} style={{ textTransform: 'uppercase' }}>{em.name}</text>
                </g>

                {/* Delete on selection */}
                {isSelected && paintMode === 'select' && (
                  <g
                    transform={`translate(${em.x + 12},${em.y - 12})`}
                    onClick={(e) => { e.stopPropagation(); deleteEmitter(em.id); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect x={0} y={0} width={14} height={14} rx={3} fill={`${STATUS_ERROR}20`} stroke={`${STATUS_ERROR}50`} />
                    <text x={4} y={10} fontSize={9} fill={STATUS_ERROR} fontFamily="sans-serif" fontWeight={700}>×</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Drawing preview */}
          {drawState && ((ds) => {
            const x = Math.min(ds.startX, ds.currentX);
            const y = Math.min(ds.startY, ds.currentY);
            const w = Math.abs(ds.currentX - ds.startX);
            const h = Math.abs(ds.currentY - ds.startY);

            if (ds.shape === 'circle') {
              const r = Math.max(w, h) / 2;
              return (
                <circle
                  cx={ds.startX} cy={ds.startY}
                  r={r}
                  fill={`url(#radar-glow)`}
                  stroke={accentColor}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
              );
            }

            return (
              <rect
                x={x} y={y} width={w} height={h}
                rx={2}
                fill={`url(#radar-glow)`}
                stroke={accentColor}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            );
          })(drawState)}
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
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${active
        ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
        : 'bg-transparent text-blue-400/60 border-transparent hover:bg-blue-500/10 hover:text-blue-300'
        }`}
      style={{ borderStyle: 'solid', borderWidth: '1px' }}
    >
      {icon}
      {label}
    </button>
  );
}

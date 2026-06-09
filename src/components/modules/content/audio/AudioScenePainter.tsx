'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Plus, Minus, Volume2, Radio, Map as MapIcon } from 'lucide-react';
import type { AudioZone, SoundEmitter, AudioZoneShape, EmitterType } from '@/types/audio-scene';
import {
  STATUS_INFO, ACCENT_VIOLET, STATUS_SUCCESS, STATUS_BLOCKER,
  STATUS_WARNING, ACCENT_EMERALD, ACCENT_PINK, STATUS_ERROR,
  STATUS_SUBDUED, ACCENT_CYAN_LIGHT, withOpacity, OPACITY_10, OPACITY_20, OPACITY_30, OPACITY_60,
  MODULE_COLORS,
} from '@/lib/chart-colors';
import {
  type Viewport,
  IDENTITY_VIEW, ZOOM_STEP,
  contentBounds, fitView, zoomByFactor,
  viewportRectInContent, unionBounds, minimapProjection, minimapToContent, panToCenter,
} from '@/lib/audio-scene-viewport';
import { useElementSize } from '@/hooks/useElementSize';

const MINIMAP_W = 120;
const MINIMAP_H = 90;

const CHROME_ACCENT = MODULE_COLORS.content;

// ── Constants ──

export const ZONE_COLORS: Record<string, string> = {
  'none': 'var(--text-muted)',
  'small-room': STATUS_INFO,
  'large-hall': ACCENT_VIOLET,
  'cave': STATUS_SUBDUED,
  'outdoor': STATUS_SUCCESS,
  'underwater': ACCENT_CYAN_LIGHT,
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
  const minimapRef = useRef<SVGSVGElement>(null);
  const [containerRef, size] = useElementSize<HTMLDivElement>({ width: 800, height: 600 });
  const [paintMode, setPaintMode] = useState<PaintMode>('select');
  const [view, setView] = useState<Viewport>(IDENTITY_VIEW);
  const [isPanning, setIsPanning] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [isNavigatingMinimap, setIsNavigatingMinimap] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dragState, setDragState] = useState<{ id: string; type: 'zone' | 'emitter'; offsetX: number; offsetY: number } | null>(null);
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [resizeState, setResizeState] = useState<{ zoneId: string; handle: string; startX: number; startY: number; origW: number; origH: number } | null>(null);

  // ── Parent ↔ child relationship highlighting ──
  // Selecting an emitter clears the zone selection (and vice-versa), so the
  // parent-zone ring and the child-emitter cues are never active simultaneously.
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const selectedEmitter = selectedEmitterId
    ? emitters.find((em) => em.id === selectedEmitterId) ?? null
    : null;
  /** Zone whose child emitter is currently selected — gets the soft highlight ring. */
  const highlightedParentZoneId = selectedEmitter?.zoneId ?? null;

  const getSVGPoint = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - view.panX) / view.zoom,
      y: (e.clientY - rect.top - view.panY) / view.zoom,
    };
  }, [view]);

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
    panStart.current = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY };
    setIsPanning(true);
    onSelectZone(null);
    onSelectEmitter(null);
  }, [paintMode, getSVGPoint, emitters, zones, onUpdateEmitters, onSelectEmitter, onSelectZone, view]);

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
      setView((v) => ({
        ...v,
        panX: e.clientX - panStart.current.x + panStart.current.panX,
        panY: e.clientY - panStart.current.y + panStart.current.panY,
      }));
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

  // ── Zoom / pan viewport controls ──
  // The painter applies `view` as a `translate … scale` transform on the inner
  // <g>; button/keyboard zooms anchor on the viewport centre, wheel zooms on the
  // cursor. See `lib/audio-scene-viewport.ts` for the (tested) geometry.

  const zoomIn = useCallback(
    () => setView((v) => zoomByFactor(v, ZOOM_STEP, size.width / 2, size.height / 2)),
    [size.width, size.height],
  );
  const zoomOut = useCallback(
    () => setView((v) => zoomByFactor(v, 1 / ZOOM_STEP, size.width / 2, size.height / 2)),
    [size.width, size.height],
  );
  const resetView = useCallback(() => setView(IDENTITY_VIEW), []);
  const fitToContent = useCallback(
    () => setView(fitView(contentBounds(zones, emitters), size.width, size.height)),
    [zones, emitters, size.width, size.height],
  );

  // Ctrl/Cmd + wheel zooms about the cursor. Attached natively (non-passive) so
  // `preventDefault` can suppress the browser's page-zoom on the same gesture.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => zoomByFactor(v, factor, e.clientX - rect.left, e.clientY - rect.top));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case '+': case '=': e.preventDefault(); zoomIn(); break;
      case '-': case '_': e.preventDefault(); zoomOut(); break;
      case '0': e.preventDefault(); resetView(); break;
      case 'f': case 'F': e.preventDefault(); fitToContent(); break;
      default: break;
    }
  }, [zoomIn, zoomOut, resetView, fitToContent]);

  // ── Minimap projection + drag-to-navigate ──
  // World bounds = scene content ∪ the current viewport, so both the painted zones
  // and the "you are here" rectangle always stay on the minimap.
  const minimap = useMemo(() => {
    const vpRect = viewportRectInContent(view, size.width, size.height);
    const world = unionBounds(contentBounds(zones, emitters), vpRect) ?? vpRect;
    return { proj: minimapProjection(world, MINIMAP_W, MINIMAP_H), vpRect };
  }, [zones, emitters, view, size.width, size.height]);

  const navigateMinimap = useCallback((pt: { clientX: number; clientY: number }) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const { x, y } = minimapToContent(minimap.proj, pt.clientX - rect.left, pt.clientY - rect.top);
    setView((v) => ({ ...v, ...panToCenter(v.zoom, size.width, size.height, x, y) }));
  }, [minimap.proj, size.width, size.height]);

  const handleMinimapDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsNavigatingMinimap(true);
    navigateMinimap(e);
  }, [navigateMinimap]);

  // While dragging the minimap viewport, track globally so the pan keeps following
  // the cursor even when it leaves the 120×90 minimap area.
  useEffect(() => {
    if (!isNavigatingMinimap) return;
    const move = (e: MouseEvent) => navigateMinimap(e);
    const up = () => setIsNavigatingMinimap(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [isNavigatingMinimap, navigateMinimap]);

  const majorGrid = 96 * view.zoom;
  const minorGrid = 24 * view.zoom;

  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (drawState) return 'crosshair';
    if (paintMode === 'zone-rect' || paintMode === 'zone-circle') return 'crosshair';
    if (paintMode === 'emitter') return 'crosshair';
    return 'grab';
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="application"
      aria-label="Audio scene painter canvas. Keyboard: + and − zoom, 0 resets to 100%, F fits to content."
      className="relative w-full h-full bg-surface-deep overflow-hidden rounded-2xl border border-border outline-none focus-ring"
    >
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-surface border border-border p-1.5 rounded-xl backdrop-blur-md flex items-center gap-1">
          <ToolBtn
            active={paintMode === 'select'}
            onClick={() => setPaintMode('select')}
            label="SELECT"
          />
          <div className="w-px h-6 bg-border mx-1" />
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
          <div className="w-px h-6 bg-border mx-1" />
          <ToolBtn
            active={paintMode === 'emitter'}
            onClick={() => setPaintMode('emitter')}
            label="EMITTER"
            icon={<Plus className="w-3.5 h-3.5" />}
          />
        </div>
      </div>

      {/* Top-right cluster — stats badge + minimap */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        {/* Stats badge */}
        <div
          className="px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold text-text backdrop-blur-md flex items-center gap-3"
          style={{ borderColor: withOpacity(CHROME_ACCENT, OPACITY_30), backgroundColor: withOpacity(CHROME_ACCENT, OPACITY_10) }}
        >
          <span className="flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5" style={{ color: CHROME_ACCENT }} /> {zones.length}</span>
          <span className="text-text-muted">/</span>
          <span className="flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-text-muted" /> {emitters.length}</span>
        </div>

        {/* Minimap — filled zone rects + emitter dots + a draggable viewport box */}
        {showMinimap ? (
          <div className="rounded-lg bg-black/40 backdrop-blur-md border border-border overflow-hidden">
            <div className="flex items-center justify-between pl-2 pr-1 py-0.5">
              <span className="flex items-center gap-1 text-2xs font-mono uppercase tracking-widest text-text-muted">
                <MapIcon className="w-3 h-3" /> map
              </span>
              <button
                onClick={() => setShowMinimap(false)}
                title="Hide minimap"
                aria-label="Hide minimap"
                className="px-1 text-text-muted hover:text-text text-xs leading-none focus-ring rounded"
              >
                ×
              </button>
            </div>
            <svg
              ref={minimapRef}
              width={MINIMAP_W}
              height={MINIMAP_H}
              className="block cursor-pointer"
              onMouseDown={handleMinimapDown}
              aria-label="Scene minimap — drag to navigate"
            >
              {zones.map((z) => {
                const isCircle = z.shape === 'circle';
                const left = isCircle ? z.x - z.width / 2 : z.x;
                const top = isCircle ? z.y - z.width / 2 : z.y;
                const w = z.width;
                const h = isCircle ? z.width : z.height;
                const color = resolveZoneColor(z);
                return (
                  <rect
                    key={z.id}
                    x={minimap.proj.offsetX + left * minimap.proj.scale}
                    y={minimap.proj.offsetY + top * minimap.proj.scale}
                    width={Math.max(1, w * minimap.proj.scale)}
                    height={Math.max(1, h * minimap.proj.scale)}
                    rx={1}
                    fill={color}
                    fillOpacity={0.55}
                    stroke={color}
                    strokeOpacity={0.8}
                    strokeWidth={0.5}
                  />
                );
              })}
              {emitters.map((em) => (
                <circle
                  key={em.id}
                  cx={minimap.proj.offsetX + em.x * minimap.proj.scale}
                  cy={minimap.proj.offsetY + em.y * minimap.proj.scale}
                  r={1.5}
                  fill={EMITTER_COLORS[em.type] || STATUS_INFO}
                />
              ))}
              {/* Current viewport */}
              <rect
                x={minimap.proj.offsetX + minimap.vpRect.minX * minimap.proj.scale}
                y={minimap.proj.offsetY + minimap.vpRect.minY * minimap.proj.scale}
                width={Math.max(2, (minimap.vpRect.maxX - minimap.vpRect.minX) * minimap.proj.scale)}
                height={Math.max(2, (minimap.vpRect.maxY - minimap.vpRect.minY) * minimap.proj.scale)}
                fill={accentColor}
                fillOpacity={0.12}
                stroke={accentColor}
                strokeWidth={1}
                style={{ pointerEvents: 'none' }}
              />
            </svg>
          </div>
        ) : (
          <button
            onClick={() => setShowMinimap(true)}
            title="Show minimap"
            aria-label="Show minimap"
            className="flex items-center gap-1 rounded-lg bg-black/40 backdrop-blur-md border border-border px-2 py-1 text-2xs font-mono uppercase tracking-widest text-text-muted hover:text-text focus-ring"
          >
            <MapIcon className="w-3 h-3" /> map
          </button>
        )}
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
        {/* Grid and defs — spacing scales with zoom so the grid tracks content. */}
        <defs>
          <pattern id="audio-grid-major" width={majorGrid} height={majorGrid} patternUnits="userSpaceOnUse" patternTransform={`translate(${view.panX % majorGrid},${view.panY % majorGrid})`}>
            <path d={`M ${majorGrid} 0 L 0 0 0 ${majorGrid}`} fill="none" stroke="var(--border)" strokeWidth="1" opacity={0.6} />
          </pattern>
          <pattern id="audio-grid-minor" width={minorGrid} height={minorGrid} patternUnits="userSpaceOnUse" patternTransform={`translate(${view.panX % minorGrid},${view.panY % minorGrid})`}>
            <path d={`M ${minorGrid} 0 L 0 0 0 ${minorGrid}`} fill="none" stroke="var(--border)" strokeWidth="0.5" opacity={0.3} />
          </pattern>
          <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={withOpacity(CHROME_ACCENT, OPACITY_10)} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {minorGrid >= 8 && <rect width="100%" height="100%" fill="url(#audio-grid-minor)" />}
        <rect width="100%" height="100%" fill="url(#audio-grid-major)" />

        <g transform={`translate(${view.panX},${view.panY}) scale(${view.zoom})`}>
          {/* Audio zones */}
          {zones.map((zone) => {
            const isSelected = selectedZoneId === zone.id;
            const zoneColor = zone.color || ZONE_COLORS[zone.reverbPreset] || 'var(--text-muted)';
            const isParentOfSelectedEmitter = highlightedParentZoneId === zone.id;

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

                {/* Parent-zone highlight — soft ring shown while a child emitter is selected.
                    Always mounted; stroke-opacity toggles so it eases in/out over 200ms. */}
                {zone.shape === 'circle' ? (
                  <circle
                    cx={zone.x} cy={zone.y}
                    r={zone.width / 2}
                    fill="none"
                    stroke={zoneColor}
                    strokeWidth={4}
                    strokeOpacity={isParentOfSelectedEmitter ? 0.4 : 0}
                    style={{
                      pointerEvents: 'none',
                      filter: `drop-shadow(0 0 12px ${zoneColor})`,
                      transition: 'stroke-opacity 200ms var(--ease-out)',
                    }}
                  />
                ) : (
                  <rect
                    x={zone.x} y={zone.y}
                    width={zone.width} height={zone.height}
                    rx={2}
                    fill="none"
                    stroke={zoneColor}
                    strokeWidth={4}
                    strokeOpacity={isParentOfSelectedEmitter ? 0.4 : 0}
                    style={{
                      pointerEvents: 'none',
                      filter: `drop-shadow(0 0 12px ${zoneColor})`,
                      transition: 'stroke-opacity 200ms var(--ease-out)',
                    }}
                  />
                )}

                {/* Zone label */}
                <g style={{ pointerEvents: 'none' }}>
                  {zone.shape === 'circle' ? (
                    <>
                      <rect x={zone.x - 40} y={zone.y - zone.width / 2 - 16} width={80} height={14} rx={2} fill="var(--surface-deep)" stroke={`${zoneColor}40`} strokeWidth={1} />
                      <text x={zone.x} y={zone.y - zone.width / 2 - 6} textAnchor="middle" fontSize={8} fill={zoneColor} fontFamily="monospace" fontWeight={700} style={{ textTransform: 'uppercase' }}>{zone.name}</text>
                    </>
                  ) : (
                    <>
                      <rect x={zone.x + 8} y={zone.y + 8} width={Math.max(80, zone.name.length * 6 + 10)} height={14} rx={2} fill="var(--surface-deep)" stroke={`${zoneColor}40`} strokeWidth={1} />
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

          {/* Zone ↔ child-emitter connectors — faint dashed leaders from a zone's
              centroid to each of its emitters, revealed while that zone is selected.
              Rendered before the emitters so the lines pass beneath the glyphs. */}
          {emitters.map((em) => {
            if (!em.zoneId) return null;
            const parentZone = zoneById.get(em.zoneId);
            if (!parentZone) return null;
            const centroid = zoneCentroid(parentZone);
            const active = parentZone.id === selectedZoneId;
            return (
              <line
                key={`zone-link-${em.id}`}
                x1={centroid.x} y1={centroid.y}
                x2={em.x} y2={em.y}
                stroke={resolveZoneColor(parentZone)}
                strokeWidth={1}
                strokeDasharray="2,6"
                opacity={active ? 0.25 : 0}
                style={{ pointerEvents: 'none', transition: 'opacity 200ms var(--ease-out)' }}
              />
            );
          })}

          {/* Sound emitters */}
          {emitters.map((em) => {
            const isSelected = selectedEmitterId === em.id;
            const emColor = EMITTER_COLORS[em.type] || STATUS_INFO;
            const parentZone = em.zoneId ? zoneById.get(em.zoneId) : undefined;
            const isChildOfSelectedZone = !!parentZone && parentZone.id === selectedZoneId;
            const parentZoneColor = parentZone ? resolveZoneColor(parentZone) : emColor;

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
                  fill="var(--surface-deep)"
                  stroke={isSelected ? accentColor : emColor}
                  strokeWidth={isSelected ? 2 : 1.5}
                  onMouseDown={(e) => handleEmitterMouseDown(e, em.id)}
                  style={{ cursor: paintMode === 'select' ? 'pointer' : undefined, filter: isSelected ? `drop-shadow(0 0 10px ${accentColor}50)` : `drop-shadow(0 0 5px ${emColor}40)` }}
                />

                {/* Membership ring — 1px stroke in the parent zone's color, eased in
                    while that zone is selected so the emitter reads as a child of it. */}
                <circle
                  cx={em.x} cy={em.y}
                  r={13}
                  fill="none"
                  stroke={parentZoneColor}
                  strokeWidth={1}
                  opacity={isChildOfSelectedZone ? 1 : 0}
                  style={{ pointerEvents: 'none', transition: 'opacity 200ms var(--ease-out)' }}
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
                  <rect x={em.x - 30} y={em.y - 28} width={60} height={14} rx={2} fill="var(--surface-deep)" stroke={`${emColor}40`} strokeWidth={1} />
                  <text x={em.x} y={em.y - 18} textAnchor="middle" fontSize={7} fill={emColor} fontFamily="monospace" fontWeight={700} style={{ textTransform: 'uppercase' }}>{em.name}</text>
                </g>

                {/* Unzoned indicator — selected emitter has no parent zone to highlight */}
                {isSelected && !em.zoneId && (
                  <g className="audio-rel-pill" style={{ pointerEvents: 'none' }}>
                    <rect
                      x={em.x - 26} y={em.y - 44}
                      width={52} height={13} rx={6.5}
                      fill={withOpacity(STATUS_WARNING, OPACITY_20)}
                      stroke={withOpacity(STATUS_WARNING, OPACITY_60)}
                      strokeWidth={1}
                    />
                    <text
                      x={em.x} y={em.y - 34.5}
                      textAnchor="middle" fontSize={7}
                      fill={STATUS_WARNING} fontFamily="monospace" fontWeight={700}
                      style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
                    >Unzoned</text>
                  </g>
                )}

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

      {/* Zoom control cluster — zoom% | − | + | fit | 1:1 */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-0.5 rounded-lg bg-black/40 backdrop-blur-md border border-border px-1 py-0.5 font-mono text-2xs text-text">
        <span className="px-2 tabular-nums text-center select-none" style={{ minWidth: 46 }} aria-live="polite">
          {Math.round(view.zoom * 100)}%
        </span>
        <div className="w-px h-4 bg-border" />
        <ZoomBtn onClick={zoomOut} title="Zoom out (−)" ariaLabel="Zoom out"><Minus className="w-3.5 h-3.5" /></ZoomBtn>
        <ZoomBtn onClick={zoomIn} title="Zoom in (+)" ariaLabel="Zoom in"><Plus className="w-3.5 h-3.5" /></ZoomBtn>
        <div className="w-px h-4 bg-border" />
        <ZoomBtn onClick={fitToContent} title="Fit to content (F)" ariaLabel="Fit to content">fit</ZoomBtn>
        <ZoomBtn onClick={resetView} title="Reset to 100% (0)" ariaLabel="Reset zoom to 100%">1:1</ZoomBtn>
      </div>
    </div>
  );
}

// ── Helpers ──

/** Resolve a zone's display color, falling back to its reverb preset hue. */
function resolveZoneColor(zone: AudioZone): string {
  return zone.color || ZONE_COLORS[zone.reverbPreset] || 'var(--text-muted)';
}

/** Geometric center of a zone — circle origin is already its center, rect is top-left. */
function zoneCentroid(zone: AudioZone): { x: number; y: number } {
  return zone.shape === 'circle'
    ? { x: zone.x, y: zone.y }
    : { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
}

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
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-2xs font-semibold uppercase tracking-widest transition-all border ${active
        ? 'text-text'
        : 'bg-transparent border-transparent text-text-muted hover:bg-surface-hover hover:text-text'
        }`}
      style={active
        ? { color: CHROME_ACCENT, backgroundColor: withOpacity(CHROME_ACCENT, OPACITY_20), borderColor: withOpacity(CHROME_ACCENT, OPACITY_60) }
        : { borderColor: 'transparent' }}
    >
      {icon}
      {label}
    </button>
  );
}

function ZoomBtn({ onClick, title, ariaLabel, children }: {
  onClick: () => void; title: string; ariaLabel: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="flex items-center justify-center px-2 h-6 rounded-md uppercase tracking-wider text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-ring"
    >
      {children}
    </button>
  );
}

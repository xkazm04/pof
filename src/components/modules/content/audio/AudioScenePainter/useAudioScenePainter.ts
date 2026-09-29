import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';
import {
  type Viewport,
  IDENTITY_VIEW, ZOOM_STEP,
  contentBounds, fitView, zoomByFactor,
  viewportRectInContent, unionBounds, minimapProjection, minimapToContent, panToCenter,
} from '@/lib/audio-scene-viewport';
import { useElementSize } from '@/hooks/useElementSize';
import { resolveMembership } from '@/lib/audio-scene-ops';
import type { ListenerPoint } from '@/lib/audio-scene-audition';
import { useSceneBuffer } from '@/components/modules/content/audio/AudioView/useSceneBuffer';
import { MINIMAP_W, MINIMAP_H, ZONE_COLORS } from './constants';
import type { AudioScenePainterProps, PaintMode, DrawState, SceneDraft } from './types';

export function useAudioScenePainter({
  zones,
  emitters,
  onUpdateZones,
  onUpdateEmitters,
  onCommit,
  buffer: sharedBuffer,
  onSelectZone,
  onSelectEmitter,
  selectedZoneId,
  selectedEmitterId,
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
  // LISTEN mode: the audition listener is component state only — never persisted.
  const [listener, setListener] = useState<ListenerPoint | null>(null);
  const listenerDrag = useRef(false);

  // ── Optimistic commit buffer ──
  // A drag/resize used to call `onUpdateZones` on EVERY mousemove: one PUT + one
  // full refetch per event, and the refetch's `isLoading` unmounted this whole
  // subtree mid-gesture. Now a gesture only ever stages named ops (`SceneOp`) into
  // the scene buffer (pure local state, zero network) and commits ONCE on mouseup.
  //
  // The buffer holds OPS, not a scene snapshot: the canvas renders the server
  // scene with the ops replayed, and a write replays them onto the newest server
  // copy, so a change that lands while a gesture is buffered (a panel field, a
  // failed commit awaiting Retry) is kept, never hidden or overwritten. The ops
  // are cleared only when a commit SUCCEEDS; a FAILED commit keeps them and
  // `commitError` offers a retry. Emitter membership is re-derived by the reducer
  // after every geometry op (`lib/audio-scene-ops.ts`), not written here.
  //
  // With a shared `buffer` prop the property panels write through the same ops;
  // without one the painter builds its own over the write callbacks.
  /** True once a pointer gesture has actually moved something. */
  const gestureDirty = useRef(false);

  const serverScene = useMemo<SceneDraft>(() => ({ zones, emitters }), [zones, emitters]);

  const writeScene = useCallback(async (next: SceneDraft, base: SceneDraft) => {
    if (onCommit) {
      await onCommit(next);
      return;
    }
    // Compat path (no `onCommit`): write only the half that changed. The
    // comparison is against the server props, so a retry after a failed commit
    // may re-send both halves — correct, just not minimal.
    const writes: Array<void | Promise<unknown>> = [];
    if (next.zones !== base.zones) writes.push(onUpdateZones?.(next.zones));
    if (next.emitters !== base.emitters) writes.push(onUpdateEmitters?.(next.emitters));
    await Promise.all(writes);
  }, [onCommit, onUpdateZones, onUpdateEmitters]);

  const ownBuffer = useSceneBuffer({ base: serverScene, write: writeScene });
  const {
    scene: paintedScene,
    isDirty: hasUncommittedEdits,
    isSaving: isCommitting,
    saveError: commitError,
    stage: stageOps,
    commit: runCommit,
    retry: retryCommit,
    /** Hides the banner. The buffer is kept — dismissing is not discarding. */
    dismissError: dismissCommitError,
    peek,
  } = sharedBuffer ?? ownBuffer;

  const sceneZones = paintedScene?.zones ?? zones;
  const sceneEmitters = paintedScene?.emitters ?? emitters;

  /** The scene a gesture mutates: the live buffer if one exists, else the server props. */
  const baseScene = useCallback((): SceneDraft => peek() ?? serverScene, [peek, serverScene]);

  // ── Parent ↔ child relationship highlighting ──
  // Selecting an emitter clears the zone selection (and vice-versa), so the
  // parent-zone ring and the child-emitter cues are never active simultaneously.
  const zoneById = useMemo(() => new Map(sceneZones.map((z) => [z.id, z])), [sceneZones]);
  const selectedEmitter = selectedEmitterId
    ? sceneEmitters.find((em) => em.id === selectedEmitterId) ?? null
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
    if (paintMode === 'listen') { // anywhere on the canvas, over zones and emitters too
      setListener(getSVGPoint(e));
      listenerDrag.current = true;
      return;
    }
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
      const base = baseScene();
      const id = `emitter-${Date.now()}`;
      const newEmitter: SoundEmitter = {
        id,
        name: `Emitter ${base.emitters.length + 1}`,
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
        // Derived: the reducer re-derives it on every later geometry op too.
        zoneId: resolveMembership(pt.x, pt.y, base.zones),
      };
      runCommit([{ kind: 'addEmitter', emitter: newEmitter }]);
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
  }, [paintMode, getSVGPoint, baseScene, runCommit, onSelectEmitter, onSelectZone, view]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (listenerDrag.current) {
      setListener(getSVGPoint(e));
      return;
    }
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
      gestureDirty.current = true;
      stageOps([{ kind: 'resizeZone', id: resizeState.zoneId, width: newW, height: newH }]);
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
      gestureDirty.current = true;
      const x = pt.x - dragState.offsetX;
      const y = pt.y - dragState.offsetY;
      // Consecutive frames of one drag fold into ONE op (`foldSceneOps`).
      stageOps([dragState.type === 'zone'
        ? { kind: 'moveZone', id: dragState.id, x, y }
        : { kind: 'moveEmitter', id: dragState.id, x, y }]);
    }
  }, [drawState, resizeState, isPanning, dragState, getSVGPoint, stageOps]);

  const handleMouseUp = useCallback(() => {
    listenerDrag.current = false;
    if (drawState) {
      const x = Math.min(drawState.startX, drawState.currentX);
      const y = Math.min(drawState.startY, drawState.currentY);
      const w = Math.abs(drawState.currentX - drawState.startX);
      const h = Math.abs(drawState.currentY - drawState.startY);

      if (w > 20 || h > 20) {
        const base = baseScene();
        const id = `zone-${Date.now()}`;
        const isCircle = drawState.shape === 'circle';
        const newZone: AudioZone = {
          id,
          name: `Zone ${base.zones.length + 1}`,
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
          color: Object.values(ZONE_COLORS)[base.zones.length % Object.values(ZONE_COLORS).length],
        };
        runCommit([{ kind: 'addZone', zone: newZone }]);
        onSelectZone(id);
        onSelectEmitter(null);
      }

      gestureDirty.current = false;
      setDrawState(null);
      setPaintMode('select');
      return;
    }

    // The single write for the whole drag/resize — and only if something moved.
    if (gestureDirty.current) {
      gestureDirty.current = false;
      // No argument: commit exactly the ops the gesture staged.
      runCommit();
    }

    setResizeState(null);
    setDragState(null);
    setIsPanning(false);
  }, [drawState, baseScene, runCommit, onSelectZone, onSelectEmitter]);

  // ── Item interaction ──

  const handleZoneMouseDown = useCallback((e: React.MouseEvent, zoneId: string) => {
    if (paintMode !== 'select') return;
    e.stopPropagation();
    const pt = getSVGPoint(e);
    const zone = sceneZones.find((z) => z.id === zoneId);
    if (!zone) return;
    setDragState({ id: zoneId, type: 'zone', offsetX: pt.x - zone.x, offsetY: pt.y - zone.y });
    onSelectZone(zoneId);
    onSelectEmitter(null);
  }, [paintMode, getSVGPoint, sceneZones, onSelectZone, onSelectEmitter]);

  const handleEmitterMouseDown = useCallback((e: React.MouseEvent, emitterId: string) => {
    if (paintMode !== 'select') return;
    e.stopPropagation();
    const pt = getSVGPoint(e);
    const em = sceneEmitters.find((em) => em.id === emitterId);
    if (!em) return;
    setDragState({ id: emitterId, type: 'emitter', offsetX: pt.x - em.x, offsetY: pt.y - em.y });
    onSelectEmitter(emitterId);
    onSelectZone(null);
  }, [paintMode, getSVGPoint, sceneEmitters, onSelectEmitter, onSelectZone]);

  const handleResizeStart = useCallback((e: React.MouseEvent, zoneId: string, handle: string) => {
    e.stopPropagation();
    const pt = getSVGPoint(e);
    const zone = sceneZones.find((z) => z.id === zoneId);
    if (!zone) return;
    setResizeState({ zoneId, handle, startX: pt.x, startY: pt.y, origW: zone.width, origH: zone.height });
  }, [getSVGPoint, sceneZones]);

  const deleteZone = useCallback((zoneId: string) => {
    // One commit for both halves — the reducer re-derives the orphaned emitters'
    // zones (another containing zone, else null) in the same write.
    runCommit([{ kind: 'deleteZone', id: zoneId }]);
    if (selectedZoneId === zoneId) onSelectZone(null);
  }, [runCommit, selectedZoneId, onSelectZone]);

  const deleteEmitter = useCallback((emitterId: string) => {
    runCommit([{ kind: 'deleteEmitter', id: emitterId }]);
    if (selectedEmitterId === emitterId) onSelectEmitter(null);
  }, [runCommit, selectedEmitterId, onSelectEmitter]);

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
    () => setView(fitView(contentBounds(sceneZones, sceneEmitters), size.width, size.height)),
    [sceneZones, sceneEmitters, size.width, size.height],
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
  //
  // The O(zones+emitters) content-bounds scan only depends on the scene content, so
  // it is memoized separately on `[sceneZones, sceneEmitters]` — panning (which mutates
  // `view.panX/panY` every mousemove) never re-runs it. The remaining per-frame work
  // (the viewport rect, its union with the content bounds, and the projection) is all
  // O(1) and *must* track `view` so the "you are here" box and the world union stay
  // correct; the rendered minimap is byte-identical to the previous single memo.
  const sceneBounds = useMemo(() => contentBounds(sceneZones, sceneEmitters), [sceneZones, sceneEmitters]);
  const minimap = useMemo(() => {
    const vpRect = viewportRectInContent(view, size.width, size.height);
    const world = unionBounds(sceneBounds, vpRect) ?? vpRect;
    return { proj: minimapProjection(world, MINIMAP_W, MINIMAP_H), vpRect };
  }, [sceneBounds, view, size.width, size.height]);

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
    if (paintMode === 'emitter' || paintMode === 'listen') return 'crosshair';
    return 'grab';
  };

  return {
    containerRef,
    svgRef,
    minimapRef,
    paintMode,
    setPaintMode,
    view,
    showMinimap,
    setShowMinimap,
    drawState,
    listener,
    /** Scene as the user sees it: the optimistic buffer if one is live, else props. */
    sceneZones,
    sceneEmitters,
    hasUncommittedEdits,
    isCommitting,
    commitError,
    retryCommit,
    dismissCommitError,
    zoneById,
    highlightedParentZoneId,
    handleCanvasMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleZoneMouseDown,
    handleEmitterMouseDown,
    handleResizeStart,
    deleteZone,
    deleteEmitter,
    zoomIn,
    zoomOut,
    resetView,
    fitToContent,
    handleKeyDown,
    minimap,
    handleMinimapDown,
    majorGrid,
    minorGrid,
    getCursor,
  };
}

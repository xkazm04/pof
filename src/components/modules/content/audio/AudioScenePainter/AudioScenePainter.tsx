'use client';

import { withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import { CHROME_ACCENT } from './constants';
import type { AudioScenePainterProps } from './types';
import { useAudioScenePainter } from './useAudioScenePainter';
import { Toolbar } from './Toolbar';
import { Minimap } from './Minimap';
import { ZoneLayer } from './ZoneLayer';
import { EmitterLayer } from './EmitterLayer';
import { DrawPreview } from './DrawPreview';
import { ZoomCluster } from './ZoomCluster';
import { DesktopCanvasNotice } from '@/components/ui/DesktopCanvasNotice';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';

export function AudioScenePainter(props: AudioScenePainterProps) {
  const {
    selectedZoneId,
    selectedEmitterId,
    accentColor,
  } = props;

  const {
    containerRef,
    svgRef,
    minimapRef,
    paintMode,
    setPaintMode,
    view,
    showMinimap,
    setShowMinimap,
    drawState,
    // Render the optimistic buffer, not the (round-trip-stale) props.
    sceneZones,
    sceneEmitters,
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
  } = useAudioScenePainter(props);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="application"
      aria-label="Audio scene painter canvas. Keyboard: + and − zoom, 0 resets to 100%, F fits to content."
      className="relative w-full h-full bg-surface-deep overflow-hidden rounded-2xl border border-border outline-none focus-ring"
    >
      <DesktopCanvasNotice className="absolute top-2 left-1/2 -translate-x-1/2 z-30 max-w-[90%]" />

      {/* Toolbar */}
      <Toolbar paintMode={paintMode} setPaintMode={setPaintMode} />

      {/* Top-right cluster — stats badge + minimap */}
      <Minimap
        zones={sceneZones}
        emitters={sceneEmitters}
        showMinimap={showMinimap}
        setShowMinimap={setShowMinimap}
        minimapRef={minimapRef}
        handleMinimapDown={handleMinimapDown}
        minimap={minimap}
        accentColor={accentColor}
      />

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full relative z-0 touch-none-canvas"
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
          <ZoneLayer
            zones={sceneZones}
            selectedZoneId={selectedZoneId}
            highlightedParentZoneId={highlightedParentZoneId}
            accentColor={accentColor}
            paintMode={paintMode}
            handleZoneMouseDown={handleZoneMouseDown}
            handleResizeStart={handleResizeStart}
            deleteZone={deleteZone}
          />

          {/* Zone ↔ child-emitter connectors + sound emitters */}
          <EmitterLayer
            emitters={sceneEmitters}
            zoneById={zoneById}
            selectedZoneId={selectedZoneId}
            selectedEmitterId={selectedEmitterId}
            accentColor={accentColor}
            paintMode={paintMode}
            handleEmitterMouseDown={handleEmitterMouseDown}
            deleteEmitter={deleteEmitter}
          />

          {/* Drawing preview */}
          <DrawPreview drawState={drawState} accentColor={accentColor} />
        </g>
      </svg>

      {/* Commit feedback — a gesture writes once, on mouseup; this says whether it
          landed. On failure the local buffer is KEPT (the canvas still shows the
          user's edit) and Retry re-sends exactly that buffer. */}
      {commitError ? (
        <div className="absolute bottom-3 left-3 right-3 z-30 max-w-lg" data-testid="painter-commit-error">
          <InlineErrorRetry
            message={`${commitError} — your change is still on the canvas.`}
            onRetry={retryCommit}
            onDismiss={dismissCommitError}
            dismissLabel="Dismiss save error"
            dense
          />
        </div>
      ) : isCommitting ? (
        <div
          className="absolute bottom-3 left-3 z-30 px-2 py-1 rounded text-2xs text-text-muted bg-surface-deep border border-border"
          role="status"
        >
          Saving…
        </div>
      ) : null}

      {/* Zoom control cluster — zoom% | − | + | fit | 1:1 */}
      <ZoomCluster
        view={view}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        fitToContent={fitToContent}
        resetView={resetView}
      />
    </div>
  );
}

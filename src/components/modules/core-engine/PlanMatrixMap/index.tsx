'use client';

import {
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Link2, Flame,
  Clock, Zap, Layers, CheckCircle2, Filter,
} from 'lucide-react';
import { getModuleLabel } from '@/lib/implementation-planner/plan-generator';
import { formatEffortTime } from '@/lib/implementation-planner/effort-estimator';
import { usePlanMatrixMap } from './usePlanMatrixMap';
import { STATUS_DOT_COLORS } from './constants';
import { ToolbarBtn, ToggleBtn } from './ToolbarControls';
import { Sidebar } from './Sidebar';
import { Canvas } from './Canvas';
import { MiniMap } from './MiniMap';
import { DetailPanel } from './DetailPanel';

// ---------- Main Component ----------

interface PlanMatrixMapProps {
  /** When provided, auto-filters to this module and fades others as context */
  moduleId?: string;
}

export function PlanMatrixMap({ moduleId: initialModuleId }: PlanMatrixMapProps = {}) {
  const pm = usePlanMatrixMap(initialModuleId);
  const {
    rootRef, containerRef, canvasHeight,
    plan, loading, error,
    isSidebarOpen, setIsSidebarOpen,
    readyCount, transform, zoomToCenter, reset, handleZoomToFit,
    showDeps, setShowDeps, criticalPathMode, setCriticalPathMode,
    isPanningState, hoveredNode, hoverPos,
    selectedNode, setSelectedKey, handleExecute,
    layout, filterModuleId, setTransform, containerSize,
  } = pm;

  // --- Loading / error states ---

  if (loading && !plan) {
    return (
      <div className="flex items-center justify-center h-96 text-text-muted text-xs gap-2">
        <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Generating layout...
      </div>
    );
  }
  if (error) return <div className="text-center text-red-400 text-xs py-8">{error}</div>;
  if (!layout || !plan) return null;

  // --- Viewport for mini-map ---
  const viewportWorld = {
    x: -transform.panX / transform.zoom,
    y: -transform.panY / transform.zoom,
    w: containerSize.w / transform.zoom,
    h: containerSize.h / transform.zoom,
  };

  return (
    <div ref={rootRef} className="relative h-full bg-background flex overflow-hidden" style={{ height: canvasHeight }}>
      {/* ── Left Sidebar Navigator ── */}
      <Sidebar pm={pm} />

      {/* ── Main Canvas Area ── */}
      <div className="flex-1 relative h-full">
        {/* ── Top Left Floating Controls (Filters) ── */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center gap-2 bg-surface-deep/80 backdrop-blur-md border border-border/50 shadow-lg rounded-lg px-3 py-2 text-xs font-medium text-text-muted hover:text-text hover:bg-surface-deep transition-all"
            >
              <Filter className="w-4 h-4" />
              Show Navigator
            </button>
          )}
        </div>

      {/* ── Top Right Stats ── */}
      <div className="absolute top-4 right-4 flex items-center gap-4 px-4 py-2 bg-surface-deep/80 backdrop-blur-md border border-border/50 shadow-lg rounded-lg z-20 text-xs font-medium text-gray-300 select-none">
        <div className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> {plan.items.length} features</div>
        <div className="flex items-center gap-1.5 text-green-400"><CheckCircle2 className="w-3.5 h-3.5" /> {readyCount} ready</div>
        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatEffortTime(plan.totalEffortMinutes)}</div>
      </div>

      {/* ── Bottom Center Floating Dock ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-2 bg-surface-deep/85 backdrop-blur-md border border-border/50 shadow-2xl rounded-full z-30">
        <ToolbarBtn icon={ZoomOut} onClick={() => {
          const el = containerRef.current;
          if (el) zoomToCenter(0.8, el.clientWidth, el.clientHeight);
        }} title="Zoom out (−)" />
        <span className="text-xs font-mono text-gray-300 px-2 min-w-[48px] text-center select-none">
          {Math.round(transform.zoom * 100)}%
        </span>
        <ToolbarBtn icon={ZoomIn} onClick={() => {
          const el = containerRef.current;
          if (el) zoomToCenter(1.25, el.clientWidth, el.clientHeight);
        }} title="Zoom in (+)" />
        <div className="w-px h-5 bg-border/50 mx-2" />
        <ToolbarBtn icon={Maximize2} onClick={handleZoomToFit} title="Zoom to fit" />
        <ToolbarBtn icon={RotateCcw} onClick={reset} title="Reset view" />
        <div className="w-px h-5 bg-border/50 mx-2" />
        <ToggleBtn icon={Link2} active={showDeps} onClick={() => setShowDeps(!showDeps)} label="Deps" />
        <ToggleBtn icon={Flame} active={criticalPathMode} onClick={() => setCriticalPathMode(!criticalPathMode)} label="Critical" />
      </div>

      {/* ── Canvas ── */}
      <Canvas pm={pm} />

      {/* ── Tooltip ── */}
      {hoveredNode && !isPanningState && transform.zoom < 0.8 && (
        <div
          className="fixed z-50 px-3 py-2 rounded-lg bg-surface-deep/95 backdrop-blur-sm border border-border shadow-2xl pointer-events-none"
          style={{ left: hoverPos.x + 14, top: hoverPos.y - 8, maxWidth: 280 }}
        >
          <div className="text-xs font-medium text-white mb-1">{hoveredNode.item.featureName}</div>
          <div className="flex items-center gap-1.5 flex-wrap text-2xs">
            <span className="font-mono px-1 py-px rounded bg-surface-hover text-gray-300">
              {getModuleLabel(hoveredNode.item.moduleId)}
            </span>
            <span className="px-1 py-px rounded font-medium" style={{ backgroundColor: `${hoveredNode.color}20`, color: hoveredNode.color }}>
              {hoveredNode.item.status}
            </span>
            <span className="text-gray-300">
              <Clock className="w-2.5 h-2.5 inline mr-0.5" />{formatEffortTime(hoveredNode.item.effort.minutes)}
            </span>
            <span className="text-gray-300">
              <Zap className="w-2.5 h-2.5 inline mr-0.5" />{hoveredNode.item.impact.score} impact
            </span>
          </div>
          {hoveredNode.item.dependsOn.length > 0 && (
            <div className="text-2xs text-gray-400 mt-1">
              <Link2 className="w-2.5 h-2.5 inline mr-0.5" />
              {hoveredNode.item.dependsOn.length} dep{hoveredNode.item.dependsOn.length !== 1 ? 's' : ''}
            </div>
          )}
          {hoveredNode.item.isReady && <div className="text-2xs text-green-400 mt-0.5">Ready to implement</div>}
        </div>
      )}

      {/* ── Mini-map ── */}
      <MiniMap
        layout={layout}
        viewport={viewportWorld}
        filterModuleId={filterModuleId}
        onJump={(wx, wy) => {
          setTransform((prev) => ({
            ...prev,
            panX: containerSize.w / 2 - wx * prev.zoom,
            panY: containerSize.h / 2 - wy * prev.zoom,
          }));
        }}
      />

      {/* ── Detail sidebar ── */}
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          allNodes={layout.allNodes}
          onClose={() => setSelectedKey(null)}
          onExecute={handleExecute}
          onSelectNode={setSelectedKey}
        />
      )}

      {/* ── Legend ── */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-1.5 text-xs text-gray-300 bg-surface-deep/80 backdrop-blur-md rounded-lg px-3 py-2 border border-border/50 select-none z-20 shadow-lg">
        <div className="flex items-center gap-3 mb-1 border-b border-border/50 pb-1">
          <span className="font-semibold text-white">Status</span>
          <span className="opacity-40">|</span>
          <span>X = effort &middot; Y = impact</span>
        </div>
        <div className="flex items-center gap-3">
          {(['implemented', 'partial', 'missing', 'unknown'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: STATUS_DOT_COLORS[s] }} />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

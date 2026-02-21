'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Link2, Flame,
  X, Clock, Zap, ArrowRight, Search, Layers, CheckCircle2, CircleDashed,
  ChevronRight, ChevronDown, Filter
} from 'lucide-react';
import { useCanvasTransform } from '@/hooks/useCanvasTransform';
import { useImplementationPlan } from '@/hooks/useImplementationPlan';
import {
  computeCanvasLayout, findCriticalPath,
  type CanvasNode, type ModuleCluster, type CanvasLayout,
} from '@/lib/implementation-planner/layout-engine';
import { getModuleLabel, type PlanItem } from '@/lib/implementation-planner/plan-generator';
import { formatEffortTime } from '@/lib/implementation-planner/effort-estimator';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { buildProjectContextHeader } from '@/lib/prompt-context';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL, STATUS_INFO,
} from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';

// ---------- Constants ----------

const MINIMAP_W = 160;
const MINIMAP_H = 110;

// ---------- Main Component ----------

interface PlanMatrixMapProps {
  /** When provided, auto-filters to this module and fades others as context */
  moduleId?: string;
}

export function PlanMatrixMap({ moduleId: initialModuleId }: PlanMatrixMapProps = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const dragCountRef = useRef(0);

  const { plan, loading, error } = useImplementationPlan();
  const { transform, startPan, onPointerMove, endPan, zoomToFit, zoomToCenter, reset, setTransform } = useCanvasTransform();
  const [isPanningState, setIsPanningState] = useState(false);

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const { sendPrompt } = useModuleCLI({
    moduleId: 'core-engine' as SubModuleId,
    sessionKey: 'plan-matrix-map',
    label: 'Plan Map',
    accentColor: MODULE_COLORS.core,
  });

  // --- UI State ---
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [showDeps, setShowDeps] = useState(false);
  const [criticalPathMode, setCriticalPathMode] = useState(false);
  const [filterModuleId, setFilterModuleId] = useState(initialModuleId ?? '');
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [canvasHeight, setCanvasHeight] = useState(560);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // --- Computed ---

  const layout = useMemo<CanvasLayout | null>(() => {
    if (!plan) return null;
    return computeCanvasLayout(plan.items);
  }, [plan]);

  const cpSet = useMemo<Set<string>>(() => {
    if (!plan || !criticalPathMode) return new Set();
    return findCriticalPath(plan.items);
  }, [plan, criticalPathMode]);

  const moduleIds = useMemo(() => {
    return Object.keys(MODULE_FEATURE_DEFINITIONS).sort((a, b) => {
      const labelA = getModuleLabel(a as SubModuleId);
      const labelB = getModuleLabel(b as SubModuleId);
      return labelA.localeCompare(labelB);
    });
  }, []);

  const edges = useMemo(() => {
    if (!plan || !showDeps || !layout) return [];
    return plan.items.flatMap((item) =>
      item.dependsOn
        .filter((dep) => layout.allNodes.has(dep))
        .map((dep) => ({ from: dep, to: item.key }))
    );
  }, [plan, showDeps, layout]);

  const readyCount = plan?.items.filter((i) => i.isReady).length ?? 0;
  const visibleNodes = useMemo(() => [...layout?.allNodes.values() ?? []], [layout]);
  const showNodes = transform.zoom >= 0.45;
  const labelScale = useMemo(() => Math.max(1, Math.min(2.2, 1 / Math.max(0.35, transform.zoom))), [transform.zoom]);
  const moduleSectors = useMemo(() => {
    if (!layout) {
      return [] as Array<{
        id: string;
        moduleId: SubModuleId;
        label: string;
        rect: { minX: number; minY: number; maxX: number; maxY: number };
        count: number;
        ready: number;
      }>;
    }

    return layout.clusters.map((cluster) => {
      const ready = cluster.nodes.filter((n) => n.item.isReady).length;
      return {
        id: `sector-${cluster.moduleId}`,
        moduleId: cluster.moduleId,
        label: cluster.label,
        rect: {
          minX: cluster.x,
          minY: cluster.y,
          maxX: cluster.x + cluster.width,
          maxY: cluster.y + cluster.height,
        },
        count: cluster.nodes.length,
        ready,
      };
    });
  }, [layout]);

  const selectedNode = selectedKey && layout ? layout.allNodes.get(selectedKey) ?? null : null;
  const hoveredNode = hoveredKey && layout ? layout.allNodes.get(hoveredKey) ?? null : null;

  // --- Effects ---

  // Zoom to fit on first layout
  const hasAutoFit = useRef(false);
  useEffect(() => {
    if (layout && containerRef.current && !hasAutoFit.current) {
      hasAutoFit.current = true;
      const rect = containerRef.current.getBoundingClientRect();
      zoomToFit(layout.bounds, rect.width, rect.height);
    }
  }, [layout, zoomToFit]);

  // Dynamic full-height canvas based on viewport and component position
  useEffect(() => {
    const recalc = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportBottomPadding = 16;
      const available = window.innerHeight - rect.top - viewportBottomPadding;
      setCanvasHeight(Math.max(560, Math.floor(available)));
    };

    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, []);

  // --- Handlers ---

  const handleZoomToFit = useCallback(() => {
    if (layout && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      zoomToFit(layout.bounds, rect.width, rect.height);
    }
  }, [layout, zoomToFit]);

  const handleModuleDblClick = useCallback((cluster: ModuleCluster) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    zoomToFit(
      { minX: cluster.x - 20, minY: cluster.y - 20, maxX: cluster.x + cluster.width + 20, maxY: cluster.y + cluster.height + 20 },
      rect.width, rect.height,
    );
  }, [zoomToFit]);

  const handleSectorSelect = useCallback((sectorId: string) => {
    setSelectedSectorId(sectorId);
    const sector = moduleSectors.find((s) => s.id === sectorId);
    if (!sector || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    // Add padding around the sector when zooming
    const padding = 100;
    zoomToFit({
      minX: sector.rect.minX - padding,
      minY: sector.rect.minY - padding,
      maxX: sector.rect.maxX + padding,
      maxY: sector.rect.maxY + padding
    }, rect.width, rect.height);
    setFilterModuleId(sector.moduleId);
  }, [moduleSectors, zoomToFit]);

  const toggleModuleExpansion = useCallback((moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }, []);

  const handleExecute = useCallback((item: PlanItem) => {
    const header = buildProjectContextHeader({ projectName, projectPath, ueVersion });
    const depsSection = item.dependsOn.length > 0
      ? `\n\n## Dependencies (already implemented)\n${item.dependsOn.map((d) => `- ${d.replace('::', ' / ')}`).join('\n')}`
      : '';
    sendPrompt(`${header}${depsSection}\n\n## Task: Implement "${item.featureName}" (${getModuleLabel(item.moduleId)})\n\n${item.description}\n\nImplement this feature from scratch. Follow UE5 C++ conventions. Read any existing related files first, then create/modify files as needed.`);
    setSelectedKey(null);
  }, [sendPrompt, projectName, projectPath, ueVersion]);

  const nodeOpacity = useCallback((node: CanvasNode): number => {
    if (filterModuleId && node.item.moduleId !== filterModuleId) return 0.08;
    if (criticalPathMode && cpSet.size > 0 && !cpSet.has(node.key)) return 0.15;
    return 1;
  }, [filterModuleId, criticalPathMode, cpSet]);

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
  const containerEl = containerRef.current;
  const cw = containerEl?.clientWidth ?? 800;
  const ch = containerEl?.clientHeight ?? 560;
  const viewportWorld = {
    x: -transform.panX / transform.zoom,
    y: -transform.panY / transform.zoom,
    w: cw / transform.zoom,
    h: ch / transform.zoom,
  };

  return (
    <div ref={rootRef} className="relative h-full bg-background flex overflow-hidden" style={{ height: canvasHeight }}>
      {/* ── Left Sidebar Navigator ── */}
      <div 
        className={`flex-shrink-0 bg-surface-deep/95 backdrop-blur-xl border-r border-border/50 shadow-xl z-30 transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-0 opacity-0'}`}
      >
        <div className="p-4 border-b border-border/50 flex items-center justify-between sticky top-0 bg-surface-deep/95 z-10">
          <h2 className="text-sm font-semibold text-text flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            Project Map
          </h2>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-surface-hover rounded-md text-text-muted hover:text-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-3 border-b border-border/50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search features (Cmd+K)..." 
              className="w-full bg-background/50 border border-border/50 rounded-md pl-8 pr-3 py-1.5 text-xs text-text outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <button 
            onClick={() => { setFilterModuleId(''); handleZoomToFit(); }}
            className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-between ${!filterModuleId ? 'bg-blue-500/10 text-blue-400' : 'text-text-muted hover:bg-surface-hover hover:text-text'}`}
          >
            <span>All Modules</span>
            <span className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded">{plan.items.length}</span>
          </button>

          <div className="my-2 border-t border-border/30" />

          {moduleIds.map((moduleId) => {
            const isExpanded = expandedModules.has(moduleId);
            const isSelected = filterModuleId === moduleId;
            const sectors = moduleSectors.filter(s => s.moduleId === moduleId);
            if (sectors.length === 0) return null;
            
            const totalNodes = sectors.reduce((sum, s) => sum + s.count, 0);
            const readyNodes = sectors.reduce((sum, s) => sum + s.ready, 0);
            const progress = totalNodes > 0 ? (readyNodes / totalNodes) * 100 : 0;

            return (
              <div key={moduleId} className="flex flex-col">
                <div className={`flex items-center rounded-md transition-colors ${isSelected ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'}`}>
                  <button 
                    onClick={() => toggleModuleExpansion(moduleId)}
                    className="p-1.5 text-text-muted hover:text-text"
                  >
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <button 
                    onClick={() => {
                      setFilterModuleId(moduleId);
                      if (sectors.length > 0) {
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (rect) {
                          // Calculate bounding box for all sectors in this module
                          const minX = Math.min(...sectors.map(s => s.rect.minX));
                          const minY = Math.min(...sectors.map(s => s.rect.minY));
                          const maxX = Math.max(...sectors.map(s => s.rect.maxX));
                          const maxY = Math.max(...sectors.map(s => s.rect.maxY));
                          zoomToFit({ minX: minX - 100, minY: minY - 100, maxX: maxX + 100, maxY: maxY + 100 }, rect.width, rect.height);
                        }
                      }
                    }}
                    className={`flex-1 text-left py-2 pr-3 text-xs font-medium truncate ${isSelected ? 'text-blue-400' : 'text-text-muted hover:text-text'}`}
                  >
                    {getModuleLabel(moduleId as SubModuleId)}
                  </button>
                  <div className="pr-3 flex items-center gap-2">
                    <div className="w-8 h-1 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-green-500/80" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="ml-6 pl-2 border-l border-border/30 flex flex-col gap-0.5 mt-1 mb-2">
                    {sectors.map(sector => (
                      <button
                        key={sector.id}
                        onClick={() => handleSectorSelect(sector.id)}
                        className={`text-left px-2 py-1.5 rounded-md text-[11px] transition-colors flex items-center justify-between ${selectedSectorId === sector.id ? 'bg-blue-500/10 text-blue-400' : 'text-text-muted hover:bg-surface-hover hover:text-text'}`}
                      >
                        <span className="truncate pr-2">{sector.label}</span>
                        <span className="text-[9px] opacity-60">{sector.ready}/{sector.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
      <div
        ref={containerRef}
        className="absolute inset-0 top-0 overflow-hidden select-none"
        tabIndex={0}
        style={{
          cursor: isPanningState ? 'grabbing' : 'grab',
          outline: 'none',
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)`,
          backgroundSize: `${40 * transform.zoom}px ${40 * transform.zoom}px`,
          backgroundPosition: `${transform.panX}px ${transform.panY}px`,
          willChange: 'transform', // Performance hint
        }}
        onWheel={(e) => {
          e.preventDefault();
          const el = containerRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          setTransform((prev) => {
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            const nz = Math.min(3.0, Math.max(0.2, prev.zoom * factor));
            const r = nz / prev.zoom;
            return { zoom: nz, panX: cx - (cx - prev.panX) * r, panY: cy - (cy - prev.panY) * r };
          });
        }}
        onPointerDown={(e) => {
          isPanningRef.current = true;
          setIsPanningState(true);
          dragCountRef.current = 0;
          startPan(e);
        }}
        onPointerMove={(e) => {
          if (isPanningRef.current) dragCountRef.current++;
          onPointerMove(e);
        }}
        onPointerUp={() => {
          isPanningRef.current = false;
          setIsPanningState(false);
          endPan();
        }}
        onClick={() => {
          if (dragCountRef.current < 3) setSelectedKey(null);
        }}
        onKeyDown={(e) => {
          const el = containerRef.current;
          if (!el) return;
          const PAN_STEP = 40;
          switch (e.key) {
            case '+':
            case '=':
              e.preventDefault();
              zoomToCenter(1.25, el.clientWidth, el.clientHeight);
              break;
            case '-':
            case '_':
              e.preventDefault();
              zoomToCenter(0.8, el.clientWidth, el.clientHeight);
              break;
            case '0':
              e.preventDefault();
              reset();
              break;
            case 'f':
            case 'F':
              e.preventDefault();
              if (layout) {
                const rect = el.getBoundingClientRect();
                zoomToFit(layout.bounds, rect.width, rect.height);
              }
              break;
            case 'ArrowUp':
              e.preventDefault();
              setTransform((p) => ({ ...p, panY: p.panY + PAN_STEP }));
              break;
            case 'ArrowDown':
              e.preventDefault();
              setTransform((p) => ({ ...p, panY: p.panY - PAN_STEP }));
              break;
            case 'ArrowLeft':
              e.preventDefault();
              setTransform((p) => ({ ...p, panX: p.panX + PAN_STEP }));
              break;
            case 'ArrowRight':
              e.preventDefault();
              setTransform((p) => ({ ...p, panX: p.panX - PAN_STEP }));
              break;
          }
        }}
      >
        <div
          style={{
            transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            left: 0,
            top: 0,
          }}
        >
          {/* Cluster backgrounds & Column Labels */}
          {layout.clusters.map((c) => (
            <div
              key={c.moduleId}
              className="absolute rounded-xl border border-border/40 shadow-2xl"
              style={{
                left: c.x,
                top: c.y,
                width: c.width,
                height: c.height,
                background: filterModuleId && filterModuleId !== c.moduleId
                  ? 'rgba(15,15,25,0.15)'
                  : 'rgba(22,22,38,0.85)',
                backdropFilter: 'blur(12px)',
                transition: 'opacity 0.2s', // Removed background transition for performance
                opacity: filterModuleId && filterModuleId !== c.moduleId ? 0.3 : 1,
                willChange: 'opacity',
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleModuleDblClick(c);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div 
                className="absolute left-6 top-4 px-5 py-2.5 text-2xl font-black tracking-widest text-white uppercase select-none whitespace-nowrap flex items-center gap-3 bg-surface-deep/80 backdrop-blur-md rounded-lg border border-border/40 shadow-lg"
                style={{ transform: `scale(${Math.max(1, 1 / transform.zoom)})`, transformOrigin: 'top left' }}
              >
                <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.8)]" />
                {c.label}
                <span className="ml-3 opacity-80 font-mono text-sm bg-background/80 px-2 py-1 rounded-md text-blue-200">
                  {c.nodes.length} NODES
                </span>
              </div>

              {/* Category Row Labels */}
              {transform.zoom >= 0.6 && (
                <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none select-none opacity-70">
                  {c.categories.map((cat) => {
                    return (
                      <div 
                        key={cat.label} 
                        className="absolute text-xs font-bold tracking-widest uppercase text-white border-l-2 border-border/60 pl-3 flex items-center"
                        style={{ left: cat.x, top: cat.y - 14, height: 28, width: 140 }}
                      >
                        {cat.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Submodule sector overlays for long-distance readability */}
          {moduleSectors.map((sector) => {
            const isFilteredOut = filterModuleId && filterModuleId !== sector.moduleId;
            return (
              <div
                key={sector.id}
                className="absolute rounded-lg border border-border/20 bg-background/5 transition-opacity duration-300"
                style={{
                  left: sector.rect.minX,
                  top: sector.rect.minY,
                  width: sector.rect.maxX - sector.rect.minX,
                  height: sector.rect.maxY - sector.rect.minY,
                  opacity: isFilteredOut ? 0.1 : 1,
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!containerRef.current) return;
                    const rect = containerRef.current.getBoundingClientRect();
                    zoomToFit({
                      minX: sector.rect.minX - 100,
                      minY: sector.rect.minY - 100,
                      maxX: sector.rect.maxX + 100,
                      maxY: sector.rect.maxY + 100
                    }, rect.width, rect.height);
                  }}
                  className="absolute left-3 top-3 px-3 py-1.5 rounded-md text-xs font-bold tracking-wide bg-surface-deep/90 backdrop-blur-md text-gray-200 hover:text-white border border-border/50 shadow-lg transition-all hover:scale-105"
                  title="Zoom to submodule sector"
                  style={{ transform: `scale(${labelScale})`, transformOrigin: 'top left' }}
                >
                  {sector.label}
                </button>
                <div
                  className="absolute right-3 top-3 text-[10px] font-mono text-gray-300 bg-surface-deep/80 backdrop-blur-md border border-border/40 px-2 py-1 rounded-md shadow-lg"
                  style={{ transform: `scale(${labelScale})`, transformOrigin: 'top right' }}
                >
                  <span className="text-white font-bold">{sector.count}</span> nodes <span className="opacity-40 mx-1">|</span> <span className="text-green-400 font-bold">{sector.ready}</span> ready
                </div>
              </div>
            );
          })}

          {/* SVG dependency lines */}
          {showDeps && edges.length > 0 && (
            <svg className="absolute pointer-events-none z-0" style={{ left: 0, top: 0, overflow: 'visible', width: 1, height: 1, willChange: 'transform' }}>
              {edges.map((edge) => {
                const from = layout.allNodes.get(edge.from);
                const to = layout.allNodes.get(edge.to);
                if (!from || !to) return null;

                const isOnCp = criticalPathMode && cpSet.has(edge.from) && cpSet.has(edge.to);
                
                const isHoveredIncoming = hoveredKey === edge.to || selectedKey === edge.to;
                const isHoveredOutgoing = hoveredKey === edge.from || selectedKey === edge.from;
                const isHL = isHoveredIncoming || isHoveredOutgoing;

                const mx = (from.x + to.x) / 2;
                const d = `M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`;

                let strokeColor = STATUS_NEUTRAL;
                let strokeWidth = 0.8;
                let opacity = 0.08; // Default very faint
                let dashArray = undefined;

                if (isOnCp) {
                  strokeColor = '#f59e0b'; // Amber glow
                  strokeWidth = 2.5;
                  opacity = 0.8;
                  dashArray = '8 4';
                } else if (isHoveredIncoming) {
                  strokeColor = '#ef4444'; // Red for dependencies (blockers)
                  strokeWidth = 2;
                  opacity = 0.9;
                  dashArray = '6 4';
                } else if (isHoveredOutgoing) {
                  strokeColor = '#3b82f6'; // Blue for dependents (unblocks)
                  strokeWidth = 2;
                  opacity = 0.9;
                  dashArray = '6 4';
                }

                return (
                  <path
                    key={`${edge.from}->${edge.to}`}
                    d={d}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                    opacity={opacity}
                    strokeDasharray={dashArray}
                    style={{
                      filter: isHL || isOnCp ? `drop-shadow(0 0 4px ${strokeColor}80)` : 'none',
                      transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
                      willChange: 'stroke, stroke-width, opacity',
                    }}
                  />
                );
              })}
            </svg>
          )}

          {/* Feature dots & cards (Semantic Zooming) */}
            {showNodes && visibleNodes.map((node) => {
              const o = nodeOpacity(node);
              const isHovered = hoveredKey === node.key;
              const isSelected = selectedKey === node.key;
              const isReady = node.item.isReady;
              const isOnCp = criticalPathMode && cpSet.has(node.key);
              const isDetailed = transform.zoom >= 0.8; // Show cards earlier since they are smaller

              if (isDetailed) {
                return (
                  <div
                    key={node.key}
                    className="absolute rounded-md border shadow-sm transition-all duration-200 overflow-hidden flex items-center gap-2 px-2 py-1.5"
                    style={{
                      left: node.x - 90, // Adjusted for wider card
                      top: node.y - 14,  // Adjusted for shorter card
                      width: 180,
                      height: 28,
                      backgroundColor: isSelected ? `${node.color}15` : isHovered ? 'rgba(30, 30, 45, 0.95)' : 'rgba(22, 22, 38, 0.85)',
                      backdropFilter: 'blur(4px)',
                      borderColor: isSelected ? node.color : isHovered ? `${node.color}80` : 'rgba(100,100,130,0.2)',
                      opacity: o,
                      boxShadow: isSelected ? `0 0 0 1px ${node.color}40, 0 4px 12px rgba(0,0,0,0.4)` : isHovered ? `0 2px 8px rgba(0,0,0,0.3)` : 'none',
                      transform: isHovered ? 'scale(1.02) translateY(-1px)' : isSelected ? 'scale(1.02)' : 'scale(1)',
                      cursor: 'pointer',
                      zIndex: isHovered || isSelected ? 10 : 1,
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseEnter={(e) => {
                      if (isPanningRef.current) return;
                      setHoveredKey(node.key);
                      setHoverPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedKey(selectedKey === node.key ? null : node.key);
                    }}
                  >
                    {/* Status Indicator */}
                    <div className="flex-shrink-0 relative flex items-center justify-center w-3 h-3">
                      {isReady ? (
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                      ) : (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: node.color }} />
                      )}
                      {isOnCp && (
                        <div className="absolute -inset-1 rounded-full border border-amber-500/50 animate-ping" />
                      )}
                    </div>

                    {/* Feature Name */}
                    <div 
                      className={`text-[10px] truncate flex-1 ${isReady ? 'text-white font-semibold' : 'text-gray-300 font-medium'}`} 
                      title={node.item.featureName}
                    >
                      {node.item.featureName}
                    </div>

                    {/* Impact Indicator (Subtle) */}
                    {node.item.impact.score > 5 && (
                      <div className="flex-shrink-0 flex items-center text-[8px] text-amber-400/70 font-mono">
                        <Zap className="w-2.5 h-2.5 mr-0.5" />
                        {node.item.impact.score}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={node.key}
                  className="absolute rounded-full"
                  style={{
                    left: node.x - node.radius,
                    top: node.y - node.radius,
                    width: node.radius * 2,
                    height: node.radius * 2,
                    backgroundColor: node.color,
                    opacity: o,
                    boxShadow: isSelected
                      ? `0 0 0 3px ${node.color}40, 0 0 12px ${node.color}60`
                      : isHovered
                        ? `0 0 0 2px ${node.color}30, 0 0 8px ${node.color}40`
                        : isReady
                          ? `0 0 6px ${node.color}50`
                          : isOnCp
                            ? '0 0 4px #f59e0b50'
                            : 'none',
                    transform: isHovered ? 'scale(1.4)' : isSelected ? 'scale(1.3)' : undefined,
                    transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.3s',
                    cursor: 'pointer',
                    zIndex: isHovered || isSelected ? 10 : 1,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseEnter={(e) => {
                    if (isPanningRef.current) return;
                    setHoveredKey(node.key);
                    setHoverPos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedKey(selectedKey === node.key ? null : node.key);
                  }}
                />
              );
            })}

          {/* Pulsing glow rings for ready items */}
          {showNodes && visibleNodes
            .filter((n) => n.item.isReady && nodeOpacity(n) > 0.5)
            .map((node) => (
                <div
                  key={`pulse-${node.key}`}
                  className="absolute rounded-full animate-ping pointer-events-none"
                  style={{
                    left: node.x - node.radius - 3,
                    top: node.y - node.radius - 3,
                    width: (node.radius + 3) * 2,
                    height: (node.radius + 3) * 2,
                    border: `1px solid ${node.color}`,
                    opacity: 0.25,
                  }}
                />
              ))}
        </div>
      </div>

      {/* ── Tooltip ── */}
      {hoveredNode && !isPanningRef.current && transform.zoom < 0.8 && (
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
            panX: cw / 2 - wx * prev.zoom,
            panY: ch / 2 - wy * prev.zoom,
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
      <div className="absolute bottom-6 left-6 flex flex-col gap-1.5 text-[10px] text-gray-300 bg-surface-deep/80 backdrop-blur-md rounded-lg px-3 py-2 border border-border/50 select-none z-20 shadow-lg">
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

const STATUS_DOT_COLORS: Record<string, string> = {
  implemented: STATUS_SUCCESS,
  partial: STATUS_WARNING,
  missing: STATUS_ERROR,
  unknown: STATUS_NEUTRAL,
};

// ---------- Sub-components ----------

function ToolbarBtn({ icon: Icon, onClick, title }: { icon: typeof ZoomIn; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="p-1.5 text-text-muted hover:text-text hover:bg-surface-hover rounded-full transition-colors">
      <Icon className="w-4 h-4" />
    </button>
  );
}

function ToggleBtn({ icon: Icon, active, onClick, label }: { icon: typeof Link2; active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        active
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
          : 'text-text-muted hover:text-text hover:bg-surface-hover border border-transparent'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function MiniMap({
  layout,
  viewport,
  filterModuleId,
  onJump,
}: {
  layout: CanvasLayout;
  viewport: { x: number; y: number; w: number; h: number };
  filterModuleId: string;
  onJump: (worldX: number, worldY: number) => void;
}) {
  const { bounds, clusters } = layout;
  const bw = bounds.maxX - bounds.minX || 1;
  const bh = bounds.maxY - bounds.minY || 1;
  const scale = Math.min(MINIMAP_W / bw, MINIMAP_H / bh) * 0.85;

  const offsetX = (MINIMAP_W - bw * scale) / 2;
  const offsetY = (MINIMAP_H - bh * scale) / 2;

  return (
    <div
      className="absolute bottom-6 right-6 rounded-lg border border-border/50 bg-surface-deep/80 backdrop-blur-md overflow-hidden cursor-crosshair shadow-xl z-20"
      style={{ width: MINIMAP_W, height: MINIMAP_H }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left - offsetX;
        const my = e.clientY - rect.top - offsetY;
        onJump(bounds.minX + mx / scale, bounds.minY + my / scale);
      }}
    >
      {clusters.map((c) => (
        <div
          key={c.moduleId}
          className="absolute rounded-sm"
          style={{
            left: offsetX + (c.x - bounds.minX) * scale,
            top: offsetY + (c.y - bounds.minY) * scale,
            width: Math.max(4, c.width * scale),
            height: Math.max(4, c.height * scale),
            backgroundColor: filterModuleId === c.moduleId ? 'rgba(59,130,246,0.3)' : 'rgba(50,50,70,0.5)',
            border: '1px solid rgba(100,100,130,0.3)',
          }}
        />
      ))}

      {/* Viewport rectangle */}
      <div
        className="absolute border border-blue-400/60 rounded-sm"
        style={{
          left: offsetX + (viewport.x - bounds.minX) * scale,
          top: offsetY + (viewport.y - bounds.minY) * scale,
          width: viewport.w * scale,
          height: viewport.h * scale,
          backgroundColor: 'rgba(59,130,246,0.06)',
        }}
      />
    </div>
  );
}

function DetailPanel({
  node,
  allNodes,
  onClose,
  onExecute,
  onSelectNode,
}: {
  node: CanvasNode;
  allNodes: Map<string, CanvasNode>;
  onClose: () => void;
  onExecute: (item: PlanItem) => void;
  onSelectNode: (key: string) => void;
}) {
  const item = node.item;

  return (
    <div className="absolute top-0 right-0 w-[600px] bottom-0 bg-surface-deep/95 backdrop-blur-xl border-l border-border/50 shadow-2xl overflow-y-auto z-40 flex flex-col animate-in slide-in-from-right-8 duration-300">
      {/* Header */}
      <div className="sticky top-0 bg-surface-deep/80 backdrop-blur-md border-b border-border/50 px-6 py-5 flex items-center justify-between z-10">
        <h3 className="text-xl font-bold text-white truncate pr-4">{item.featureName}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-surface-hover transition-colors flex-shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6 py-6 flex-1 flex flex-col gap-6">
        {/* Badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-mono px-3 py-1 rounded-md bg-surface-hover text-gray-300 border border-border/50">
            {getModuleLabel(item.moduleId)}
          </span>
          <span className="text-sm px-3 py-1 rounded-md font-medium border" style={{ backgroundColor: `${node.color}15`, color: node.color, borderColor: `${node.color}30` }}>
            {item.status}
          </span>
          {item.isReady && (
            <span className="text-sm font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-md flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Ready
            </span>
          )}
        </div>

        {/* Description */}
        <div className="bg-background/50 rounded-xl p-5 border border-border/30">
          <p className="text-sm text-gray-300 leading-relaxed">{item.description}</p>
        </div>

        {/* Effort + Impact */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-background/50 rounded-xl p-5 border border-border/30 flex flex-col gap-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Effort</span>
            <span className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" /> {formatEffortTime(item.effort.minutes)}
            </span>
            {item.effort.reason !== 'baseline' && (
              <span className="text-xs text-gray-400 mt-1 leading-relaxed">{item.effort.reason}</span>
            )}
          </div>
          <div className="bg-background/50 rounded-xl p-5 border border-border/30 flex flex-col gap-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Impact</span>
            <span className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> {item.impact.score} Score
            </span>
          </div>
        </div>

        {/* Dependencies */}
        {item.dependsOn.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">
              <Link2 className="w-4 h-4" /> Depends on ({item.dependsOn.length})
            </div>
            <div className="grid grid-cols-2 gap-2">
              {item.dependsOn.map((dep) => {
                const dn = allNodes.get(dep);
                const [mod, ...rest] = dep.split('::');
                return (
                  <button
                    key={dep}
                    onClick={() => dn && onSelectNode(dep)}
                    className="text-left text-sm px-3 py-2.5 rounded-lg font-mono transition-all hover:brightness-125 border flex items-center gap-3"
                    style={{ 
                      backgroundColor: dn ? `${dn.color}10` : 'rgba(50,50,70,0.3)', 
                      color: dn?.color ?? '#6b7280',
                      borderColor: dn ? `${dn.color}20` : 'rgba(100,100,130,0.2)'
                    }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dn?.color ?? '#6b7280' }} />
                    <span className="truncate">{rest.join('::')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Unblocks */}
        {item.impact.directDependents.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">
              <ArrowRight className="w-4 h-4" /> Unblocks ({item.impact.directDependents.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {item.impact.directDependents.slice(0, 12).map((dep) => {
                const dn = allNodes.get(dep);
                const [mod, ...rest] = dep.split('::');
                return (
                  <button
                    key={dep}
                    onClick={() => dn && onSelectNode(dep)}
                    className="text-xs px-3 py-1.5 rounded-lg font-mono bg-purple-500/10 text-purple-400/90 hover:bg-purple-500/20 border border-purple-500/20 transition-colors truncate max-w-full"
                  >
                    {rest.join('::')}
                  </button>
                );
              })}
              {item.impact.directDependents.length > 12 && (
                <span className="text-xs text-gray-400 px-3 py-1.5 bg-surface-hover rounded-lg border border-border/50">
                  +{item.impact.directDependents.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto pt-6">
          {/* Execute */}
          <button
            onClick={() => onExecute(item)}
            className="w-full flex items-center justify-center gap-3 text-base font-bold text-white bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
          >
            <ArrowRight className="w-5 h-5" />
            Implement Feature
          </button>
        </div>
      </div>
    </div>
  );
}

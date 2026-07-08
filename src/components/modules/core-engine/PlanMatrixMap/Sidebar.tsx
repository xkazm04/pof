'use client';

import { X, Search, Layers, ChevronRight, ChevronDown } from 'lucide-react';
import { getModuleLabel } from '@/lib/implementation-planner/plan-generator';
import type { SubModuleId } from '@/types/modules';
import type { PlanMatrixState } from './usePlanMatrixMap';

export function Sidebar({ pm }: { pm: PlanMatrixState }) {
  const {
    isSidebarOpen, setIsSidebarOpen,
    setFilterModuleId, handleZoomToFit, filterModuleId,
    plan, moduleIds, expandedModules, moduleSectors,
    toggleModuleExpansion, containerRef, zoomToFit,
    handleSectorSelect, selectedSectorId,
  } = pm;

  if (!plan) return null;

  return (
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
            <span className="text-xs bg-background/50 px-1.5 py-0.5 rounded">{plan.items.length}</span>
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
                        <span className="text-[11px] opacity-60">{sector.ready}/{sector.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
  );
}

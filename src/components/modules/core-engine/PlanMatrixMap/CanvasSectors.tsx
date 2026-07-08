'use client';

import type { PlanMatrixState } from './usePlanMatrixMap';

export function CanvasSectors({ pm }: { pm: PlanMatrixState }) {
  const { moduleSectors, filterModuleId, containerRef, zoomToFit, labelScale } = pm;

  return (
    <>
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
                  className="absolute right-3 top-3 text-xs font-mono text-gray-300 bg-surface-deep/80 backdrop-blur-md border border-border/40 px-2 py-1 rounded-md shadow-lg"
                  style={{ transform: `scale(${labelScale})`, transformOrigin: 'top right' }}
                >
                  <span className="text-white font-bold">{sector.count}</span> nodes <span className="opacity-40 mx-1">|</span> <span className="text-green-400 font-bold">{sector.ready}</span> ready
                </div>
              </div>
            );
          })}
    </>
  );
}

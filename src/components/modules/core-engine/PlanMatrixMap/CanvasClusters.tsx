'use client';

import {
  STATUS_INFO,
  SURFACE_DAG_NODE_FILL, SURFACE_DAG_CLUSTER_DIM_FILL,
  OPACITY_80,
  withOpacity,
} from '@/lib/chart-colors';
import type { PlanMatrixState } from './usePlanMatrixMap';

export function CanvasClusters({ pm }: { pm: PlanMatrixState }) {
  const { layout, filterModuleId, transform, handleModuleDblClick } = pm;
  if (!layout) return null;

  return (
    <>
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
                  ? SURFACE_DAG_CLUSTER_DIM_FILL
                  : SURFACE_DAG_NODE_FILL,
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
                <div
                  className="w-3 h-3 rounded-full bg-blue-400"
                  style={{ boxShadow: `0 0 12px ${withOpacity(STATUS_INFO, OPACITY_80)}` }}
                />
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
                        className="absolute text-xs font-bold uppercase text-white border-l-2 border-border/60 pl-3 flex items-center"
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
    </>
  );
}

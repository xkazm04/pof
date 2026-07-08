'use client';

import { X, Clock, Zap, ArrowRight, Link2, CheckCircle2 } from 'lucide-react';
import { type CanvasNode } from '@/lib/implementation-planner/layout-engine';
import { getModuleLabel, type PlanItem } from '@/lib/implementation-planner/plan-generator';
import { formatEffortTime } from '@/lib/implementation-planner/effort-estimator';
import {
  STATUS_NEUTRAL, ACCENT_BLUE_BOLD,
  SURFACE_MINIMAP_CLUSTER, BORDER_DAG_NEUTRAL,
  OPACITY_10, OPACITY_20, OPACITY_30, OPACITY_60,
  withOpacity,
} from '@/lib/chart-colors';

export function DetailPanel({
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
                      backgroundColor: dn ? `${dn.color}${OPACITY_10}` : withOpacity(SURFACE_MINIMAP_CLUSTER, OPACITY_30),
                      color: dn?.color ?? STATUS_NEUTRAL,
                      borderColor: dn ? `${dn.color}${OPACITY_20}` : withOpacity(BORDER_DAG_NEUTRAL, OPACITY_20)
                    }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dn?.color ?? STATUS_NEUTRAL }} />
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
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 0 30px ${withOpacity(ACCENT_BLUE_BOLD, OPACITY_60)}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `0 0 20px ${withOpacity(ACCENT_BLUE_BOLD, OPACITY_30)}`;
            }}
            className="w-full flex items-center justify-center gap-3 text-base font-bold text-white bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-xl transition-all"
            style={{ boxShadow: `0 0 20px ${withOpacity(ACCENT_BLUE_BOLD, OPACITY_30)}` }}
          >
            <ArrowRight className="w-5 h-5" />
            Implement Feature
          </button>
        </div>
      </div>
    </div>
  );
}

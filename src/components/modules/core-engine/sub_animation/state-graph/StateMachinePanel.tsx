'use client';

import { useMemo, useState, useCallback } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import { withOpacity, OPACITY_8 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { STATUS_COLORS } from '../../unique-tabs/_shared';
import { ACCENT, STATE_GROUPS, STATE_NODES, type StateNode } from '../_shared/data';
import type { FeatureStatus, FeatureRow } from '@/types/feature-matrix';
import { GRAPH_EDGES } from './state-machine-graph-data';
import { StateMachineSvg } from './StateMachineSvg';

interface StateMachinePanelProps {
  featureMap: Map<string, FeatureRow>;
}

export function StateMachinePanel({ featureMap }: StateMachinePanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const stateNodeMap = useMemo(() => {
    const map = new Map<string, StateNode>();
    for (const n of STATE_NODES) map.set(n.name, n);
    return map;
  }, []);

  const toggleGroup = useCallback((group: string) => {
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));
  }, []);

  const totalStates = STATE_NODES.length;

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="AnimBP State Machine" icon={Activity} color={ACCENT} />
      <p className="text-xs font-mono text-text-muted mb-3">
        {totalStates} states across {STATE_GROUPS.length} groups &middot; {GRAPH_EDGES.reduce((s, e) => s + e.count, 0)} cross-group transitions
      </p>

      {/* SVG State Group Graph */}
      <div className="flex justify-center mb-4">
        <StateMachineSvg hoveredGroup={hoveredGroup} onHoverGroup={setHoveredGroup} />
      </div>

      <div className="space-y-1">
        {STATE_GROUPS.map(({ group, states }) => {
          const isCollapsed = collapsed[group];
          return (
            <div key={group}>
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <ChevronDown
                  className="w-3 h-3 text-text-muted transition-transform flex-shrink-0"
                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : undefined }}
                />
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
                  {group}
                </span>
                <span className="text-xs font-mono text-text-muted/50 ml-auto">
                  {states.length}
                </span>
              </button>
              {!isCollapsed && (
                <div className="ml-5 space-y-0.5 mb-1">
                  {states.map((stateName) => {
                    const node = stateNodeMap.get(stateName);
                    if (!node) return null;
                    const status: FeatureStatus = featureMap.get(node.featureName)?.status ?? 'unknown';
                    const sc = STATUS_COLORS[status];
                    return (
                      <div
                        key={node.name}
                        className="flex items-center gap-2 py-0.5 px-2 rounded hover:bg-surface-hover transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot }} />
                        <span className="text-xs font-medium text-text flex-1 min-w-0 truncate">{node.name}</span>
                        <span className="text-xs font-mono text-text-muted">{node.ref}</span>
                        <span className="text-xs font-mono text-text-muted/50">{node.transitions.length}→</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Transition labels */}
      <div className="space-y-1.5 bg-surface-deep/30 p-3 rounded-xl border border-border/40 mt-3">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
          Transitions Matrix ({STATE_NODES.reduce((s, n) => s + n.transitions.length, 0)} total)
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
          {STATE_NODES.flatMap((node) =>
            node.transitions.map((t) => (
              <div
                key={`${node.name}->${t.to}`}
                className="flex items-center gap-1.5 text-xs bg-surface/50 px-2 py-1 rounded"
              >
                <span
                  className="font-mono font-medium text-text px-1 rounded"
                  style={{ backgroundColor: withOpacity(ACCENT, OPACITY_8), color: ACCENT }}
                >
                  {node.name}
                </span>
                <span className="text-text-muted opacity-50">&rarr;</span>
                <span className="font-mono font-medium text-text px-1 bg-surface-hover rounded truncate">
                  {t.to}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </BlueprintPanel>
  );
}

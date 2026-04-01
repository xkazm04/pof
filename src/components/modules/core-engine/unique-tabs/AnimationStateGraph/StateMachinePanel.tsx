'use client';

import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader } from '../_design';
import { STATUS_COLORS } from '../_shared';
import { ACCENT, STATE_GROUPS, STATE_NODES, type StateNode } from './data';
import type { FeatureStatus } from '@/types/feature-matrix';
import type { FeatureRow } from '@/types/feature-matrix';

interface StateMachinePanelProps {
  featureMap: Map<string, FeatureRow>;
}

export function StateMachinePanel({ featureMap }: StateMachinePanelProps) {
  const stateNodeMap = useMemo(() => {
    const map = new Map<string, StateNode>();
    for (const n of STATE_NODES) map.set(n.name, n);
    return map;
  }, []);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="AnimBP State Machine" icon={Activity} color={ACCENT} />

      <div className="flex gap-4 mb-3">
        {STATE_GROUPS.map((group) => (
          <div key={group.group} className="flex-1 min-w-0">
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
              {group.group}
            </div>
            <div className="space-y-1">
              {group.states.map((stateName) => {
                const node = stateNodeMap.get(stateName);
                if (!node) return null;
                const status: FeatureStatus = featureMap.get(node.featureName)?.status ?? 'unknown';
                const sc = STATUS_COLORS[status];
                return (
                  <div key={node.name} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-surface-hover transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot }} />
                    <span className="text-xs font-medium text-text flex-1 min-w-0 truncate">{node.name}</span>
                    <span className="text-xs font-mono text-text-muted">{node.ref}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Transition labels */}
      <div className="space-y-1.5 bg-surface-deep/30 p-3 rounded-xl border border-border/40">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
          Transitions Matrix
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {STATE_NODES.flatMap((node) =>
            node.transitions.map((t, i) => (
              <motion.div
                key={`${node.name}->${t.to}`}
                initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 text-xs bg-surface/50 px-2 py-1.5 rounded"
              >
                <span className="font-mono font-medium text-text px-1" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}>{node.name}</span>
                <span className="text-text-muted opacity-50">&rarr;</span>
                <span className="font-mono font-medium text-text px-1 bg-surface-hover rounded">{t.to}</span>
                <span className="text-text-muted ml-auto italic opacity-80 text-xs">{t.label}</span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </BlueprintPanel>
  );
}

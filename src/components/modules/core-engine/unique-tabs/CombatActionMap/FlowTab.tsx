'use client';

import { Swords, Zap, GitBranch } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FeatureRow } from '@/types/feature-matrix';
import { PipelineFlow } from '../_shared';
import { BlueprintPanel, SectionHeader } from '../_design';
import { LaneSection } from './LaneSection';
import { ComboChainDiagram } from './ComboChainDiagram';
import {
  ACCENT, LANES, FLOW_ARROWS, SEQ_LANES, SEQ_EVENTS,
} from './data';

interface FlowTabProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
}

export function FlowTab({ featureMap, defs, expanded, onToggle }: FlowTabProps) {
  return (
    <motion.div key="flow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <BlueprintPanel color={ACCENT} className="p-3.5">
        <SectionHeader label="Execution Flow" color={ACCENT} icon={Zap} />
        <div className="mt-3">
          <PipelineFlow steps={['Attack', 'Combo', 'Hit Detect', 'Damage', 'Reaction', 'Feedback']} accent={ACCENT} />
        </div>
      </BlueprintPanel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-4">
          <SectionHeader label="Combat Lanes" color={ACCENT} icon={Swords} />
          <div className="space-y-4">
            {LANES.map(lane => (
              <LaneSection key={lane.id} lane={lane} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} arrows={FLOW_ARROWS} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <ComboChainDiagram status={featureMap.get('Combo system')?.status ?? 'unknown'} />
          <BlueprintPanel color={ACCENT} className="p-3">
            <SectionHeader label="Combat Event Sequence" color={ACCENT} icon={GitBranch} />
            <div className="mt-3 overflow-x-auto custom-scrollbar min-h-[200px]">
              <SequenceDiagram />
            </div>
          </BlueprintPanel>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Sequence Diagram SVG ──────────────────────────────────────────────── */

function SequenceDiagram() {
  return (
    <svg width="400" height="200" viewBox="0 0 400 200" className="overflow-visible">
      {SEQ_LANES.map((lane, i) => {
        const x = 60 + i * 100;
        return (
          <g key={lane.id}>
            <line x1={x} y1={30} x2={x} y2={240} stroke={lane.color} strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
            <rect x={x - 38} y={4} width="76" height="22" rx="4" fill={`${lane.color}20`} stroke={lane.color} strokeWidth="1" />
            <text x={x} y={18} textAnchor="middle" className="text-[11px] font-mono font-bold" fill={lane.color} style={{ fontSize: 11 }}>{lane.label}</text>
          </g>
        );
      })}
      {SEQ_EVENTS.map((evt, i) => {
        const y = 50 + i * 34;
        const fromIdx = SEQ_LANES.findIndex(l => l.id === evt.fromLane);
        const toIdx = SEQ_LANES.findIndex(l => l.id === evt.toLane);
        const fromX = 60 + fromIdx * 100;
        const toX = 60 + toIdx * 100;
        const isSelf = fromIdx === toIdx;

        return (
          <g key={evt.label + i}>
            {isSelf ? (
              <>
                <circle cx={fromX} cy={y} r="4" fill={evt.color} opacity="0.8" />
                <text x={fromX + 10} y={y + 3} className="text-[11px] font-mono" fill={evt.color} style={{ fontSize: 11 }}>{evt.label}</text>
              </>
            ) : (
              <>
                <line x1={fromX} y1={y} x2={toX} y2={y} stroke={evt.color} strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                <circle cx={fromX} cy={y} r="3" fill={evt.color} />
                <polygon points={`${toX - 6},${y - 3} ${toX},${y} ${toX - 6},${y + 3}`} fill={evt.color} />
                <text x={(fromX + toX) / 2} y={y - 6} textAnchor="middle" className="text-[11px] font-mono" fill={evt.color} style={{ fontSize: 11 }}>{evt.label}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

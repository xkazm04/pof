'use client';

import { useState, useCallback, useMemo } from 'react';
import { Swords, Zap, GitBranch, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FeatureRow } from '@/types/feature-matrix';
import { PipelineFlow } from '../../_shared';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { ScalableSelector, type SelectorItem } from '@/components/shared/ScalableSelector';
import { LaneSection } from './LaneSection';
import { ComboChainDiagram } from './ComboChainDiagram';
import {
  ACCENT, LANES, FLOW_ARROWS, SEQ_LANES, SEQ_EVENTS,
} from '../data';
import { WEAPONS } from '../data-metrics';
import type { Weapon } from '../data-metrics';

import { OVERLAY_WHITE, withOpacity, OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_12, OPACITY_15, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';

type WeaponItem = SelectorItem & Pick<Weapon, 'name' | 'category' | 'tier' | 'baseDamage' | 'attackSpeed'>;

interface FlowTabProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
}

export function FlowTab({ featureMap, defs, expanded, onToggle }: FlowTabProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>([]);

  const weaponItems: WeaponItem[] = useMemo(
    () => WEAPONS.map(wp => ({
      id: wp.id, name: wp.name, category: wp.category,
      tier: wp.tier, baseDamage: wp.baseDamage, attackSpeed: wp.attackSpeed,
    })),
    [],
  );

  const handleSelect = useCallback((items: WeaponItem[]) => {
    setSelectedWeapons(items.map(i => i.id));
  }, []);

  const renderWeaponItem = useCallback((item: WeaponItem, selected: boolean) => (
    <div
      className="px-3 py-2 rounded-lg border text-xs font-mono cursor-pointer transition-all"
      style={{
        backgroundColor: selected ? withOpacity(ACCENT, '0a') : 'transparent',
        borderColor: selected ? withOpacity(ACCENT, '4d') : 'var(--border)',
      }}
    >
      <div className="font-bold text-text">{item.name}</div>
      <div className="text-text-muted">{item.category} &middot; {item.tier} &middot; {item.baseDamage} dmg</div>
    </div>
  ), []);

  const selectedNames = useMemo(() => {
    if (selectedWeapons.length === 0) return null;
    const set = new Set(selectedWeapons);
    return WEAPONS.filter(w => set.has(w.id)).map(w => w.category);
  }, [selectedWeapons]);

  /** Filter lanes: if weapons selected, only show lanes relevant to melee/ranged. */
  const filteredLanes = useMemo(() => {
    if (!selectedNames || selectedNames.length === 0) return LANES;
    const hasRanged = selectedNames.includes('Bow') || selectedNames.includes('Staff');
    const hasMelee = selectedNames.some(c => !['Bow', 'Staff'].includes(c));
    return LANES.filter(lane => {
      if (lane.id === 'feedback') return true;
      if (lane.id === 'offensive') return hasMelee;
      if (lane.id === 'pipeline') return hasMelee || hasRanged;
      return true;
    });
  }, [selectedNames]);

  return (
    <motion.div key="flow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <BlueprintPanel color={ACCENT} className="p-3.5">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader label="Execution Flow" color={ACCENT} icon={Zap} />
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-colors cursor-pointer hover:bg-surface-hover"
            style={{ borderColor: withOpacity(ACCENT, OPACITY_20), color: ACCENT }}
          >
            <Filter className="w-3 h-3" />
            {selectedWeapons.length > 0 ? `${selectedWeapons.length} weapons` : 'Filter weapons'}
          </button>
        </div>
        {selectedWeapons.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {WEAPONS.filter(w => selectedWeapons.includes(w.id)).slice(0, 6).map(w => (
              <span key={w.id} className="px-2 py-0.5 rounded text-xs font-mono border"
                style={{ borderColor: withOpacity(w.color, OPACITY_20), color: w.color, backgroundColor: withOpacity(w.color, OPACITY_8) }}>
                {w.name}
              </span>
            ))}
            {selectedWeapons.length > 6 && <span className="text-2xs text-text-muted font-mono">+{selectedWeapons.length - 6} more</span>}
          </div>
        )}
        <div className="mt-1">
          <PipelineFlow steps={['Attack', 'Combo', 'Hit Detect', 'Damage', 'Reaction', 'Feedback']} accent={ACCENT} />
        </div>
      </BlueprintPanel>

      {/* Swim-Lane Flow Diagram */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader label="Action Swim-Lane Diagram" color={ACCENT} icon={GitBranch} />
        <div className="mt-2 overflow-x-auto custom-scrollbar">
          <SwimLaneDiagram />
        </div>
      </BlueprintPanel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-4">
          <SectionHeader label="Combat Lanes" color={ACCENT} icon={Swords} />
          <div className="space-y-4">
            {filteredLanes.map(lane => (
              <LaneSection key={lane.id} lane={lane} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} />
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

      <ScalableSelector
        items={weaponItems}
        groupBy="category"
        renderItem={renderWeaponItem}
        onSelect={handleSelect}
        selected={selectedWeapons}
        searchKey="name"
        placeholder="Search weapons..."
        mode="multi"
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Filter Weapons"
        accent={ACCENT}
      />
    </motion.div>
  );
}

/* ── Swim-Lane Flow Diagram ──────────────────────────────────────────── */

const SWIM_W = 620;
const SWIM_H = 230;
const SNODE_W = 120;
const SNODE_H = 24;

const SHORT_NAMES: Record<string, string> = {
  'Melee attack ability': 'Melee Attack',
  'Combo system': 'Combo System',
  'Dodge ability (GAS)': 'Dodge (GAS)',
  'Hit detection': 'Hit Detection',
  'GAS damage application': 'GAS Damage',
  'Death flow': 'Death Flow',
  'Hit reaction system': 'Hit Reaction',
  'Combat feedback': 'Combat Feedback',
};

interface SwimNode { name: string; cx: number; cy: number; color: string }

const LANE_CX: number[][] = [
  [120, 310, 500],
  [120, 310, 500],
  [215, 405],
];

const SWIM_LANE_DATA = LANES.map((lane, li) => {
  const cy = 40 + li * 75;
  return {
    ...lane,
    bandY: cy - 28,
    bandH: 56,
    cy,
    nodes: lane.featureNames.map((name, fi): SwimNode => ({
      name, cx: LANE_CX[li][fi], cy, color: lane.color,
    })),
  };
});

const SWIM_NODE_MAP = new Map<string, SwimNode>();
for (const lane of SWIM_LANE_DATA) {
  for (const node of lane.nodes) SWIM_NODE_MAP.set(node.name, node);
}

function SwimLaneDiagram() {
  return (
    <svg width="100%" height={SWIM_H} viewBox={`0 0 ${SWIM_W} ${SWIM_H}`} className="overflow-visible" preserveAspectRatio="xMidYMid meet">
      {/* Lane bands */}
      {SWIM_LANE_DATA.map((lane) => (
        <g key={lane.id}>
          <rect x={4} y={lane.bandY} width={SWIM_W - 8} height={lane.bandH} rx={6}
            fill={withOpacity(lane.color, OPACITY_5)} stroke={withOpacity(lane.color, OPACITY_10)} strokeWidth={1} />
          <text x={12} y={lane.bandY + 12} style={{ fontSize: 9 }} className="font-mono font-bold uppercase" fill={lane.color} opacity={0.6}>{lane.label}</text>
        </g>
      ))}

      {/* Flow arrows */}
      {FLOW_ARROWS.map((arrow, i) => {
        const from = SWIM_NODE_MAP.get(arrow.from);
        const to = SWIM_NODE_MAP.get(arrow.to);
        if (!from || !to) return null;
        const x1 = from.cx + SNODE_W / 2;
        const y1 = from.cy;
        const x2 = to.cx - SNODE_W / 2;
        const y2 = to.cy;
        const mx = (x1 + x2) / 2;
        return (
          <g key={i}>
            <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_15)} strokeWidth={1.5} />
            <polygon points={`${x2},${y2} ${x2 - 5},${y2 - 3} ${x2 - 5},${y2 + 3}`}
              fill={withOpacity(OVERLAY_WHITE, OPACITY_30)} />
            {arrow.label && (
              <text x={mx} y={(y1 + y2) / 2 - 5} textAnchor="middle" style={{ fontSize: 8 }} className="font-mono"
                fill={withOpacity(OVERLAY_WHITE, OPACITY_30)}>{arrow.label}</text>
            )}
          </g>
        );
      })}

      {/* Feature nodes */}
      {SWIM_LANE_DATA.flatMap((lane) =>
        lane.nodes.map((node) => (
          <g key={node.name}>
            <rect x={node.cx - SNODE_W / 2} y={node.cy - SNODE_H / 2} width={SNODE_W} height={SNODE_H} rx={4}
              fill={withOpacity(node.color, OPACITY_8)} stroke={withOpacity(node.color, OPACITY_30)} strokeWidth={1} />
            <text x={node.cx} y={node.cy + 4} textAnchor="middle" style={{ fontSize: 10 }} className="font-mono font-bold"
              fill={node.color}>{SHORT_NAMES[node.name] ?? node.name}</text>
          </g>
        ))
      )}
    </svg>
  );
}

/* ── Sequence Diagram SVG ──────────────────────────────────────────────── */

const SEQ_SVG_H = 50 + SEQ_EVENTS.length * 34 + 10;

/* Activation boxes: computed from event flow */
interface SeqActivation { laneIdx: number; y1: number; y2: number }
const SEQ_ACTIVATIONS: SeqActivation[] = (() => {
  const result: SeqActivation[] = [];
  const active: Record<string, number | null> = {};
  for (let i = 0; i < SEQ_EVENTS.length; i++) {
    const y = 50 + i * 34;
    const evt = SEQ_EVENTS[i];
    if (evt.fromLane !== evt.toLane && active[evt.fromLane] != null) {
      const li = SEQ_LANES.findIndex(l => l.id === evt.fromLane);
      result.push({ laneIdx: li, y1: active[evt.fromLane]!, y2: y + 4 });
      active[evt.fromLane] = null;
    }
    if (active[evt.toLane] == null) active[evt.toLane] = y - 4;
  }
  const endY = 50 + (SEQ_EVENTS.length - 1) * 34 + 16;
  for (const [laneId, startY] of Object.entries(active)) {
    if (startY != null) {
      const li = SEQ_LANES.findIndex(l => l.id === laneId);
      result.push({ laneIdx: li, y1: startY, y2: endY });
    }
  }
  return result;
})();

function SequenceDiagram() {
  return (
    <svg width="400" height={SEQ_SVG_H} viewBox={`0 0 400 ${SEQ_SVG_H}`} className="overflow-visible">
      {/* Lifelines */}
      {SEQ_LANES.map((lane, i) => {
        const x = 60 + i * 100;
        return (
          <g key={lane.id}>
            <line x1={x} y1={30} x2={x} y2={SEQ_SVG_H} stroke={lane.color} strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
            <rect x={x - 38} y={4} width="76" height="22" rx="4" fill={withOpacity(lane.color, OPACITY_12)} stroke={lane.color} strokeWidth="1" />
            <text x={x} y={18} textAnchor="middle" className="text-xs font-mono font-bold" fill={lane.color}>{lane.label}</text>
          </g>
        );
      })}

      {/* Activation boxes */}
      {SEQ_ACTIVATIONS.map((act, i) => {
        const x = 60 + act.laneIdx * 100;
        const lane = SEQ_LANES[act.laneIdx];
        return (
          <rect key={`act-${i}`} x={x - 4} y={act.y1} width={8} height={act.y2 - act.y1} rx={1}
            fill={withOpacity(lane.color, OPACITY_12)} stroke={lane.color} strokeWidth={0.5} strokeOpacity={0.3} />
        );
      })}

      {/* Events */}
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
                <text x={fromX + 10} y={y + 3} className="text-xs font-mono" fill={evt.color}>{evt.label}</text>
              </>
            ) : (
              <>
                <line x1={fromX} y1={y} x2={toX} y2={y} stroke={evt.color} strokeWidth="1.5" />
                <circle cx={fromX} cy={y} r="3" fill={evt.color} />
                <polygon points={`${toX - 6},${y - 3} ${toX},${y} ${toX - 6},${y + 3}`} fill={evt.color} />
                <text x={(fromX + toX) / 2} y={y - 6} textAnchor="middle" className="text-xs font-mono" fill={evt.color}>{evt.label}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

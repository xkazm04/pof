'use client';

import { useMemo } from 'react';
import { Network } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACCENT_PURPLE_BOLD, ACCENT_RED, ACCENT_ORANGE, ACCENT_CYAN,
} from '@/lib/chart-colors';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_TIMING } from '@/lib/dzin/animation-constants';
import { useDzinSelection } from '@/lib/dzin/selection-context';
import { isRelatedToSelection, ENTITY_RELATIONS } from '@/lib/dzin/entity-relations';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '@/components/modules/core-engine/unique-tabs/_shared';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface TagDepsPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

interface TagDepNode { id: string; label: string; category: string; color: string }
interface TagDepEdge { from: string; to: string; type: 'blocks' | 'requires' }

const TAG_DEP_CATEGORIES: Record<string, string> = {
  Ability: ACCENT_PURPLE_BOLD,
  State: ACCENT_RED,
  Damage: ACCENT_ORANGE,
  Input: ACCENT_CYAN,
};

const TAG_DEP_NODES: TagDepNode[] = [
  { id: 'melee', label: 'Ability.MeleeAttack', category: 'Ability', color: TAG_DEP_CATEGORIES.Ability },
  { id: 'dodge', label: 'Ability.Dodge', category: 'Ability', color: TAG_DEP_CATEGORIES.Ability },
  { id: 'spell', label: 'Ability.Spell', category: 'Ability', color: TAG_DEP_CATEGORIES.Ability },
  { id: 'stunned', label: 'State.Stunned', category: 'State', color: TAG_DEP_CATEGORIES.State },
  { id: 'dead', label: 'State.Dead', category: 'State', color: TAG_DEP_CATEGORIES.State },
  { id: 'invuln', label: 'State.Invulnerable', category: 'State', color: TAG_DEP_CATEGORIES.State },
  { id: 'dmg_phys', label: 'Damage.Physical', category: 'Damage', color: TAG_DEP_CATEGORIES.Damage },
  { id: 'dmg_magic', label: 'Damage.Magical', category: 'Damage', color: TAG_DEP_CATEGORIES.Damage },
  { id: 'input_atk', label: 'Input.Attack', category: 'Input', color: TAG_DEP_CATEGORIES.Input },
];

const TAG_DEP_EDGES: TagDepEdge[] = [
  { from: 'stunned', to: 'melee', type: 'blocks' },
  { from: 'dead', to: 'melee', type: 'blocks' },
  { from: 'dead', to: 'dodge', type: 'blocks' },
  { from: 'dead', to: 'spell', type: 'blocks' },
  { from: 'invuln', to: 'dmg_phys', type: 'blocks' },
  { from: 'invuln', to: 'dmg_magic', type: 'blocks' },
];

/* ── Helpers ────────────────────────────────────────────────────────────── */

function nodeById(id: string): TagDepNode | undefined {
  return TAG_DEP_NODES.find((n) => n.id === id);
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function TagDepsMicro() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-2">
      <Network className="w-5 h-5 text-amber-400" />
      <span className="font-mono text-xs">{TAG_DEP_EDGES.length}</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function TagDepsCompact() {
  const { selection } = useDzinSelection();

  return (
    <div className="space-y-1.5 p-2 text-xs">
      {TAG_DEP_EDGES.map((edge, i) => {
        const fromNode = nodeById(edge.from);
        const toNode = nodeById(edge.to);
        if (!fromNode || !toNode) return null;
        const fromRelated = isRelatedToSelection('tag', fromNode.label, selection, ENTITY_RELATIONS);
        const toRelated = isRelatedToSelection('tag', toNode.label, selection, ENTITY_RELATIONS);
        const isRelated = fromRelated || toRelated;
        return (
          <motion.div
            key={i}
            className="flex items-center gap-1.5 text-text-muted"
            animate={{ opacity: selection && !isRelated ? 0.4 : 1 }}
            transition={{ duration: DZIN_TIMING.HIGHLIGHT }}
          >
            <span className="font-medium" style={{ color: fromNode.color }}>{fromNode.label.split('.')[1]}</span>
            <span className="text-2xs opacity-60">{edge.type}</span>
            <span className="font-medium" style={{ color: toNode.color }}>{toNode.label.split('.')[1]}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

const SVG_WIDTH = 380;
const SVG_HEIGHT = 260;

function TagDepsFull() {
  const nodePositions = useMemo(() => {
    // Arrange nodes in a circular layout
    const positions = new Map<string, { x: number; y: number }>();
    const cx = SVG_WIDTH / 2;
    const cy = SVG_HEIGHT / 2;
    const rx = 140;
    const ry = 95;
    TAG_DEP_NODES.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / TAG_DEP_NODES.length - Math.PI / 2;
      positions.set(node.id, {
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
      });
    });
    return positions;
  }, []);

  return (
    <div className="space-y-2.5">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <SectionLabel label="Tag Dependency Network" />
        <div className="mt-2 flex justify-center">
          <svg
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="overflow-visible"
          >
            {/* Edges */}
            {TAG_DEP_EDGES.map((edge, i) => {
              const from = nodePositions.get(edge.from);
              const to = nodePositions.get(edge.to);
              if (!from || !to) return null;
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              return (
                <g key={i}>
                  <line
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="1.5"
                    strokeDasharray={edge.type === 'requires' ? '4 2' : undefined}
                  />
                  <text
                    x={midX} y={midY - 4}
                    textAnchor="middle"
                    className="text-[11px] font-mono fill-[var(--text-muted)]"
                  >
                    {edge.type}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {TAG_DEP_NODES.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;
              return (
                <g key={node.id}>
                  <circle
                    cx={pos.x} cy={pos.y} r="8"
                    fill={`${node.color}30`}
                    stroke={node.color}
                    strokeWidth="1.5"
                    style={{ filter: `drop-shadow(0 0 4px ${node.color}60)` }}
                  />
                  <text
                    x={pos.x} y={pos.y + 18}
                    textAnchor="middle"
                    className="text-[11px] font-mono font-bold"
                    fill={node.color}
                  >
                    {node.label.split('.')[1]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </SurfaceCard>

      {/* Category legend */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <SectionLabel label="Categories" />
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(TAG_DEP_CATEGORIES).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}60` }}
              />
              <span className="text-text-muted">{cat}</span>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main TagDepsPanel ──────────────────────────────────────────────────── */

export function TagDepsPanel({ featureMap: _featureMap, defs: _defs }: TagDepsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Tag Deps" icon={<Network className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DZIN_TIMING.DENSITY / 2 }}
        >
          {density === 'micro' && <TagDepsMicro />}
          {density === 'compact' && <TagDepsCompact />}
          {density === 'full' && <TagDepsFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}

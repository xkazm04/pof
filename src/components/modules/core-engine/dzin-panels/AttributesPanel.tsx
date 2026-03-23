'use client';

import { useState, useMemo, useCallback } from 'react';
import { BarChart3, Network } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_TIMING } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  SectionLabel,
  STATUS_COLORS,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS, STATUS_IMPROVED, ACCENT_RED, MODULE_COLORS, ACCENT_GREEN,
  ACCENT_EMERALD_DARK, STATUS_WARNING,
} from '@/lib/chart-colors';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

/* -- Props ----------------------------------------------------------------- */

export interface AttributesPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* -- Constants ------------------------------------------------------------- */

const CORE_ATTRIBUTES = ['Health', 'Mana', 'Strength', 'Dexterity', 'Intelligence'];
const DERIVED_ATTRIBUTES = ['Armor', 'AttackPower', 'CritChance', 'CritDamage'];

interface AttrNode { id: string; label: string }
interface AttrEdge { from: string; to: string; type: 'scales' | 'partial'; label: string }

const ATTR_WEB_NODES: AttrNode[] = [
  { id: 'str', label: 'Strength' },
  { id: 'dex', label: 'Dexterity' },
  { id: 'int', label: 'Intelligence' },
  { id: 'hp', label: 'Health' },
  { id: 'mp', label: 'Mana' },
  { id: 'arm', label: 'Armor' },
  { id: 'atk', label: 'AttackPower' },
  { id: 'crit', label: 'CritChance' },
  { id: 'cdmg', label: 'CritDamage' },
];

const ATTR_WEB_EDGES: AttrEdge[] = [
  { from: 'str', to: 'atk', type: 'scales', label: 'Scales' },
  { from: 'dex', to: 'crit', type: 'scales', label: 'Scales' },
  { from: 'int', to: 'mp', type: 'scales', label: 'Scales' },
  { from: 'str', to: 'arm', type: 'partial', label: 'Partial' },
  { from: 'dex', to: 'atk', type: 'partial', label: 'Partial' },
];

interface GrowthPoint { level: number; power: number }

const GROWTH_BUILDS: { name: string; color: string; points: GrowthPoint[] }[] = [
  {
    name: 'Warrior', color: ACCENT_RED,
    points: [
      { level: 1, power: 10 }, { level: 5, power: 35 }, { level: 10, power: 80 },
      { level: 15, power: 140 }, { level: 20, power: 210 }, { level: 25, power: 290 },
      { level: 30, power: 370 }, { level: 35, power: 440 }, { level: 40, power: 500 },
      { level: 45, power: 550 }, { level: 50, power: 600 },
    ],
  },
  {
    name: 'Mage', color: MODULE_COLORS.core,
    points: [
      { level: 1, power: 8 }, { level: 5, power: 25 }, { level: 10, power: 60 },
      { level: 15, power: 110 }, { level: 20, power: 190 }, { level: 25, power: 300 },
      { level: 30, power: 420 }, { level: 35, power: 530 }, { level: 40, power: 620 },
      { level: 45, power: 690 }, { level: 50, power: 750 },
    ],
  },
  {
    name: 'Rogue', color: ACCENT_GREEN,
    points: [
      { level: 1, power: 12 }, { level: 5, power: 40 }, { level: 10, power: 90 },
      { level: 15, power: 150 }, { level: 20, power: 220 }, { level: 25, power: 280 },
      { level: 30, power: 350 }, { level: 35, power: 420 }, { level: 40, power: 510 },
      { level: 45, power: 610 }, { level: 50, power: 720 },
    ],
  },
];

/* -- Helpers --------------------------------------------------------------- */

function statusDotColor(status: FeatureStatus | undefined): string {
  if (!status) return STATUS_COLORS.unknown.dot;
  return STATUS_COLORS[status].dot;
}

/* -- Micro density --------------------------------------------------------- */

function AttributesMicro() {
  const total = CORE_ATTRIBUTES.length + DERIVED_ATTRIBUTES.length;

  return (
    <div className="flex flex-col items-center justify-center gap-1 p-2">
      <BarChart3 className="w-5 h-5 text-emerald-400" />
      <span className="font-mono text-xs text-text">{total}</span>
    </div>
  );
}

/* -- Compact density ------------------------------------------------------- */

function AttributesCompact({ featureMap }: AttributesPanelProps) {
  const attrStatus = featureMap.get('Core AttributeSet')?.status;
  const dotColor = statusDotColor(attrStatus);

  return (
    <div className="space-y-2 p-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <span className="font-medium text-text">Core Attributes</span>
        <span className="ml-auto font-mono text-text-muted">{CORE_ATTRIBUTES.length}</span>
      </div>
      <div className="w-full h-1.5 bg-surface-deep rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${(CORE_ATTRIBUTES.length / (CORE_ATTRIBUTES.length + DERIVED_ATTRIBUTES.length)) * 100}%`,
            backgroundColor: STATUS_SUCCESS,
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_IMPROVED }} />
        <span className="font-medium text-text">Derived Attributes</span>
        <span className="ml-auto font-mono text-text-muted">{DERIVED_ATTRIBUTES.length}</span>
      </div>
      <div className="w-full h-1.5 bg-surface-deep rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${(DERIVED_ATTRIBUTES.length / (CORE_ATTRIBUTES.length + DERIVED_ATTRIBUTES.length)) * 100}%`,
            backgroundColor: STATUS_IMPROVED,
          }}
        />
      </div>
    </div>
  );
}

/* -- Full density ---------------------------------------------------------- */

function AttributesFull({ featureMap, defs }: AttributesPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));
  const attrStatus = featureMap.get('Core AttributeSet')?.status ?? 'unknown';

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <FeatureCard name="Core AttributeSet" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#10b981" />
        <FeatureCard name="Default attribute initialization" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#10b981" />
      </div>

      {/* Attribute catalog */}
      <SurfaceCard level={2} className="p-3 relative">
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" /> Attribute Set Catalog
        </div>

        <div className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">Core Attributes</div>
        <div className="grid grid-cols-3 gap-2 mb-2.5">
          {CORE_ATTRIBUTES.map((attr, i) => {
            const isInit = attrStatus === 'implemented' || attrStatus === 'improved';
            return (
              <motion.div
                key={attr}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border"
                style={{
                  backgroundColor: isInit ? `${STATUS_SUCCESS}15` : 'var(--surface)',
                  borderColor: isInit ? `${STATUS_SUCCESS}30` : 'var(--border)',
                  color: isInit ? STATUS_SUCCESS : 'var(--text-muted)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isInit ? STATUS_SUCCESS : 'var(--border-bright)' }} />
                <span className="font-mono">{attr}</span>
              </motion.div>
            );
          })}
        </div>

        <div className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">Derived Attributes</div>
        <div className="grid grid-cols-3 gap-2">
          {DERIVED_ATTRIBUTES.map((attr, i) => {
            const isInit = attrStatus === 'implemented' || attrStatus === 'improved';
            return (
              <motion.div
                key={attr}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (CORE_ATTRIBUTES.length + i) * 0.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border"
                style={{
                  backgroundColor: isInit ? `${STATUS_IMPROVED}15` : 'var(--surface)',
                  borderColor: isInit ? `${STATUS_IMPROVED}30` : 'var(--border)',
                  color: isInit ? STATUS_IMPROVED : 'var(--text-muted)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isInit ? STATUS_IMPROVED : 'var(--border-bright)' }} />
                <span className="font-mono">{attr}</span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Attribute Relationship Web */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <SectionLabel icon={Network} label="Attribute Relationship Web" color="#10b981" />
        <div className="mt-2.5 flex justify-center">
          <AttributeRelationshipWeb />
        </div>
      </SurfaceCard>

      {/* Attribute Growth Projections */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <SectionLabel icon={BarChart3} label="Attribute Growth Projections (Lv 1-50)" color="#10b981" />
        <div className="mt-2.5">
          <AttributeGrowthChart />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* -- Attribute Relationship Web SVG ---------------------------------------- */

function AttributeRelationshipWeb() {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 50;
  const n = ATTR_WEB_NODES.length;

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    ATTR_WEB_NODES.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions[node.id] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
    return positions;
  }, [cx, cy, r, n]);

  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return null;
    const visited = new Set<string>();
    const queue = [hoveredNode];
    visited.add(hoveredNode);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of ATTR_WEB_EDGES) {
        if (edge.from === current && !visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push(edge.to);
        }
        if (edge.to === current && !visited.has(edge.from)) {
          visited.add(edge.from);
          queue.push(edge.from);
        }
      }
    }
    return visited;
  }, [hoveredNode]);

  const isEdgeConnected = useCallback((edge: AttrEdge) => {
    if (!connectedNodes) return true;
    return connectedNodes.has(edge.from) && connectedNodes.has(edge.to);
  }, [connectedNodes]);

  const isNodeConnected = useCallback((nodeId: string) => {
    if (!connectedNodes) return true;
    return connectedNodes.has(nodeId);
  }, [connectedNodes]);

  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible"
      onMouseLeave={() => setHoveredNode(null)}
    >
      <defs>
        <filter id="attr-panel-web-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodOpacity="0.6" />
        </filter>
      </defs>
      {ATTR_WEB_EDGES.map((edge) => {
        const from = nodePositions[edge.from];
        const to = nodePositions[edge.to];
        if (!from || !to) return null;
        const edgeColor = edge.type === 'scales' ? ACCENT_EMERALD_DARK : STATUS_WARNING;
        const connected = isEdgeConnected(edge);
        const dimmed = hoveredNode !== null && !connected;
        return (
          <motion.g key={`${edge.from}-${edge.to}`}
            initial={{ opacity: 0 }} animate={{ opacity: dimmed ? 0.15 : 1 }} transition={{ duration: 0.2 }}
          >
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={edgeColor} strokeWidth={edge.type === 'scales' ? 2 : 1.5}
              strokeDasharray={edge.type === 'partial' ? '4 3' : undefined}
              opacity={0.7}
              filter={hoveredNode && connected ? 'url(#attr-panel-web-glow)' : undefined}
            />
            <text
              x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5}
              textAnchor="middle" className="text-[11px] font-mono font-bold" fill={edgeColor}
            >
              {edge.label}
            </text>
          </motion.g>
        );
      })}
      {ATTR_WEB_NODES.map((node) => {
        const pos = nodePositions[node.id];
        if (!pos) return null;
        const isCore = CORE_ATTRIBUTES.map(a => a.toLowerCase()).includes(node.label.toLowerCase());
        const nodeColor = isCore ? ACCENT_EMERALD_DARK : STATUS_IMPROVED;
        const connected = isNodeConnected(node.id);
        const dimmed = hoveredNode !== null && !connected;
        const isHovered = hoveredNode === node.id;
        return (
          <motion.g key={node.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: dimmed ? 0.15 : 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={() => setHoveredNode(node.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={pos.x} cy={pos.y} r={isHovered ? 16 : 14}
              fill={`${nodeColor}20`} stroke={nodeColor}
              strokeWidth={isHovered ? 2.5 : 1.5}
              filter={hoveredNode && connected ? 'url(#attr-panel-web-glow)' : undefined}
            />
            <text
              x={pos.x} y={pos.y + 1}
              textAnchor="middle" dominantBaseline="central"
              className="text-[11px] font-mono font-bold" fill={nodeColor}
            >
              {node.label.slice(0, 3)}
            </text>
            <text
              x={pos.x} y={pos.y + (pos.y > cy ? 26 : -20)}
              textAnchor="middle"
              className="text-[11px] font-mono fill-[var(--text-muted)]"
            >
              {node.label}
            </text>
          </motion.g>
        );
      })}
      <g transform={`translate(10, ${size - 30})`}>
        <line x1={0} y1={0} x2={16} y2={0} stroke="#10b981" strokeWidth={2} />
        <text x={20} y={4} className="text-[11px] font-mono fill-[var(--text-muted)]">Scales</text>
        <line x1={65} y1={0} x2={81} y2={0} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={85} y={4} className="text-[11px] font-mono fill-[var(--text-muted)]">Partial</text>
      </g>
    </svg>
  );
}

/* -- Attribute Growth Chart SVG -------------------------------------------- */

function AttributeGrowthChart() {
  const w = 500;
  const h = 150;
  const pad = { top: 10, right: 20, bottom: 30, left: 45 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const maxPower = Math.max(...GROWTH_BUILDS.flatMap(b => b.points.map(p => p.power)));
  const maxLevel = 50;

  const toX = (level: number) => pad.left + (level / maxLevel) * chartW;
  const toY = (power: number) => pad.top + chartH - (power / maxPower) * chartH;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <line key={pct} x1={pad.left} y1={toY(pct * maxPower)} x2={w - pad.right} y2={toY(pct * maxPower)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {/* X axis labels */}
      {[1, 10, 20, 30, 40, 50].map((lv) => (
        <text key={lv} x={toX(lv)} y={h - 5} textAnchor="middle" className="text-[11px] font-mono fill-[var(--text-muted)]">
          Lv{lv}
        </text>
      ))}
      {/* Y axis labels */}
      {[0, 250, 500, 750].map((pw) => (
        <text key={pw} x={pad.left - 5} y={toY(pw) + 3} textAnchor="end" className="text-[11px] font-mono fill-[var(--text-muted)]">
          {pw}
        </text>
      ))}
      {/* Build lines */}
      {GROWTH_BUILDS.map((build) => {
        const d = build.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.level)},${toY(p.power)}`).join(' ');
        return (
          <g key={build.name}>
            <motion.path
              d={d} fill="none" stroke={build.color} strokeWidth={2}
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: 'easeInOut' }}
            />
            <text
              x={toX(50) + 5} y={toY(build.points[build.points.length - 1].power)}
              className="text-[11px] font-mono font-bold" fill={build.color}
            >
              {build.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* -- Main AttributesPanel -------------------------------------------------- */

export function AttributesPanel({ featureMap, defs }: AttributesPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Attributes" icon={<BarChart3 className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DZIN_TIMING.DENSITY / 2 }}
        >
          {density === 'micro' && <AttributesMicro />}
          {density === 'compact' && <AttributesCompact featureMap={featureMap} defs={defs} />}
          {density === 'full' && <AttributesFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}

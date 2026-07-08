'use client';

import { motion } from 'framer-motion';
import { isFeatureDone } from '@/lib/constellation/layout';
import type { ConstellationNode } from '@/lib/constellation/layout';
import { PLAN_STATUS_COLORS, STATUS_BLOCKER, STATUS_INFO } from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import { NODE_W, NODE_H, STATUS_LABEL } from './constants';
import { truncate } from './helpers';

// ── Node ─────────────────────────────────────────────────────────────────────

export function ConstellationNodeG({
  node, index, isNext, dimmed, onHoverStart, onHoverEnd,
}: {
  node: ConstellationNode;
  index: number;
  isNext: boolean;
  dimmed: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const color = PLAN_STATUS_COLORS[node.status] ?? PLAN_STATUS_COLORS.unknown;
  const done = isFeatureDone(node.status);
  const x = node.x - NODE_W / 2;
  const y = node.y - NODE_H / 2;
  const blockerLabel = node.blockers.length > 0
    ? `Blocked by ${node.blockers[0].featureName}${node.blockers.length > 1 ? ` +${node.blockers.length - 1}` : ''}`
    : null;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: dimmed ? 0.22 : 1 }}
      transition={{ duration: MOTION.base, delay: Math.min(index * 0.02, 0.4) }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      style={{ cursor: 'default' }}
    >
      <title>{`${node.featureName} — ${STATUS_LABEL[node.status]}${blockerLabel ? ` · ${blockerLabel}` : ''}`}</title>

      {/* "Do this next" pulsing ring */}
      {isNext && (
        <rect x={x - 4} y={y - 4} width={NODE_W + 8} height={NODE_H + 8} rx={12} fill="none" stroke={STATUS_INFO} strokeWidth={2} filter="url(#cst-glow)">
          <animate attributeName="opacity" values="0.35;0.95;0.35" dur="1.8s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Node body */}
      <rect
        x={x} y={y} width={NODE_W} height={NODE_H} rx={9}
        fill="var(--surface)"
        stroke={color}
        strokeWidth={done ? 2 : 1.25}
        opacity={done ? 1 : 0.92}
        style={done ? { filter: 'url(#cst-glow)' } : undefined}
      />
      {/* Status accent bar (left) */}
      <rect x={x} y={y} width={3.5} height={NODE_H} rx={1.5} fill={color} opacity={node.isBlocked ? 0.5 : 0.9} />

      {/* Status dot */}
      <circle cx={x + NODE_W - 12} cy={y + 12} r={4} fill={color} />

      {/* Feature name */}
      <text x={x + 12} y={y + 21} fill="var(--text)" fontSize="11" fontWeight="600">
        {truncate(node.featureName, 20)}
      </text>
      {/* Category */}
      <text x={x + 12} y={y + 36} fill="var(--text-muted)" fontSize="9">
        {truncate(node.category, 22)}
      </text>

      {/* Fan-out badge */}
      {node.dependentCount > 0 && (
        <text x={x + NODE_W - 12} y={y + NODE_H - 8} fill="var(--text-muted)" fontSize="8" textAnchor="end">
          ↳{node.dependentCount}
        </text>
      )}

      {/* Blocked indicator + label */}
      {node.isBlocked && blockerLabel && (
        <g>
          <g transform={`translate(${x + 12}, ${y + NODE_H - 14})`}>
            <AlertTriangleGlyph />
          </g>
          <text x={x + 24} y={y + NODE_H - 6} fill={STATUS_BLOCKER} fontSize="8">
            {truncate(blockerLabel, 22)}
          </text>
        </g>
      )}
    </motion.g>
  );
}

/** Small inline triangle glyph (avoids an HTML lucide icon inside SVG). */
function AlertTriangleGlyph() {
  return <path d="M5 0 L10 9 L0 9 Z" fill="none" stroke={STATUS_BLOCKER} strokeWidth={1.2} strokeLinejoin="round" transform="scale(0.85)" />;
}

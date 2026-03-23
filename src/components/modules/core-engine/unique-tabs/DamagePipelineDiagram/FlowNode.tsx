'use client';

import { motion } from 'framer-motion';
import { STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import type { PipelineNode } from './types';
import { ELEMENT_COLORS, KIND_STYLE, NODE_W, NODE_H } from './types';

// Helper: detect node behavior from label/id
function isConsumeNode(node: PipelineNode): boolean {
  return node.label.toLowerCase().includes('consume');
}
function isClampNode(node: PipelineNode): boolean {
  return node.label.toLowerCase().includes('clamp') ||
    (node.kind === 'action' && node.detail.toLowerCase().includes('clamp'));
}

interface FlowNodeProps {
  node: PipelineNode;
  x: number;
  y: number;
  delay: number;
  expanded: boolean;
  onToggle: () => void;
}

export function FlowNode({ node, x, y, delay, expanded, onToggle }: FlowNodeProps) {
  const style = KIND_STYLE[node.kind];
  const elemColor = node.element ? ELEMENT_COLORS[node.element] : undefined;
  const borderColor = elemColor ?? style.border;
  const textColor = elemColor ?? style.text;

  const consume = isConsumeNode(node);
  const clamp = isClampNode(node);

  return (
    <motion.g
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      {/* Clamp node: bounding box glow pulses */}
      {clamp && (
        <>
          <rect
            x={x - NODE_W / 2 - 3} y={y - 3}
            width={NODE_W + 6} height={NODE_H + 6}
            rx={8} fill="none"
            stroke={STATUS_WARNING} strokeWidth={2}
            strokeDasharray="8 4" opacity={0.5}
          >
            <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
          </rect>
          {/* Corner clamp brackets */}
          <path d={`M ${x - NODE_W / 2 - 1} ${y + 8} L ${x - NODE_W / 2 - 1} ${y - 1} L ${x - NODE_W / 2 + 10} ${y - 1}`}
            fill="none" stroke={STATUS_WARNING} strokeWidth={2} opacity={0.7} />
          <path d={`M ${x + NODE_W / 2 - 10} ${y - 1} L ${x + NODE_W / 2 + 1} ${y - 1} L ${x + NODE_W / 2 + 1} ${y + 8}`}
            fill="none" stroke={STATUS_WARNING} strokeWidth={2} opacity={0.7} />
          <path d={`M ${x - NODE_W / 2 - 1} ${y + NODE_H - 8} L ${x - NODE_W / 2 - 1} ${y + NODE_H + 1} L ${x - NODE_W / 2 + 10} ${y + NODE_H + 1}`}
            fill="none" stroke={STATUS_WARNING} strokeWidth={2} opacity={0.7} />
          <path d={`M ${x + NODE_W / 2 - 10} ${y + NODE_H + 1} L ${x + NODE_W / 2 + 1} ${y + NODE_H + 1} L ${x + NODE_W / 2 + 1} ${y + NODE_H - 8}`}
            fill="none" stroke={STATUS_WARNING} strokeWidth={2} opacity={0.7} />
          {/* Clamp limit labels */}
          <text x={x - NODE_W / 2 - 6} y={y + NODE_H / 2 + 3} textAnchor="end"
            className="font-mono font-bold" fill={STATUS_WARNING} opacity={0.8} style={{ fontSize: 11 }}>
            0
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite" />
          </text>
          <text x={x + NODE_W / 2 + 6} y={y + NODE_H / 2 + 3} textAnchor="start"
            className="font-mono font-bold" fill={STATUS_WARNING} opacity={0.8} style={{ fontSize: 11 }}>
            MAX
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" begin="1s" repeatCount="indefinite" />
          </text>
        </>
      )}

      {/* Consume meta: drain animation */}
      {consume && (
        <>
          <rect x={x - NODE_W / 2 + 4} y={y + NODE_H - 5}
            width={NODE_W - 8} height={3} rx={1.5}
            fill={borderColor} opacity={0.15} />
          <rect x={x - NODE_W / 2 + 4} y={y + NODE_H - 5}
            height={3} rx={1.5} fill={borderColor}>
            <animate attributeName="width" values={`${NODE_W - 8};0`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0.1" dur="2s" repeatCount="indefinite" />
          </rect>
          {[0, 1, 2, 3, 4].map(i => {
            const px = x - NODE_W / 2 + 20 + i * ((NODE_W - 40) / 4);
            return (
              <circle key={`drain-${i}`} cx={px} r={1.5} fill={borderColor}>
                <animate attributeName="cy" values={`${y + NODE_H - 4};${y - 6}`} dur="1.8s" begin={`${i * 0.35}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0" dur="1.8s" begin={`${i * 0.35}s`} repeatCount="indefinite" />
              </circle>
            );
          })}
          <text x={x + NODE_W / 2 + 6} y={y + NODE_H - 1} textAnchor="start"
            className="font-mono font-bold" fill={STATUS_ERROR} style={{ fontSize: 11 }}>
            {'\u2192'} 0
            <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2s" repeatCount="indefinite" />
          </text>
        </>
      )}

      {/* Node box */}
      <rect
        x={x - NODE_W / 2} y={y}
        width={NODE_W} height={NODE_H}
        rx={node.kind === 'branch' ? 2 : 6}
        fill={elemColor ? `${elemColor}15` : style.bg}
        stroke={borderColor}
        strokeWidth={clamp ? 2 : 1.5}
        strokeDasharray={node.kind === 'branch' ? '6 3' : undefined}
        className="cursor-pointer"
        onClick={onToggle}
        data-testid={`pipeline-node-${node.id}`}
      />

      {/* Kind badge */}
      <rect x={x + NODE_W / 2 - 52} y={y + 2}
        width={50} height={14} rx={3}
        fill={borderColor} fillOpacity={0.2} />
      <text x={x + NODE_W / 2 - 27} y={y + 12}
        textAnchor="middle"
        className="font-mono font-bold uppercase"
        fill={borderColor} style={{ fontSize: 11 }}>
        {node.kind}
      </text>

      {/* Label */}
      <text x={x} y={y + 24} textAnchor="middle"
        className="text-[11px] font-mono font-bold cursor-pointer"
        fill={textColor} onClick={onToggle}>
        {node.label}
      </text>

      {/* Detail subtitle */}
      <text x={x} y={y + 36} textAnchor="middle"
        className="font-mono fill-[var(--text-muted)]" style={{ fontSize: 11 }}>
        {node.detail.length > 44 ? node.detail.slice(0, 42) + '...' : node.detail}
      </text>

      {/* Expand indicator */}
      {node.cppRef && (
        <text x={x - NODE_W / 2 + 8} y={y + 13}
          className="fill-[var(--text-muted)] cursor-pointer"
          style={{ fontSize: 11 }} onClick={onToggle}>
          {expanded ? '\u25BE' : '\u25B8'}
        </text>
      )}
    </motion.g>
  );
}

export function FlowArrow({ x1, y1, x2, y2, color, label, delay, dashed }: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; label?: string; delay: number; dashed?: boolean;
}) {
  const isStraight = x1 === x2;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.7 }}
      transition={{ delay, duration: 0.2 }}
    >
      {isStraight ? (
        <>
          <line x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color} strokeWidth={1.5}
            strokeDasharray={dashed ? '4 3' : undefined} />
          <polygon
            points={`${x2 - 4},${y2 - 6} ${x2},${y2} ${x2 + 4},${y2 - 6}`}
            fill={color} />
        </>
      ) : (
        <>
          <path
            d={`M ${x1} ${y1} L ${x1} ${(y1 + y2) / 2} L ${x2} ${(y1 + y2) / 2} L ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth={1.5}
            strokeDasharray={dashed ? '4 3' : undefined} />
          <polygon
            points={`${x2 - 4},${y2 - 6} ${x2},${y2} ${x2 + 4},${y2 - 6}`}
            fill={color} />
        </>
      )}
      {label && (
        <text
          x={(x1 + x2) / 2 + (x1 === x2 ? 8 : 0)}
          y={(y1 + y2) / 2 - 3}
          className="font-mono font-bold"
          style={{ fontSize: 11 }}
          fill={color} textAnchor="middle">
          {label}
        </text>
      )}
    </motion.g>
  );
}

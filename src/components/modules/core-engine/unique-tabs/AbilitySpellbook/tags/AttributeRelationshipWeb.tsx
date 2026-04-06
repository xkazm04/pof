'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  STATUS_IMPROVED, ACCENT_EMERALD_DARK, MODULE_COLORS,
  withOpacity, OPACITY_12,
} from '@/lib/chart-colors';
import { ATTR_WEB_NODES, ATTR_WEB_EDGES, type AttrEdge } from '../data';
import { useSpellbookData } from '../context';

export function AttributeRelationshipWeb() {
  const { CORE_ATTRIBUTES } = useSpellbookData();
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 50;
  const n = ATTR_WEB_NODES.length;

  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>({});

  const defaultPositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    ATTR_WEB_NODES.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions[node.id] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
    return positions;
  }, []);

  const nodePositions = useMemo(() => ({
    ...defaultPositions, ...customPositions,
  }), [defaultPositions, customPositions]);

  const coreAttrSet = useMemo(
    () => new Set(CORE_ATTRIBUTES.map(a => a.toLowerCase())),
    [CORE_ATTRIBUTES],
  );

  const handleDrag = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedNode || !svgRef.current) return;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    setCustomPositions(prev => ({ ...prev, [draggedNode]: { x: point.x, y: point.y } }));
  }, [draggedNode]);

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
      ref={svgRef}
      width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible"
      onMouseMove={handleDrag}
      onMouseUp={() => setDraggedNode(null)}
      onMouseLeave={() => { setHoveredNode(null); setDraggedNode(null); }}
      style={{ cursor: draggedNode ? 'grabbing' : undefined }}
    >
      <defs>
        <filter id="attr-web-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodOpacity="0.6" />
        </filter>
      </defs>
      {/* Edges */}
      {ATTR_WEB_EDGES.map((edge) => {
        const from = nodePositions[edge.from];
        const to = nodePositions[edge.to];
        if (!from || !to) return null;
        const edgeColor = edge.type === 'scales' ? ACCENT_EMERALD_DARK : MODULE_COLORS.content;
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
              filter={hoveredNode && connected ? 'url(#attr-web-glow)' : undefined}
            />
            <text
              x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5}
              textAnchor="middle" className="text-xs font-mono font-bold" fill={edgeColor}
            >
              {edge.label}
            </text>
          </motion.g>
        );
      })}
      {/* Nodes */}
      {ATTR_WEB_NODES.map((node, i) => {
        const pos = nodePositions[node.id];
        if (!pos) return null;
        const isCore = coreAttrSet.has(node.label.toLowerCase());
        const nodeColor = isCore ? ACCENT_EMERALD_DARK : STATUS_IMPROVED;
        const connected = isNodeConnected(node.id);
        const dimmed = hoveredNode !== null && !connected;
        const isHovered = hoveredNode === node.id;
        return (
          <motion.g key={node.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: dimmed ? 0.15 : 1, scale: 1 }}
            transition={{ duration: 0.2, delay: dimmed ? 0 : i * 0.06 }}
            onMouseEnter={() => { if (!draggedNode) setHoveredNode(node.id); }}
            onMouseDown={(e) => { e.preventDefault(); setDraggedNode(node.id); setHoveredNode(node.id); }}
            style={{ cursor: draggedNode === node.id ? 'grabbing' : 'grab' }}
          >
            <circle
              cx={pos.x} cy={pos.y} r={isHovered ? 16 : 14}
              fill={`${withOpacity(nodeColor, OPACITY_12)}`} stroke={nodeColor}
              strokeWidth={isHovered ? 2.5 : 1.5}
              filter={hoveredNode && connected ? 'url(#attr-web-glow)' : undefined}
            />
            <text
              x={pos.x} y={pos.y + 1}
              textAnchor="middle" dominantBaseline="central"
              className="text-xs font-mono font-bold" fill={nodeColor}
            >
              {node.label.slice(0, 3)}
            </text>
            <text
              x={pos.x} y={pos.y + (pos.y > cy ? 26 : -20)}
              textAnchor="middle"
              className="text-xs font-mono fill-[var(--text-muted)]"
            >
              {node.label}
            </text>
          </motion.g>
        );
      })}
      {/* Legend */}
      <g transform={`translate(10, ${size - 30})`}>
        <line x1={0} y1={0} x2={16} y2={0} stroke={ACCENT_EMERALD_DARK} strokeWidth={2} />
        <text x={20} y={4} className="text-xs font-mono fill-[var(--text-muted)]">Scales</text>
        <line x1={65} y1={0} x2={81} y2={0} stroke={MODULE_COLORS.content} strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={85} y={4} className="text-xs font-mono fill-[var(--text-muted)]">Partial</text>
      </g>
    </svg>
  );
}

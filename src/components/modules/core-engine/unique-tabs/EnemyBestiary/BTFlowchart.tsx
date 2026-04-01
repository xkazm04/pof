'use client';

import { useCallback, useRef } from 'react';
import { STATUS_SUCCESS, STATUS_INFO } from '@/lib/chart-colors';
import type { BtNode, BtEdge } from './data';

interface BTFlowchartProps {
  nodes: BtNode[];
  edges: BtEdge[];
  expandedNodeId: string | null;
  onNodeClick: (id: string) => void;
  accent?: string;
}

const SHAPE_LABELS: Record<BtNode['shape'], string> = {
  diamond: 'Selector',
  rect: 'Sequence',
  rounded: 'Task',
  hexagon: 'Decorator',
};

export function BTFlowchart({ nodes, edges, expandedNodeId, onNodeClick, accent = STATUS_SUCCESS }: BTFlowchartProps) {
  const w = 60, h = 28;
  const nodeRefs = useRef<Record<string, SVGGElement | null>>({});

  const focusNode = useCallback((id: string) => {
    nodeRefs.current[id]?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, nodeId: string) => {
    let targetId: string | null = null;

    switch (e.key) {
      case 'ArrowDown': {
        const children = edges
          .filter(edge => edge.from === nodeId)
          .map(edge => nodes.find(n => n.id === edge.to)!)
          .filter(Boolean)
          .sort((a, b) => a.x - b.x);
        if (children.length > 0) targetId = children[0].id;
        break;
      }
      case 'ArrowUp': {
        const parents = edges
          .filter(edge => edge.to === nodeId)
          .map(edge => nodes.find(n => n.id === edge.from)!)
          .filter(Boolean);
        if (parents.length > 0) targetId = parents[0].id;
        break;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        const parentEdge = edges.find(edge => edge.to === nodeId);
        if (parentEdge) {
          const siblings = edges
            .filter(edge => edge.from === parentEdge.from)
            .map(edge => nodes.find(n => n.id === edge.to)!)
            .filter(Boolean)
            .sort((a, b) => a.x - b.x);
          const idx = siblings.findIndex(n => n.id === nodeId);
          if (e.key === 'ArrowLeft' && idx > 0) targetId = siblings[idx - 1].id;
          if (e.key === 'ArrowRight' && idx < siblings.length - 1) targetId = siblings[idx + 1].id;
        }
        break;
      }
      case 'Enter':
      case ' ':
        e.preventDefault();
        onNodeClick(nodeId);
        return;
      default:
        return;
    }

    if (targetId) {
      e.preventDefault();
      focusNode(targetId);
    }
  }, [edges, nodes, onNodeClick, focusNode]);

  function renderFocusRing(node: BtNode) {
    const pad = 3;
    const ringProps = {
      fill: 'none' as const,
      stroke: STATUS_INFO,
      strokeWidth: 2,
      className: 'pointer-events-none',
    };

    switch (node.shape) {
      case 'diamond':
        return (
          <polygon
            points={`${node.x + w / 2},${node.y - pad} ${node.x + w + pad},${node.y + h / 2} ${node.x + w / 2},${node.y + h + pad} ${node.x - pad},${node.y + h / 2}`}
            {...ringProps}
          />
        );
      case 'rect':
        return (
          <rect x={node.x - pad} y={node.y - pad} width={w + pad * 2} height={h + pad * 2} rx={5} {...ringProps} />
        );
      case 'rounded':
        return (
          <rect x={node.x - pad} y={node.y - pad} width={w + pad * 2} height={h + pad * 2} rx={17} {...ringProps} />
        );
      case 'hexagon':
        return (
          <polygon
            points={`${node.x + 10 - pad},${node.y - pad} ${node.x + w - 10 + pad},${node.y - pad} ${node.x + w + pad},${node.y + h / 2} ${node.x + w - 10 + pad},${node.y + h + pad} ${node.x + 10 - pad},${node.y + h + pad} ${node.x - pad},${node.y + h / 2}`}
            {...ringProps}
          />
        );
    }
  }

  return (
    <svg width={240} height={200} viewBox="0 0 240 180" className="flex-shrink-0" role="tree" aria-label="Behavior Tree flowchart">
      {edges.map(edge => {
        const from = nodes.find(n => n.id === edge.from)!;
        const to = nodes.find(n => n.id === edge.to)!;
        return (
          <line
            key={`${edge.from}-${edge.to}`}
            x1={from.x + 30} y1={from.y + 20} x2={to.x + 30} y2={to.y}
            stroke={edge.active ? accent : 'rgba(255,255,255,0.15)'}
            strokeWidth={edge.active ? 2 : 1}
            strokeDasharray={edge.active ? undefined : '4 4'}
            aria-hidden="true"
          />
        );
      })}
      {nodes.map(node => {
        const isSelected = expandedNodeId === node.id;
        const fillColor = node.active ? `${accent}26` : 'rgba(255,255,255,0.05)';
        const strokeColor = isSelected ? STATUS_INFO : node.active ? accent : 'rgba(255,255,255,0.2)';
        const ariaLabel = `${node.label} — ${SHAPE_LABELS[node.shape]}, ${node.active ? 'active' : 'inactive'}. ${node.details}`;

        return (
          <g
            key={node.id}
            ref={el => { nodeRefs.current[node.id] = el; }}
            tabIndex={0}
            role="treeitem"
            aria-label={ariaLabel}
            aria-selected={isSelected}
            onClick={() => onNodeClick(node.id)}
            onKeyDown={(e) => handleKeyDown(e, node.id)}
            className="cursor-pointer focus-visible:[&>*:last-of-type]:opacity-100"
            style={{ outline: 'none' }}
          >
            {node.shape === 'diamond' && (
              <polygon
                points={`${node.x + w / 2},${node.y} ${node.x + w},${node.y + h / 2} ${node.x + w / 2},${node.y + h} ${node.x},${node.y + h / 2}`}
                fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 2 : 1.5}
              />
            )}
            {node.shape === 'rect' && (
              <rect x={node.x} y={node.y} width={w} height={h} rx={3} fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 2 : 1.5} />
            )}
            {node.shape === 'rounded' && (
              <rect x={node.x} y={node.y} width={w} height={h} rx={14} fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 2 : 1.5} />
            )}
            {node.shape === 'hexagon' && (
              <polygon
                points={`${node.x + 10},${node.y} ${node.x + w - 10},${node.y} ${node.x + w},${node.y + h / 2} ${node.x + w - 10},${node.y + h} ${node.x + 10},${node.y + h} ${node.x},${node.y + h / 2}`}
                fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 2 : 1.5}
              />
            )}
            <text
              x={node.x + w / 2} y={node.y + h / 2 + 1}
              textAnchor="middle" dominantBaseline="central"
              className="text-xs font-mono font-bold pointer-events-none"
              fill={node.active ? accent : 'rgba(255,255,255,0.5)'}
              aria-hidden="true"
            >
              {node.label}
            </text>
            <g className="opacity-0 pointer-events-none" aria-hidden="true">
              {renderFocusRing(node)}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

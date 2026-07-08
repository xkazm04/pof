'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_VIOLET, ACCENT_ORANGE,
} from '@/lib/chart-colors';
import type { AttrCategory, EditorAttribute, EditorEffect, TagRule } from '@/lib/gas-codegen';
import type { AttrRelationship, PinKind, GASGraphNode, GraphWire } from '../types';
import { CAT_COLORS, NODE_W_GRAPH, NODE_H_GRAPH } from '../types';
import { wirePath as svgWirePath } from '@/components/ui/svg/wire-path';

export function useWiringGraphEditor({
  attributes, effects, tagRules, relationships, onSelectItem,
}: {
  attributes: EditorAttribute[];
  effects: EditorEffect[];
  tagRules: TagRule[];
  relationships: AttrRelationship[];
  onSelectItem?: (label: string | null) => void;
}) {
  const prefersReduced = useReducedMotion();
  const [hoveredWire, setHoveredWire] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNodeRaw, setSelectedNodeRaw] = useState<string | null>(null);
  const [dragFromPin, setDragFromPin] = useState<{ nodeId: string; pinId: string } | null>(null);

  // ── Drag-to-reposition state ──
  const [nodeOverrides, setNodeOverrides] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const dragMoved = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const selectedNode = selectedNodeRaw;

  // Build graph nodes and wires from data model
  const { nodes, wires } = useMemo(() => {
    const nodeList: GASGraphNode[] = [];
    const wireList: GraphWire[] = [];

    // ── Attribute nodes (left column, grouped by category) ──
    const catOrder: AttrCategory[] = ['vital', 'primary', 'combat'];
    const filteredAttrs = attributes.filter(a => catOrder.includes(a.category));
    let attrY = 30;
    let prevCat: string | null = null;

    for (const attr of filteredAttrs) {
      if (attr.category !== prevCat) {
        attrY += prevCat ? 16 : 0;
        prevCat = attr.category;
      }
      nodeList.push({
        id: `attr-${attr.id}`,
        label: attr.name,
        type: 'attribute',
        x: 20,
        y: attrY,
        color: CAT_COLORS[attr.category],
        pins: [
          { id: `${attr.id}-out`, kind: 'attr-out', label: '', side: 'right' },
        ],
      });
      attrY += NODE_H_GRAPH + 6;
    }

    // ── Effect nodes (center column) ──
    let effY = 30;
    for (const eff of effects) {
      const inPins = eff.modifiers.map((m, i) => ({
        id: `${eff.id}-in-${i}`,
        kind: 'effect-in' as PinKind,
        label: m.attribute,
        side: 'left' as const,
      }));
      const outPins = eff.grantedTags.length > 0
        ? [{ id: `${eff.id}-out-tags`, kind: 'effect-out' as PinKind, label: 'tags', side: 'right' as const }]
        : [];

      const nodeH = Math.max(NODE_H_GRAPH, (Math.max(inPins.length, outPins.length) + 1) * 14 + 10);
      nodeList.push({
        id: `eff-${eff.id}`,
        label: eff.name,
        type: 'effect',
        x: 240,
        y: effY,
        color: eff.color,
        pins: [...inPins, ...outPins],
      });
      effY += nodeH + 16;
    }

    // ── Tag rule nodes (right column) ──
    let tagY = 30;
    for (const rule of tagRules) {
      nodeList.push({
        id: `tag-${rule.id}`,
        label: `${rule.sourceTag} ${rule.type} ${rule.targetTag}`,
        type: 'tag-rule',
        x: 460,
        y: tagY,
        color: rule.type === 'blocks' ? STATUS_ERROR : rule.type === 'cancels' ? ACCENT_ORANGE : STATUS_SUCCESS,
        pins: [
          { id: `${rule.id}-in`, kind: 'tag-in', label: '', side: 'left' },
        ],
      });
      tagY += NODE_H_GRAPH + 10;
    }

    // ── Wires: attribute → effect modifiers ──
    for (const eff of effects) {
      const effNode = nodeList.find(n => n.id === `eff-${eff.id}`);
      if (!effNode) continue;
      for (let i = 0; i < eff.modifiers.length; i++) {
        const mod = eff.modifiers[i];
        const sourceAttr = filteredAttrs.find(a => a.name === mod.attribute);
        if (sourceAttr) {
          wireList.push({
            id: `w-attr-eff-${sourceAttr.id}-${eff.id}-${i}`,
            fromNode: `attr-${sourceAttr.id}`,
            fromPin: `${sourceAttr.id}-out`,
            toNode: `eff-${eff.id}`,
            toPin: `${eff.id}-in-${i}`,
            color: eff.color,
            animated: true,
          });
        }
      }
    }

    // ── Wires: effect granted tags → tag rules ──
    for (const eff of effects) {
      if (eff.grantedTags.length === 0) continue;
      for (const grantedTag of eff.grantedTags) {
        for (const rule of tagRules) {
          const ruleBase = rule.sourceTag.replace('.*', '');
          if (grantedTag.startsWith(ruleBase)) {
            wireList.push({
              id: `w-eff-tag-${eff.id}-${rule.id}`,
              fromNode: `eff-${eff.id}`,
              fromPin: `${eff.id}-out-tags`,
              toNode: `tag-${rule.id}`,
              toPin: `${rule.id}-in`,
              color: rule.type === 'blocks' ? STATUS_ERROR : rule.type === 'cancels' ? ACCENT_ORANGE : STATUS_SUCCESS,
              animated: false,
            });
          }
        }
      }
    }

    // ── Wires: attribute relationships ──
    for (const rel of relationships) {
      const srcNode = nodeList.find(n => n.id === `attr-${rel.sourceId}`);
      const tgtNode = nodeList.find(n => n.id === `attr-${rel.targetId}`);
      if (srcNode && tgtNode) {
        wireList.push({
          id: `w-rel-${rel.id}`,
          fromNode: srcNode.id,
          fromPin: `${rel.sourceId}-out`,
          toNode: tgtNode.id,
          toPin: `${rel.targetId}-out`,
          color: rel.type === 'scale' ? ACCENT_VIOLET : rel.type === 'clamp' ? STATUS_WARNING : STATUS_SUCCESS,
          animated: rel.type === 'regen',
        });
      }
    }

    return { nodes: nodeList, wires: wireList };
  }, [attributes, effects, tagRules, relationships]);

  const setSelectedNode = useCallback((idOrFn: string | null | ((prev: string | null) => string | null)) => {
    setSelectedNodeRaw(prev => {
      const next = typeof idOrFn === 'function' ? idOrFn(prev) : idOrFn;
      const node = next ? nodes.find(n => n.id === next) : null;
      onSelectItem?.(node ? node.label : null);
      return next;
    });
  }, [nodes, onSelectItem]);

  // Resolve node position (apply override if present)
  const resolvePos = useCallback((node: GASGraphNode) => {
    const ov = nodeOverrides.get(node.id);
    return ov ? { x: ov.x, y: ov.y } : { x: node.x, y: node.y };
  }, [nodeOverrides]);

  // Compute pin positions (uses overrides)
  const getPinPos = useCallback((node: GASGraphNode, pinId: string): { x: number; y: number } => {
    const { x: nx, y: ny } = resolvePos(node);
    const pin = node.pins.find(p => p.id === pinId);
    if (!pin) return { x: nx, y: ny };
    const pinIndex = node.pins.filter(p => p.side === pin.side).indexOf(pin);
    const sideCount = node.pins.filter(p => p.side === pin.side).length;
    const nodeH = Math.max(NODE_H_GRAPH, (sideCount + 1) * 14 + 10);
    const pinY = ny + 16 + pinIndex * 14;
    const pinX = pin.side === 'left' ? nx : nx + NODE_W_GRAPH;
    return { x: pinX, y: Math.min(pinY, ny + nodeH - 6) };
  }, [resolvePos]);

  // ── Drag handlers ──
  const getSvgPoint = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: e.clientX, y: e.clientY };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: e.clientX, y: e.clientY };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handleNodeDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const { x: nx, y: ny } = nodeOverrides.get(nodeId) ?? { x: node.x, y: node.y };
    const svgPt = getSvgPoint(e);
    dragStart.current = { mx: svgPt.x, my: svgPt.y, ox: nx, oy: ny };
    dragMoved.current = false;
    setDraggingNodeId(nodeId);
  }, [nodes, nodeOverrides, getSvgPoint]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNodeId || !dragStart.current) return;
    const svgPt = getSvgPoint(e);
    const dx = svgPt.x - dragStart.current.mx;
    const dy = svgPt.y - dragStart.current.my;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved.current = true;
    setNodeOverrides(prev => {
      const next = new Map(prev);
      next.set(draggingNodeId, { x: dragStart.current!.ox + dx, y: dragStart.current!.oy + dy });
      return next;
    });
  }, [draggingNodeId, getSvgPoint]);

  const handleSvgMouseUp = useCallback(() => {
    setDraggingNodeId(null);
    dragStart.current = null;
  }, []);

  // Find connected wires for a node
  const connectedWires = useMemo(() => {
    if (!hoveredNode && !selectedNode) return new Set<string>();
    const target = selectedNode ?? hoveredNode;
    return new Set(wires.filter(w => w.fromNode === target || w.toNode === target).map(w => w.id));
  }, [hoveredNode, selectedNode, wires]);

  // SVG dimensions
  const svgW = 640;
  const maxY = Math.max(...nodes.map(n => {
    const { y } = resolvePos(n);
    const sideCount = Math.max(n.pins.filter(p => p.side === 'left').length, n.pins.filter(p => p.side === 'right').length);
    const nodeH = Math.max(NODE_H_GRAPH, (sideCount + 1) * 14 + 10);
    return y + nodeH + 20;
  }), 300);

  // Wire path (bezier curve) — see @/components/ui/svg/wire-path
  const wirePath = useCallback(
    (fromPos: { x: number; y: number }, toPos: { x: number; y: number }) => svgWirePath(fromPos, toPos),
    [],
  );

  // Detail text for selected node
  const selectedDetail = useMemo(() => {
    if (!selectedNode) return null;
    const node = nodes.find(n => n.id === selectedNode);
    if (!node) return null;
    const inWires = wires.filter(w => w.toNode === selectedNode);
    const outWires = wires.filter(w => w.fromNode === selectedNode);
    return { node, inWires, outWires };
  }, [selectedNode, nodes, wires]);

  return {
    prefersReduced,
    hoveredWire, setHoveredWire,
    hoveredNode, setHoveredNode,
    selectedNode, setSelectedNode,
    dragFromPin, setDragFromPin,
    nodeOverrides, setNodeOverrides,
    draggingNodeId,
    dragMoved,
    svgRef,
    nodes, wires,
    resolvePos, getPinPos,
    handleNodeDragStart, handleSvgMouseMove, handleSvgMouseUp,
    connectedWires,
    svgW, maxY,
    wirePath,
    selectedDetail,
  };
}

'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { Circle, Zap, Tag, Cable } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import type { AttrCategory, EditorAttribute, EditorEffect, TagRule } from '@/lib/gas-codegen';
import type { AttrRelationship, PinKind, GASGraphNode, GraphWire } from './types';
import { CAT_COLORS, NODE_W_GRAPH, NODE_H_GRAPH, PIN_R } from './data';

export function WiringGraphEditor({
  attributes, effects, tagRules, relationships, onSelectItem,
}: {
  attributes: EditorAttribute[];
  effects: EditorEffect[];
  tagRules: TagRule[];
  relationships: AttrRelationship[];
  onSelectItem?: (label: string | null) => void;
}) {
  const [hoveredWire, setHoveredWire] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNodeRaw, setSelectedNodeRaw] = useState<string | null>(null);
  const [dragFromPin, setDragFromPin] = useState<{ nodeId: string; pinId: string } | null>(null);
  const [nodeOverrides, setNodeOverrides] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const dragMoved = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const selectedNode = selectedNodeRaw;

  const { nodes, wires } = useMemo(() => {
    const nodeList: GASGraphNode[] = [];
    const wireList: GraphWire[] = [];
    const catOrder: AttrCategory[] = ['vital', 'primary', 'combat'];
    const filteredAttrs = attributes.filter(a => catOrder.includes(a.category));
    let attrY = 30; let prevCat: string | null = null;
    for (const attr of filteredAttrs) {
      if (attr.category !== prevCat) { attrY += prevCat ? 16 : 0; prevCat = attr.category; }
      nodeList.push({ id: `attr-${attr.id}`, label: attr.name, type: 'attribute', x: 20, y: attrY, color: CAT_COLORS[attr.category], pins: [{ id: `${attr.id}-out`, kind: 'attr-out', label: '', side: 'right' }] });
      attrY += NODE_H_GRAPH + 6;
    }
    let effY = 30;
    for (const eff of effects) {
      const inPins = eff.modifiers.map((m, i) => ({ id: `${eff.id}-in-${i}`, kind: 'effect-in' as PinKind, label: m.attribute, side: 'left' as const }));
      const outPins = eff.grantedTags.length > 0 ? [{ id: `${eff.id}-out-tags`, kind: 'effect-out' as PinKind, label: 'tags', side: 'right' as const }] : [];
      const nodeH = Math.max(NODE_H_GRAPH, (Math.max(inPins.length, outPins.length) + 1) * 14 + 10);
      nodeList.push({ id: `eff-${eff.id}`, label: eff.name, type: 'effect', x: 240, y: effY, color: eff.color, pins: [...inPins, ...outPins] });
      effY += nodeH + 16;
    }
    let tagY = 30;
    for (const rule of tagRules) {
      nodeList.push({ id: `tag-${rule.id}`, label: `${rule.sourceTag} ${rule.type} ${rule.targetTag}`, type: 'tag-rule', x: 460, y: tagY, color: rule.type === 'blocks' ? STATUS_ERROR : rule.type === 'cancels' ? ACCENT_ORANGE : STATUS_SUCCESS, pins: [{ id: `${rule.id}-in`, kind: 'tag-in', label: '', side: 'left' }] });
      tagY += NODE_H_GRAPH + 10;
    }
    for (const eff of effects) { for (let i = 0; i < eff.modifiers.length; i++) { const mod = eff.modifiers[i]; const sourceAttr = filteredAttrs.find(a => a.name === mod.attribute); if (sourceAttr) wireList.push({ id: `w-attr-eff-${sourceAttr.id}-${eff.id}-${i}`, fromNode: `attr-${sourceAttr.id}`, fromPin: `${sourceAttr.id}-out`, toNode: `eff-${eff.id}`, toPin: `${eff.id}-in-${i}`, color: eff.color, animated: true }); } }
    for (const eff of effects) { if (eff.grantedTags.length === 0) continue; for (const grantedTag of eff.grantedTags) { for (const rule of tagRules) { const ruleBase = rule.sourceTag.replace('.*', ''); if (grantedTag.startsWith(ruleBase)) wireList.push({ id: `w-eff-tag-${eff.id}-${rule.id}`, fromNode: `eff-${eff.id}`, fromPin: `${eff.id}-out-tags`, toNode: `tag-${rule.id}`, toPin: `${rule.id}-in`, color: rule.type === 'blocks' ? STATUS_ERROR : rule.type === 'cancels' ? ACCENT_ORANGE : STATUS_SUCCESS, animated: false }); } } }
    for (const rel of relationships) { const srcNode = nodeList.find(n => n.id === `attr-${rel.sourceId}`); const tgtNode = nodeList.find(n => n.id === `attr-${rel.targetId}`); if (srcNode && tgtNode) wireList.push({ id: `w-rel-${rel.id}`, fromNode: srcNode.id, fromPin: `${rel.sourceId}-out`, toNode: tgtNode.id, toPin: `${rel.targetId}-out`, color: rel.type === 'scale' ? ACCENT_VIOLET : rel.type === 'clamp' ? STATUS_WARNING : STATUS_SUCCESS, animated: rel.type === 'regen' }); }
    return { nodes: nodeList, wires: wireList };
  }, [attributes, effects, tagRules, relationships]);

  const setSelectedNode = useCallback((idOrFn: string | null | ((prev: string | null) => string | null)) => {
    setSelectedNodeRaw(prev => { const next = typeof idOrFn === 'function' ? idOrFn(prev) : idOrFn; const node = next ? nodes.find(n => n.id === next) : null; onSelectItem?.(node ? node.label : null); return next; });
  }, [nodes, onSelectItem]);

  const resolvePos = useCallback((node: GASGraphNode) => { const ov = nodeOverrides.get(node.id); return ov ? { x: ov.x, y: ov.y } : { x: node.x, y: node.y }; }, [nodeOverrides]);
  const getPinPos = useCallback((node: GASGraphNode, pinId: string): { x: number; y: number } => {
    const { x: nx, y: ny } = resolvePos(node); const pin = node.pins.find(p => p.id === pinId); if (!pin) return { x: nx, y: ny };
    const pinIndex = node.pins.filter(p => p.side === pin.side).indexOf(pin); const sideCount = node.pins.filter(p => p.side === pin.side).length;
    const nodeH = Math.max(NODE_H_GRAPH, (sideCount + 1) * 14 + 10); const pinY = ny + 16 + pinIndex * 14; const pinX = pin.side === 'left' ? nx : nx + NODE_W_GRAPH;
    return { x: pinX, y: Math.min(pinY, ny + nodeH - 6) };
  }, [resolvePos]);

  const getSvgPoint = useCallback((e: React.MouseEvent) => { const svg = svgRef.current; if (!svg) return { x: e.clientX, y: e.clientY }; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const ctm = svg.getScreenCTM(); if (!ctm) return { x: e.clientX, y: e.clientY }; const svgPt = pt.matrixTransform(ctm.inverse()); return { x: svgPt.x, y: svgPt.y }; }, []);
  const handleNodeDragStart = useCallback((e: React.MouseEvent, nodeId: string) => { e.stopPropagation(); e.preventDefault(); const node = nodes.find(n => n.id === nodeId); if (!node) return; const { x: nx, y: ny } = nodeOverrides.get(nodeId) ?? { x: node.x, y: node.y }; const svgPt = getSvgPoint(e); dragStart.current = { mx: svgPt.x, my: svgPt.y, ox: nx, oy: ny }; dragMoved.current = false; setDraggingNodeId(nodeId); }, [nodes, nodeOverrides, getSvgPoint]);
  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => { if (!draggingNodeId || !dragStart.current) return; const svgPt = getSvgPoint(e); const dx = svgPt.x - dragStart.current.mx; const dy = svgPt.y - dragStart.current.my; if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved.current = true; setNodeOverrides(prev => { const next = new Map(prev); next.set(draggingNodeId, { x: dragStart.current!.ox + dx, y: dragStart.current!.oy + dy }); return next; }); }, [draggingNodeId, getSvgPoint]);
  const handleSvgMouseUp = useCallback(() => { setDraggingNodeId(null); dragStart.current = null; }, []);
  const connectedWires = useMemo(() => { if (!hoveredNode && !selectedNode) return new Set<string>(); const target = selectedNode ?? hoveredNode; return new Set(wires.filter(w => w.fromNode === target || w.toNode === target).map(w => w.id)); }, [hoveredNode, selectedNode, wires]);
  const svgW = 640;
  const maxY = Math.max(...nodes.map(n => { const { y } = resolvePos(n); const sc = Math.max(n.pins.filter(p => p.side === 'left').length, n.pins.filter(p => p.side === 'right').length); return y + Math.max(NODE_H_GRAPH, (sc + 1) * 14 + 10) + 20; }), 300);
  const wirePath = useCallback((fromPos: { x: number; y: number }, toPos: { x: number; y: number }) => { const cpOffset = Math.min(80, Math.abs(toPos.x - fromPos.x) * 0.4); return `M ${fromPos.x} ${fromPos.y} C ${fromPos.x + cpOffset} ${fromPos.y}, ${toPos.x - cpOffset} ${toPos.y}, ${toPos.x} ${toPos.y}`; }, []);
  const selectedDetail = useMemo(() => { if (!selectedNode) return null; const node = nodes.find(n => n.id === selectedNode); if (!node) return null; return { node, inWires: wires.filter(w => w.toNode === selectedNode), outWires: wires.filter(w => w.fromNode === selectedNode) }; }, [selectedNode, nodes, wires]);

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Visual wiring graph of the GAS data pipeline. Drag nodes to reposition. Click to inspect connections.</div>
      <div className="flex items-center justify-between px-2 text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted">
        <span style={{ width: NODE_W_GRAPH, color: ACCENT_VIOLET, textShadow: `0 0 12px ${ACCENT_VIOLET}40` }}>Attributes</span>
        <span style={{ color: STATUS_WARNING, textShadow: `0 0 12px ${STATUS_WARNING}40` }}>Effects</span>
        <span style={{ color: STATUS_ERROR, textShadow: `0 0 12px ${STATUS_ERROR}40` }}>Tag Rules</span>
      </div>
      <div className="relative overflow-x-auto custom-scrollbar rounded-lg border bg-surface-deep overflow-hidden" style={{ borderColor: `${ACCENT_VIOLET}18` }}>
        <svg ref={svgRef} width={svgW} height={maxY} viewBox={`0 0 ${svgW} ${maxY}`} className="overflow-visible" style={draggingNodeId ? { userSelect: 'none' } : undefined} onMouseMove={handleSvgMouseMove} onMouseUp={handleSvgMouseUp} onMouseLeave={handleSvgMouseUp}>
          <defs><marker id="gas-flow-arrow" viewBox="0 0 6 4" refX="6" refY="2" markerWidth="5" markerHeight="4" orient="auto"><path d="M0,0 L6,2 L0,4" fill="rgba(255,255,255,0.5)" /></marker></defs>
          <pattern id="gas-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" /></pattern>
          <rect width="100%" height="100%" fill="url(#gas-grid)" />
          <line x1={190} y1={0} x2={190} y2={maxY} stroke="rgba(255,255,255,0.04)" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={420} y1={0} x2={420} y2={maxY} stroke="rgba(255,255,255,0.04)" strokeWidth={1} strokeDasharray="4 4" />
          {wires.map((wire) => { const fromNode = nodes.find(n => n.id === wire.fromNode); const toNode = nodes.find(n => n.id === wire.toNode); if (!fromNode || !toNode) return null; const fromPos = getPinPos(fromNode, wire.fromPin); const toPos = getPinPos(toNode, wire.toPin); const path = wirePath(fromPos, toPos); const isHighlighted = hoveredWire === wire.id || connectedWires.has(wire.id); const opacity = (hoveredNode || selectedNode) ? (isHighlighted ? 0.9 : 0.12) : 0.5; return (<g key={wire.id}><path d={path} fill="none" stroke="transparent" strokeWidth={10} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredWire(wire.id)} onMouseLeave={() => setHoveredWire(null)} />{isHighlighted && <path d={path} fill="none" stroke={wire.color} strokeWidth={4} opacity={0.25} style={{ filter: 'blur(3px)' }} className="pointer-events-none" />}<path d={path} fill="none" stroke={wire.color} strokeWidth={isHighlighted ? 2 : 1.2} opacity={opacity} strokeDasharray={wire.animated ? '6 4' : undefined} markerEnd="url(#gas-flow-arrow)" className="pointer-events-none transition-opacity duration-200">{wire.animated && <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.8s" repeatCount="indefinite" />}</path><circle r={isHighlighted ? 3 : 2} fill={wire.color} opacity={isHighlighted ? 0.9 : 0.5} className="pointer-events-none"><animateMotion dur={wire.animated ? '1.5s' : '3s'} repeatCount="indefinite" path={path} /></circle></g>); })}
          {dragFromPin && <line x1={0} y1={0} x2={0} y2={0} stroke={ACCENT_CYAN} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} className="pointer-events-none" />}
          {nodes.map((node) => { const { x: nx, y: ny } = resolvePos(node); const isDragging = draggingNodeId === node.id; const isHovered = hoveredNode === node.id; const isSelected = selectedNode === node.id; const hasConnections = wires.some(w => w.fromNode === node.id || w.toNode === node.id); const sideCount = (side: 'left' | 'right') => node.pins.filter(p => p.side === side).length; const nodeH = Math.max(NODE_H_GRAPH, (Math.max(sideCount('left'), sideCount('right')) + 1) * 14 + 10); const dimmed = (hoveredNode || selectedNode) && !isHovered && !isSelected && !connectedWires.has(wires.find(w => w.fromNode === node.id || w.toNode === node.id)?.id ?? ''); const nodeIsConnected = wires.some(w => (w.fromNode === node.id || w.toNode === node.id) && connectedWires.has(w.id)); const effectiveOpacity = dimmed && !nodeIsConnected ? 0.25 : 1; return (<g key={node.id} className={isDragging ? 'cursor-grabbing' : 'cursor-grab'} onMouseEnter={() => { if (!draggingNodeId) setHoveredNode(node.id); }} onMouseLeave={() => { if (!draggingNodeId) setHoveredNode(null); }} onClick={() => { if (!dragMoved.current) setSelectedNode(prev => prev === node.id ? null : node.id); }} onMouseDown={(e) => { const target = e.target as SVGElement; if (target.tagName === 'circle') return; handleNodeDragStart(e, node.id); }} opacity={effectiveOpacity} style={{ transition: isDragging ? 'none' : 'opacity 0.2s' }}><rect x={nx} y={ny} width={NODE_W_GRAPH} height={nodeH} rx={6} fill={isDragging ? `${node.color}28` : isSelected ? `${node.color}20` : isHovered ? `${node.color}12` : `${node.color}08`} stroke={isDragging ? node.color : isSelected ? node.color : isHovered ? `${node.color}80` : `${node.color}40`} strokeWidth={isDragging ? 2 : isSelected ? 1.5 : 1} /><rect x={nx} y={ny} width={4} height={nodeH} rx={2} fill={node.color} opacity={isSelected || isDragging ? 0.8 : 0.5} /><text x={nx + 12} y={ny + 12} fill={isSelected || isHovered || isDragging ? node.color : 'rgba(255,255,255,0.8)'} fontSize={node.type === 'tag-rule' ? 7 : 8.5} fontFamily="monospace" fontWeight="bold" className="pointer-events-none">{node.label.length > 18 ? node.label.slice(0, 17) + '\u2026' : node.label}</text><text x={nx + NODE_W_GRAPH - 4} y={ny + 11} fill={node.color} fontSize={6} fontFamily="monospace" textAnchor="end" opacity={0.5} className="pointer-events-none">{node.type === 'attribute' ? 'ATTR' : node.type === 'effect' ? 'GE' : 'TAG'}</text>{node.pins.map((pin) => { const pos = getPinPos(node, pin.id); const isConnected = hasConnections && wires.some(w => (w.fromNode === node.id && w.fromPin === pin.id) || (w.toNode === node.id && w.toPin === pin.id)); const wireColor = wires.find(w => (w.fromNode === node.id && w.fromPin === pin.id) || (w.toNode === node.id && w.toPin === pin.id))?.color ?? node.color; return (<g key={pin.id}><circle cx={pos.x} cy={pos.y} r={PIN_R} fill={isConnected ? wireColor : 'rgba(255,255,255,0.1)'} stroke={isConnected ? wireColor : 'rgba(255,255,255,0.3)'} strokeWidth={1} className="pointer-events-auto" style={{ cursor: 'crosshair' }} onMouseDown={(e) => { e.stopPropagation(); setDragFromPin({ nodeId: node.id, pinId: pin.id }); }} onMouseUp={(e) => { e.stopPropagation(); setDragFromPin(null); }} />{pin.label && <text x={pin.side === 'left' ? pos.x + 6 : pos.x - 6} y={pos.y + 3} fill="rgba(255,255,255,0.4)" fontSize={6} fontFamily="monospace" textAnchor={pin.side === 'left' ? 'start' : 'end'} className="pointer-events-none">{pin.label.length > 12 ? pin.label.slice(0, 11) + '\u2026' : pin.label}</text>}</g>); })}{(isSelected || isDragging) && <rect x={nx - 2} y={ny - 2} width={NODE_W_GRAPH + 4} height={nodeH + 4} rx={8} fill="none" stroke={node.color} strokeWidth={1} opacity={0.3} style={{ filter: 'blur(3px)' }} className="pointer-events-none" />}</g>); })}
        </svg>
      </div>
      <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted px-1">
        <span className="flex items-center gap-1"><Circle className="w-2.5 h-2.5" style={{ color: ACCENT_VIOLET }} />{nodes.filter(n => n.type === 'attribute').length} attributes</span>
        <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5" style={{ color: STATUS_WARNING }} />{nodes.filter(n => n.type === 'effect').length} effects</span>
        <span className="flex items-center gap-1"><Tag className="w-2.5 h-2.5" style={{ color: STATUS_ERROR }} />{nodes.filter(n => n.type === 'tag-rule').length} rules</span>
        <span className="flex items-center gap-1"><Cable className="w-2.5 h-2.5" style={{ color: ACCENT_EMERALD }} />{wires.length} wires</span>
        {nodeOverrides.size > 0 && <button onClick={() => setNodeOverrides(new Map())} className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/40 text-text-muted hover:text-text hover:border-border/60 transition-colors">Reset Layout</button>}
      </div>
      <AnimatePresence>
        {selectedDetail && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-2.5 rounded-lg border space-y-1.5" style={{ borderColor: `${selectedDetail.node.color}25`, backgroundColor: `${selectedDetail.node.color}08` }}>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedDetail.node.color, boxShadow: `0 0 6px ${selectedDetail.node.color}` }} /><span className="text-xs font-mono font-bold" style={{ color: selectedDetail.node.color, textShadow: `0 0 12px ${selectedDetail.node.color}40` }}>{selectedDetail.node.label}</span><span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted">{selectedDetail.node.type}</span></div>
              {selectedDetail.inWires.length > 0 && <div className="text-2xs text-text-muted"><span className="font-bold">Inputs:</span> {selectedDetail.inWires.map(w => nodes.find(n => n.id === w.fromNode)?.label).filter(Boolean).join(', ')}</div>}
              {selectedDetail.outWires.length > 0 && <div className="text-2xs text-text-muted"><span className="font-bold">Outputs:</span> {selectedDetail.outWires.map(w => nodes.find(n => n.id === w.toNode)?.label).filter(Boolean).join(', ')}</div>}
              {selectedDetail.inWires.length === 0 && selectedDetail.outWires.length === 0 && <div className="text-2xs text-text-muted italic">No connections -- this node is isolated</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

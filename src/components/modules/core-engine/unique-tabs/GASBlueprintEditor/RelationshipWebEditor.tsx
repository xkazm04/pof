'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Trash2, ArrowRight } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING,
  ACCENT_CYAN, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import type { AttrCategory, EditorAttribute } from '@/lib/gas-codegen';
import type { AttrRelationship } from './types';
import { CAT_COLORS } from './data';

export function RelationshipWebEditor({
  attributes, relationships, onChange,
}: {
  attributes: EditorAttribute[];
  relationships: AttrRelationship[];
  onChange: (rels: AttrRelationship[]) => void;
}) {
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragMouse, setDragMouse] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!dragSource) return;
    const toSvgCoords = (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const scaleX = svg.viewBox.baseVal.width / rect.width;
      const scaleY = svg.viewBox.baseVal.height / rect.height;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };
    const onMove = (e: MouseEvent) => {
      const pt = toSvgCoords(e.clientX, e.clientY);
      if (pt) setDragMouse(pt);
    };
    const onUp = () => { setDragSource(null); setDragMouse(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragSource]);

  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    const byCat = new Map<AttrCategory, EditorAttribute[]>();
    for (const a of attributes) { const arr = byCat.get(a.category) || []; arr.push(a); byCat.set(a.category, arr); }
    const catOrder: AttrCategory[] = ['meta', 'vital', 'primary', 'combat', 'progression'];
    let col = 0;
    for (const cat of catOrder) {
      const items = byCat.get(cat) || [];
      for (let i = 0; i < items.length; i++) { positions.set(items[i].id, { x: 30 + col * 80, y: 25 + i * 32 }); }
      col++;
    }
    return positions;
  }, [attributes]);

  const svgW = 430;
  const svgH = Math.max(200, (Math.max(...[...nodePositions.values()].map(p => p.y)) || 100) + 50);
  const relColors: Record<AttrRelationship['type'], string> = { scale: ACCENT_VIOLET, clamp: STATUS_WARNING, regen: STATUS_SUCCESS };

  const handleDragStart = useCallback((attrId: string) => { setDragSource(attrId); }, []);

  const handleDrop = useCallback((targetId: string) => {
    if (!dragSource || dragSource === targetId) { setDragSource(null); return; }
    const newRel: AttrRelationship = {
      id: `r-${Date.now()}`, sourceId: dragSource, targetId, type: 'scale',
      formula: `${attributes.find(a => a.id === targetId)?.name} += ${attributes.find(a => a.id === dragSource)?.name} * 1.0`,
    };
    onChange([...relationships, newRel]);
    setDragSource(null);
  }, [dragSource, attributes, relationships, onChange]);

  const removeRel = useCallback((relId: string) => { onChange(relationships.filter(r => r.id !== relId)); }, [relationships, onChange]);

  return (
    <div className="space-y-2">
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Drag from one attribute to another to create a dependency. Click an edge to remove.</div>
      <div className="relative overflow-x-auto custom-scrollbar">
        <svg ref={svgRef} width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
          {relationships.map((rel) => {
            const from = nodePositions.get(rel.sourceId);
            const to = nodePositions.get(rel.targetId);
            if (!from || !to) return null;
            return (
              <g key={rel.id} className="cursor-pointer" onClick={() => removeRel(rel.id)}>
                <line x1={from.x + 34} y1={from.y + 10} x2={to.x} y2={to.y + 10}
                  stroke={relColors[rel.type]} strokeWidth={1.5} strokeDasharray={rel.type === 'clamp' ? '4 3' : undefined} opacity={0.6} markerEnd="url(#gas-arrow)" />
                {(rel.type === 'scale' || rel.type === 'regen') && (
                  <circle r={2} fill={relColors[rel.type]} opacity={0.6} className="pointer-events-none">
                    <animateMotion dur={rel.type === 'regen' ? '1.5s' : '2.5s'} repeatCount="indefinite" path={`M ${from.x + 34},${from.y + 10} L ${to.x},${to.y + 10}`} />
                  </circle>
                )}
                <text x={(from.x + 34 + to.x) / 2} y={(from.y + to.y) / 2 + 6} fill={relColors[rel.type]} fontSize={7} fontFamily="monospace" textAnchor="middle" className="pointer-events-none">{rel.type}</text>
              </g>
            );
          })}
          <defs><marker id="gas-arrow" viewBox="0 0 6 4" refX="6" refY="2" markerWidth="6" markerHeight="4" orient="auto"><path d="M0,0 L6,2 L0,4" fill="rgba(255,255,255,0.4)" /></marker></defs>
          {attributes.map((attr) => {
            const pos = nodePositions.get(attr.id);
            if (!pos) return null;
            const color = CAT_COLORS[attr.category];
            const isDragTarget = dragSource && dragSource !== attr.id;
            return (
              <g key={attr.id} className="cursor-grab active:cursor-grabbing" onMouseDown={() => handleDragStart(attr.id)} onMouseUp={() => isDragTarget && handleDrop(attr.id)}>
                <rect x={pos.x - 2} y={pos.y} width={70} height={20} rx={4} fill={isDragTarget ? `${color}30` : `${color}15`} stroke={isDragTarget ? color : `${color}50`} strokeWidth={isDragTarget ? 1.5 : 0.8} />
                <text x={pos.x + 33} y={pos.y + 13} fill={color} fontSize={8} fontFamily="monospace" textAnchor="middle">{attr.name.length > 10 ? attr.name.slice(0, 9) + '\u2026' : attr.name}</text>
              </g>
            );
          })}
          {(['meta', 'vital', 'primary', 'combat', 'progression'] as AttrCategory[]).map((cat, i) => (
            <text key={cat} x={30 + i * 80 + 33} y={14} fill={CAT_COLORS[cat]} fontSize={8} fontFamily="monospace" textAnchor="middle" fontWeight="bold" opacity={0.7}>{cat.toUpperCase()}</text>
          ))}
          {dragSource && dragMouse && (() => {
            const from = nodePositions.get(dragSource);
            if (!from) return null;
            return <line x1={from.x + 34} y1={from.y + 10} x2={dragMouse.x} y2={dragMouse.y} stroke={ACCENT_CYAN} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} className="pointer-events-none" />;
          })()}
        </svg>
      </div>
      <div className="space-y-1">
        {relationships.map((rel) => (
          <div key={rel.id} className="flex items-center gap-2 px-2 py-1 rounded text-2xs font-mono" style={{ backgroundColor: `${relColors[rel.type]}08`, border: `1px solid ${relColors[rel.type]}20` }}>
            <span style={{ color: relColors[rel.type] }}>{rel.type}</span>
            <span className="text-text-muted">{attributes.find(a => a.id === rel.sourceId)?.name}</span>
            <ArrowRight className="w-2.5 h-2.5 text-text-muted" />
            <span className="text-text">{attributes.find(a => a.id === rel.targetId)?.name}</span>
            <span className="text-text-muted ml-auto truncate max-w-[150px]">{rel.formula}</span>
            <button onClick={() => removeRel(rel.id)} className="text-text-muted hover:text-red-400 ml-1 flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

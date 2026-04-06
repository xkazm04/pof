'use client';

import { useState, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OPACITY_20, GLOW_MD, withOpacity } from '@/lib/chart-colors';
import { ACCENT, TREEMAP_DATA } from '../data';
import { computeTreemapLayout } from '../math';
import { BlueprintPanel, SectionHeader } from '../design';

/* Pre-compute name→data map to avoid repeated .find() in render */
const TREEMAP_MAP = new Map(TREEMAP_DATA.map(d => [d.name, d]));

export function DropTreemap() {
  const [treemapHover, setTreemapHover] = useState<string | null>(null);
  const [treemapDrill, setTreemapDrill] = useState<string | null>(null);
  const treemapLayout = useMemo(() => computeTreemapLayout(TREEMAP_DATA, 260, 120), []);

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <SectionHeader icon={BarChart3} label="Drop Probability Treemap" color={ACCENT} />
      <div className="min-h-[200px] bg-surface-deep/30 rounded-lg p-2">
        <svg width={260} height={120} viewBox="0 0 260 120" className="w-full max-w-[260px]">
          {treemapLayout.map((rect) => (
            <g
              key={rect.item.name}
              onMouseEnter={() => setTreemapHover(rect.item.name)}
              onMouseLeave={() => setTreemapHover(null)}
              onClick={() => setTreemapDrill((prev) => prev === rect.item.name ? null : rect.item.name)}
              className="cursor-pointer"
            >
              <rect
                x={rect.x} y={rect.y} width={Math.max(rect.w, 0)} height={Math.max(rect.h, 0)}
                fill={rect.item.color}
                opacity={treemapHover === rect.item.name ? 0.9 : 0.65}
                rx={2}
                stroke="rgba(0,0,0,0.3)" strokeWidth={1}
                style={{ filter: treemapHover === rect.item.name ? `drop-shadow(${GLOW_MD} ${rect.item.color})` : 'none', transition: 'filter 0.2s ease' }}
              />
              {rect.w > 30 && rect.h > 20 && (
                <text
                  x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 - 4}
                  textAnchor="middle" dominantBaseline="central"
                  className="text-xs font-mono font-bold fill-white pointer-events-none"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
                  {rect.item.name}
                </text>
              )}
              {rect.w > 30 && rect.h > 34 && (
                <text
                  x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 + 10}
                  textAnchor="middle" dominantBaseline="central"
                  className="text-xs font-mono fill-white/70 pointer-events-none"
                >
                  {rect.item.probability}%
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      {treemapHover && (
        <div className="mt-2 text-2xs text-text-muted font-mono">
          Hover: <span className="text-text">{treemapHover}</span> - {TREEMAP_MAP.get(treemapHover)?.probability}% drop rate
        </div>
      )}
      <AnimatePresence>
        {treemapDrill && (() => {
          const drillData = TREEMAP_MAP.get(treemapDrill);
          if (!drillData) return null;
          return (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 p-2 rounded border border-border/40 bg-surface/50">
                <div className="text-2xs font-semibold text-text mb-1">
                  {treemapDrill} Affix Outcomes:
                </div>
                <div className="flex flex-wrap gap-1">
                  {drillData.affixes.map((affix) => (
                    <span key={affix} className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: withOpacity(drillData.color, OPACITY_20), color: drillData.color }}>
                      {affix}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </BlueprintPanel>
  );
}

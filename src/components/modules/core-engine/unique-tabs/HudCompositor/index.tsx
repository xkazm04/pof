'use client';

import { useMemo, useState, useCallback } from 'react';
import { Eye, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_PINK, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';
import { InteractivePill } from '@/components/ui/InteractivePill';
import { BlueprintPanel, SectionHeader } from '../_design';
import { WidgetRect } from './WidgetRect';
import {
  VIEWPORT_ASPECT, ALL_WIDGETS, CONTEXT_PILLS, HUD_CONTEXTS,
  Z_DEPTH_LABELS, widgetChangedBetween,
} from './data';
import type { WidgetPlacement } from './data';

/* ── Filtered placements ───────────────────────────────────────────────────── */

import { WIDGET_PLACEMENTS } from './data';

const RELEVANT_PLACEMENTS: WidgetPlacement[] = WIDGET_PLACEMENTS.filter(
  p => ALL_WIDGETS.has(p.id),
);

/* ── HudCompositor ─────────────────────────────────────────────────────────── */

interface HudCompositorProps {
  accent: string;
}

export function HudCompositor({ accent }: HudCompositorProps) {
  const [activeContext, setActiveContext] = useState(0);
  const [prevContext, setPrevContext] = useState(0);
  const [showZLayers, setShowZLayers] = useState(false);

  const ctx = HUD_CONTEXTS[activeContext];
  const visibleSet = useMemo(() => new Set(ctx.visible), [ctx.visible]);

  const handleContextSwitch = useCallback((idx: number) => {
    setPrevContext(activeContext);
    setActiveContext(idx);
  }, [activeContext]);

  const visibleCount = ctx.visible.length;
  const totalCount = ctx.visible.length + ctx.hidden.length;

  const activeZDepths = useMemo(() => {
    const depths = new Set<number>();
    for (const p of RELEVANT_PLACEMENTS) {
      if (visibleSet.has(p.id)) depths.add(p.zDepth);
    }
    return Array.from(depths).sort((a, b) => a - b);
  }, [visibleSet]);

  return (
    <BlueprintPanel color={accent} className="p-4 col-span-1 lg:col-span-2">
      <div className="absolute right-0 top-0 w-40 h-40 blur-3xl rounded-full pointer-events-none"
        style={{ backgroundColor: `${ctx.color}08` }} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={Eye} label="HUD Context Compositor" color={accent} />
        <button
          onClick={() => setShowZLayers(z => !z)}
          className="flex items-center gap-1 px-2 py-0.5 text-xs font-mono uppercase tracking-[0.15em] font-bold rounded border transition-colors"
          style={{
            backgroundColor: showZLayers ? `${accent}${OPACITY_20}` : 'transparent',
            borderColor: showZLayers ? `${accent}60` : 'var(--border)',
            color: showZLayers ? accent : 'var(--text-muted)',
          }}
        >
          <Layers className="w-3 h-3" />
          Z-Layers
        </button>
      </div>

      {/* Context mode tabs */}
      <div className="mb-3">
        <InteractivePill
          items={CONTEXT_PILLS}
          activeIndex={activeContext}
          onChange={handleContextSwitch}
          accent={ACCENT_PINK}
          layoutId="hud-context-pill"
        />
      </div>

      {/* Viewport canvas */}
      <div
        className="relative w-full rounded-lg border border-border/50 bg-surface-deep/40 overflow-hidden"
        style={{ aspectRatio: `${VIEWPORT_ASPECT}` }}
      >
        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: '10% 10%',
          }}
        />

        {/* Viewport label */}
        <div className="absolute top-1.5 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider"
            style={{ color: `${ctx.color}90` }}>
            {ctx.name} Mode
          </span>
          <span className="text-[9px] font-mono text-text-muted opacity-60">
            {visibleCount}/{totalCount} widgets
          </span>
        </div>

        {/* Widget rectangles */}
        <AnimatePresence mode="sync">
          {RELEVANT_PLACEMENTS.map(p => (
            <WidgetRect
              key={p.id}
              placement={p}
              visible={visibleSet.has(p.id)}
              changed={widgetChangedBetween(p.id, prevContext, activeContext)}
              showZLayer={showZLayers}
              contextColor={ctx.color}
            />
          ))}
        </AnimatePresence>

        {/* Viewport border glow */}
        <div className="absolute inset-0 pointer-events-none rounded-lg"
          style={{ boxShadow: `inset 0 0 20px ${ctx.color}10, inset 0 0 2px ${ctx.color}15` }} />
      </div>

      {/* Z-layer legend */}
      <AnimatePresence>
        {showZLayers && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 mt-2.5 pt-2 border-t border-border/30">
              {activeZDepths.map(d => {
                const info = Z_DEPTH_LABELS[d];
                if (!info) return null;
                return (
                  <div key={d} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: info.color }} />
                    <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
                      Z{d} {info.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visible / Hidden summary */}
      <div className="grid grid-cols-2 gap-3 mt-2.5">
        <div className="bg-surface/50 p-2 rounded-md border border-border/30">
          <div className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text-muted mb-1 flex items-center gap-1">
            <Eye className="w-2.5 h-2.5" /> Visible
          </div>
          <div className="flex flex-wrap gap-1">
            {ctx.visible.map(w => (
              <span
                key={w}
                className="px-1.5 py-0.5 text-xs font-mono rounded border"
                style={{
                  color: ctx.color,
                  backgroundColor: `${ctx.color}12`,
                  borderColor: `${ctx.color}${OPACITY_30}`,
                }}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-surface/50 p-2 rounded-md border border-border/30">
          <div className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text-muted mb-1 flex items-center gap-1 opacity-60">
            <Eye className="w-2.5 h-2.5" /> Hidden
          </div>
          <div className="flex flex-wrap gap-1">
            {ctx.hidden.map(w => (
              <span key={w} className="px-1.5 py-0.5 text-xs font-mono text-text-muted opacity-50 rounded border border-border/30">
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}

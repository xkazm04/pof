'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, OVERLAY_WHITE, withOpacity, OPACITY_25 } from '@/lib/chart-colors';
import { STAGGER_DEFAULT } from '@/components/modules/core-engine/unique-tabs/_shared';
import { NODE_W, NODE_H, BRANCH_OFFSET_X } from './types';
import { DAMAGE_PIPELINE } from './pipeline-data';
import { FlowNode, FlowArrow } from './FlowNode';
import { ResponsiveSvgContainer } from './ResponsiveSvgContainer';

export function DamagePipelineFlow() {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setExpandedNode((prev) => (prev === id ? null : id));
  }, []);

  const centerX = 260;
  const rightX = centerX + BRANCH_OFFSET_X;
  let row = 0;
  const rowY = (r: number) => 10 + r * (NODE_H + 12);

  const rows = {
    entry: row++,
    consume: row++,
    crit: row++,
    subHealth: row++,
    detectType: row++,
    broadcast: row++,
    checkDead: row++,
    alreadyDead: row++,
    depleted: row++,
    death: row++,
  };
  const hitReactRow = rows.alreadyDead;
  const totalH = rowY(row) + 20;
  const svgWidth = centerX * 2 + 20;

  return (
    <div className="relative min-h-[200px]">
      <ResponsiveSvgContainer intrinsicWidth={svgWidth}>
        <svg width="100%" height={totalH}
          viewBox={`0 0 ${svgWidth} ${totalH}`}
          className="overflow-visible"
          data-testid="damage-pipeline-svg">

          {DAMAGE_PIPELINE.map((node, i) => {
            let nx = centerX;
            let ny: number;
            switch (node.id) {
              case 'entry-dmg':        ny = rowY(rows.entry); break;
              case 'consume-meta':     ny = rowY(rows.consume); break;
              case 'check-crit':       ny = rowY(rows.crit); break;
              case 'sub-health':       ny = rowY(rows.subHealth); break;
              case 'detect-type':      ny = rowY(rows.detectType); break;
              case 'broadcast-dmg':    ny = rowY(rows.broadcast); break;
              case 'check-dead':       ny = rowY(rows.checkDead); break;
              case 'check-already-dead': ny = rowY(rows.alreadyDead); break;
              case 'health-depleted':  ny = rowY(rows.depleted); break;
              case 'event-death':      ny = rowY(rows.death); break;
              case 'event-hitreact':   nx = rightX; ny = rowY(hitReactRow); break;
              default: return null;
            }
            return (
              <FlowNode key={node.id} node={node} x={nx} y={ny}
                delay={i * STAGGER_DEFAULT}
                expanded={expandedNode === node.id}
                onToggle={() => toggle(node.id)} />
            );
          })}

          {/* Main vertical arrows */}
          {[
            [rows.entry, rows.consume],
            [rows.consume, rows.crit],
            [rows.crit, rows.subHealth],
            [rows.subHealth, rows.detectType],
            [rows.detectType, rows.broadcast],
            [rows.broadcast, rows.checkDead],
          ].map(([from, to], i) => (
            <FlowArrow key={`arrow-${from}-${to}`}
              x1={centerX} y1={rowY(from) + NODE_H}
              x2={centerX} y2={rowY(to)}
              color={withOpacity(OVERLAY_WHITE, OPACITY_25)}
              delay={i * STAGGER_DEFAULT + 0.1} />
          ))}

          <FlowArrow x1={centerX} y1={rowY(rows.checkDead) + NODE_H}
            x2={centerX} y2={rowY(rows.alreadyDead)}
            color={STATUS_ERROR} label="YES" delay={0.5} />

          <FlowArrow x1={centerX + NODE_W / 2} y1={rowY(rows.checkDead) + NODE_H / 2}
            x2={rightX} y2={rowY(hitReactRow)}
            color={STATUS_SUCCESS} label="NO (alive)" delay={0.55} dashed />

          <FlowArrow x1={centerX} y1={rowY(rows.alreadyDead) + NODE_H}
            x2={centerX} y2={rowY(rows.depleted)}
            color={STATUS_WARNING} label="NOT dead yet" delay={0.6} />

          <FlowArrow x1={centerX} y1={rowY(rows.depleted) + NODE_H}
            x2={centerX} y2={rowY(rows.death)}
            color={STATUS_ERROR} delay={0.65} />
        </svg>
      </ResponsiveSvgContainer>

      <AnimatePresence>
        {expandedNode && (() => {
          const node = DAMAGE_PIPELINE.find((n) => n.id === expandedNode);
          if (!node?.cppRef) return null;
          return (
            <motion.div key={expandedNode}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-2 px-3 py-2 rounded-lg border border-border/40 bg-surface-deep/80"
              data-testid="pipeline-cpp-ref">
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1 font-bold">C++ Reference</div>
              <code className="text-xs font-mono text-text break-all">{node.cppRef}</code>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState, useCallback, useId, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OVERLAY_WHITE, withOpacity, OPACITY_25 } from '@/lib/chart-colors';
import { STAGGER_DEFAULT } from '@/components/modules/core-engine/unique-tabs/_shared';
import { NODE_W, NODE_H, ELEMENT_COLORS } from './types';
import { DIRECT_PIPELINE } from './pipeline-data';
import { FlowNode, FlowArrow } from './FlowNode';
import { ResponsiveSvgContainer } from './ResponsiveSvgContainer';

export function DirectHealthFlow() {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const panelId = `${useId()}-direct-cppref`;
  const toggle = useCallback((id: string) => {
    setExpandedNode((prev) => (prev === id ? null : id));
  }, []);

  const centerX = 200;
  const leftX = centerX - 110;
  const rightXp = centerX + 110;
  const rowY = (r: number) => 10 + r * (NODE_H + 12);

  const branchRow = 3;
  const deathRow = 4;
  const totalH = rowY(deathRow + 1) + 10;
  const svgWidth = centerX * 2 + 40;
  const stepCount = DIRECT_PIPELINE.length;

  // Placement per node: the first three stack on the centre line, then the
  // heal (left) / damage (right) branch, then the death check under damage.
  const place: { x: number; y: number; delay: number }[] = [
    { x: centerX, y: rowY(0), delay: 0 },
    { x: centerX, y: rowY(1), delay: STAGGER_DEFAULT },
    { x: centerX, y: rowY(2), delay: 2 * STAGGER_DEFAULT },
    { x: leftX, y: rowY(branchRow), delay: 0.3 },
    { x: rightXp, y: rowY(branchRow), delay: 0.35 },
    { x: rightXp, y: rowY(deathRow), delay: 0.45 },
  ];

  return (
    <div className="relative">
      <ResponsiveSvgContainer intrinsicWidth={svgWidth}>
        <svg width="100%" height={totalH}
          viewBox={`0 0 ${svgWidth} ${totalH}`}
          className="overflow-visible"
          role="group"
          aria-label={`Direct Health modification pipeline, ${stepCount} steps`}
          data-testid="direct-pipeline-svg">

          {DIRECT_PIPELINE.map((node, i) => {
            const p = place[i];
            if (!p) return null;
            // Same contract as the Damage/Heal flows: FlowNode draws a ▸ and a
            // pointer for every node with a cppRef, so those nodes must open it.
            const interactive = Boolean(node.cppRef);
            const isExpanded = expandedNode === node.id;
            return (
              <g key={node.id}
                role={interactive ? 'button' : 'img'}
                tabIndex={interactive ? 0 : undefined}
                aria-expanded={interactive ? isExpanded : undefined}
                aria-controls={interactive && isExpanded ? panelId : undefined}
                aria-label={`Step ${i + 1} of ${stepCount}: ${node.label}. ${node.detail}`}
                className={interactive ? 'focus-ring-outline' : undefined}
                onKeyDown={interactive ? (e: KeyboardEvent<SVGGElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(node.id);
                  } else if (e.key === 'Escape' && isExpanded) {
                    setExpandedNode(null);
                  }
                } : undefined}>
                <FlowNode node={node} x={p.x} y={p.y} delay={p.delay}
                  expanded={isExpanded} onToggle={() => toggle(node.id)} />
              </g>
            );
          })}

          {/* Connectors restate the order and branch outcomes the node labels
              already carry, so keep them out of the accessibility tree. */}
          <g aria-hidden="true">
            {[0, 1].map((i) => (
              <FlowArrow key={`direct-arrow-${i}`}
                x1={centerX} y1={rowY(i) + NODE_H}
                x2={centerX} y2={rowY(i + 1)}
                color={withOpacity(OVERLAY_WHITE, OPACITY_25)}
                delay={i * STAGGER_DEFAULT + 0.1} />
            ))}
            <FlowArrow
              x1={centerX - NODE_W / 2} y1={rowY(2) + NODE_H / 2}
              x2={leftX} y2={rowY(branchRow)}
              color={ELEMENT_COLORS.Heal} label="Positive"
              delay={0.35} dashed />
            <FlowArrow
              x1={centerX + NODE_W / 2} y1={rowY(2) + NODE_H / 2}
              x2={rightXp} y2={rowY(branchRow)}
              color={ELEMENT_COLORS.Physical} label="Negative"
              delay={0.4} dashed />
            <FlowArrow
              x1={rightXp} y1={rowY(branchRow) + NODE_H}
              x2={rightXp} y2={rowY(deathRow)}
              color={ELEMENT_COLORS.Physical} delay={0.5} />
          </g>
        </svg>
      </ResponsiveSvgContainer>

      <AnimatePresence mode="wait">
        {expandedNode && (() => {
          const node = DIRECT_PIPELINE.find((n) => n.id === expandedNode);
          if (!node?.cppRef) return null;
          return (
            <motion.div key={expandedNode}
              id={panelId}
              role="region"
              aria-label={`C++ reference for ${node.label}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-2 px-3 py-2 rounded-lg border border-border/40 bg-surface-deep/80"
              data-testid="pipeline-cpp-ref">
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1 font-bold">
                C++ Reference — {node.label}
              </div>
              <code className="text-xs font-mono text-text break-all">{node.cppRef}</code>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

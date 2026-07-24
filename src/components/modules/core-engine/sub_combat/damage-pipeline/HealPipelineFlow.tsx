'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { STAGGER_DEFAULT } from '@/components/modules/core-engine/unique-tabs/_shared';
import { NODE_H, ELEMENT_COLORS } from './types';
import { HEAL_PIPELINE } from './pipeline-data';
import { FlowNode, FlowArrow } from './FlowNode';
import { ResponsiveSvgContainer } from './ResponsiveSvgContainer';

const CPP_REF_ID = 'heal-pipeline-cpp-ref';

export function HealPipelineFlow() {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setExpandedNode((prev) => (prev === id ? null : id));
  }, []);

  const centerX = 180;
  const rowY = (r: number) => 10 + r * (NODE_H + 12);
  const totalH = rowY(HEAL_PIPELINE.length) + 10;
  const svgWidth = centerX * 2;
  const stepCount = HEAL_PIPELINE.length;

  return (
    <div className="relative">
      {/* The nodes carry a pointer cursor + a ▸ disclosure triangle, so say what
          they reveal — otherwise the affordance reads as decoration. */}
      <p className="mb-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted"
        data-testid="heal-pipeline-hint">
        Select any step to reveal its C++ reference.
      </p>

      <ResponsiveSvgContainer intrinsicWidth={svgWidth}>
        <svg width="100%" height={totalH}
          viewBox={`0 0 ${svgWidth} ${totalH}`}
          className="overflow-visible"
          role="group"
          aria-label={`IncomingHeal pipeline, ${stepCount} steps in execution order`}
          data-testid="heal-pipeline-svg">

          {HEAL_PIPELINE.map((node, i) => {
            const isExpanded = expandedNode === node.id;
            // Only nodes with a C++ reference have something to expand.
            const interactive = Boolean(node.cppRef);
            return (
              <g key={node.id}
                role={interactive ? 'button' : 'img'}
                tabIndex={interactive ? 0 : undefined}
                aria-expanded={interactive ? isExpanded : undefined}
                aria-controls={interactive && isExpanded ? CPP_REF_ID : undefined}
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
                <FlowNode node={node}
                  x={centerX} y={rowY(i)}
                  delay={i * STAGGER_DEFAULT}
                  expanded={isExpanded}
                  onToggle={() => toggle(node.id)} />
              </g>
            );
          })}

          {/* Connectors restate the top-to-bottom order the node labels already
              convey, so keep them out of the accessibility tree. */}
          <g aria-hidden="true">
            {HEAL_PIPELINE.slice(0, -1).map((_, i) => (
              <FlowArrow key={`heal-arrow-${i}`}
                x1={centerX} y1={rowY(i) + NODE_H}
                x2={centerX} y2={rowY(i + 1)}
                color={ELEMENT_COLORS.Heal}
                delay={i * STAGGER_DEFAULT + 0.1} />
            ))}
          </g>
        </svg>
      </ResponsiveSvgContainer>

      <AnimatePresence mode="wait">
        {expandedNode && (() => {
          const node = HEAL_PIPELINE.find((n) => n.id === expandedNode);
          if (!node?.cppRef) return null;
          return (
            <motion.div key={expandedNode}
              id={CPP_REF_ID}
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

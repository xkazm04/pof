'use client';

import { STAGGER_DEFAULT } from '@/components/modules/core-engine/unique-tabs/_shared';
import { NODE_H, ELEMENT_COLORS } from './types';
import { HEAL_PIPELINE } from './pipeline-data';
import { FlowNode, FlowArrow } from './FlowNode';
import { ResponsiveSvgContainer } from './ResponsiveSvgContainer';
import { useCppRefDisclosure, CppRefPanel } from './CppRefDisclosure';

export function HealPipelineFlow() {
  const { expandedNode, expandedNodeData, panelId, toggle, collapse, containerProps, nodeProps } =
    useCppRefDisclosure(HEAL_PIPELINE, 'heal-cppref');

  const centerX = 180;
  const rowY = (r: number) => 10 + r * (NODE_H + 12);
  const totalH = rowY(HEAL_PIPELINE.length) + 10;
  const svgWidth = centerX * 2;
  const stepCount = HEAL_PIPELINE.length;

  return (
    <div className="relative" {...containerProps}>
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
            return (
              <g key={node.id}
                {...nodeProps(node)}
                aria-label={`Step ${i + 1} of ${stepCount}: ${node.label}. ${node.detail}`}>
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

      <CppRefPanel node={expandedNodeData} panelId={panelId} onClose={collapse} />
    </div>
  );
}

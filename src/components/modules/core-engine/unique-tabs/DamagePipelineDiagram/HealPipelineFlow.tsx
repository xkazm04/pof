'use client';

import { STAGGER_DEFAULT } from '@/components/modules/core-engine/unique-tabs/_shared';
import { NODE_H } from './types';
import { ELEMENT_COLORS } from './types';
import { HEAL_PIPELINE } from './pipeline-data';
import { FlowNode, FlowArrow } from './FlowNode';
import { ResponsiveSvgContainer } from './ResponsiveSvgContainer';

export function HealPipelineFlow() {
  const centerX = 180;
  const rowY = (r: number) => 10 + r * (NODE_H + 12);
  const totalH = rowY(HEAL_PIPELINE.length) + 10;
  const svgWidth = centerX * 2;

  return (
    <ResponsiveSvgContainer intrinsicWidth={svgWidth}>
      <svg width="100%" height={totalH}
        viewBox={`0 0 ${svgWidth} ${totalH}`}
        className="overflow-visible"
        data-testid="heal-pipeline-svg">
        {HEAL_PIPELINE.map((node, i) => (
          <FlowNode key={node.id} node={node}
            x={centerX} y={rowY(i)}
            delay={i * STAGGER_DEFAULT}
            expanded={false} onToggle={() => {}} />
        ))}
        {HEAL_PIPELINE.slice(0, -1).map((_, i) => (
          <FlowArrow key={`heal-arrow-${i}`}
            x1={centerX} y1={rowY(i) + NODE_H}
            x2={centerX} y2={rowY(i + 1)}
            color={ELEMENT_COLORS.Heal}
            delay={i * STAGGER_DEFAULT + 0.1} />
        ))}
      </svg>
    </ResponsiveSvgContainer>
  );
}

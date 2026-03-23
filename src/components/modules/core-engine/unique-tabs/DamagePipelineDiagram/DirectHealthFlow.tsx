'use client';

import { STAGGER_DEFAULT } from '@/components/modules/core-engine/unique-tabs/_shared';
import { NODE_W, NODE_H, ELEMENT_COLORS } from './types';
import { DIRECT_PIPELINE } from './pipeline-data';
import { FlowNode, FlowArrow } from './FlowNode';
import { ResponsiveSvgContainer } from './ResponsiveSvgContainer';

export function DirectHealthFlow() {
  const centerX = 200;
  const leftX = centerX - 110;
  const rightXp = centerX + 110;
  const rowY = (r: number) => 10 + r * (NODE_H + 12);

  const branchRow = 3;
  const deathRow = 4;
  const totalH = rowY(deathRow + 1) + 10;
  const svgWidth = centerX * 2 + 40;

  return (
    <ResponsiveSvgContainer intrinsicWidth={svgWidth}>
      <svg width="100%" height={totalH}
        viewBox={`0 0 ${svgWidth} ${totalH}`}
        className="overflow-visible"
        data-testid="direct-pipeline-svg">

        {/* First 3 nodes: entry, clamp, checkSign */}
        {DIRECT_PIPELINE.slice(0, 3).map((node, i) => (
          <FlowNode key={node.id} node={node}
            x={centerX} y={rowY(i)}
            delay={i * STAGGER_DEFAULT}
            expanded={false} onToggle={() => {}} />
        ))}

        {/* Arrows for first 3 */}
        {[0, 1].map((i) => (
          <FlowArrow key={`direct-arrow-${i}`}
            x1={centerX} y1={rowY(i) + NODE_H}
            x2={centerX} y2={rowY(i + 1)}
            color="rgba(255,255,255,0.25)"
            delay={i * STAGGER_DEFAULT + 0.1} />
        ))}

        {/* Branch: heal (left) */}
        <FlowNode node={DIRECT_PIPELINE[3]}
          x={leftX} y={rowY(branchRow)}
          delay={0.3} expanded={false} onToggle={() => {}} />
        <FlowArrow
          x1={centerX - NODE_W / 2} y1={rowY(2) + NODE_H / 2}
          x2={leftX} y2={rowY(branchRow)}
          color={ELEMENT_COLORS.Heal} label="Positive"
          delay={0.35} dashed />

        {/* Branch: damage (right) */}
        <FlowNode node={DIRECT_PIPELINE[4]}
          x={rightXp} y={rowY(branchRow)}
          delay={0.35} expanded={false} onToggle={() => {}} />
        <FlowArrow
          x1={centerX + NODE_W / 2} y1={rowY(2) + NODE_H / 2}
          x2={rightXp} y2={rowY(branchRow)}
          color={ELEMENT_COLORS.Physical} label="Negative"
          delay={0.4} dashed />

        {/* Death check after damage broadcast */}
        <FlowNode node={DIRECT_PIPELINE[5]}
          x={rightXp} y={rowY(deathRow)}
          delay={0.45} expanded={false} onToggle={() => {}} />
        <FlowArrow
          x1={rightXp} y1={rowY(branchRow) + NODE_H}
          x2={rightXp} y2={rowY(deathRow)}
          color={ELEMENT_COLORS.Physical} delay={0.5} />
      </svg>
    </ResponsiveSvgContainer>
  );
}

'use client';

import { useState, useCallback, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, OVERLAY_WHITE, withOpacity, OPACITY_25 } from '@/lib/chart-colors';
import { ChartLegend } from '@/components/ui/ChartLegend';
import { STAGGER_DEFAULT } from '@/components/modules/core-engine/unique-tabs/_shared';
import { NODE_W, NODE_H, BRANCH_OFFSET_X } from './types';
import { DAMAGE_PIPELINE } from './pipeline-data';
import { FlowNode, FlowArrow } from './FlowNode';
import { ResponsiveSvgContainer } from './ResponsiveSvgContainer';

/**
 * The branch arrows are drawn as bare SVG text, which reads as unanchored noise
 * ("YES", "NO (alive)") to a screen reader. The connector layer is hidden below
 * and the topology is folded into the deciding node's own label instead.
 */
const BRANCH_OUTCOME: Record<string, string> = {
  'check-dead': ' Branches: YES to the death path, NO to Event_HitReact.',
  'check-already-dead': ' Branches: NOT dead yet to OnHealthDepleted.',
};

export function DamagePipelineFlow() {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const uid = useId();
  const panelId = `${uid}-cppref`;

  const toggle = useCallback((id: string) => {
    setExpandedNode((prev) => (prev === id ? null : id));
  }, []);

  /** Collapse the reference panel and hand focus back to the node that opened it. */
  const collapse = useCallback(() => {
    if (expandedNode) document.getElementById(`${uid}-node-${expandedNode}`)?.focus();
    setExpandedNode(null);
  }, [expandedNode, uid]);

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
    <div
      className="relative min-h-[200px]"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && expandedNode) {
          e.stopPropagation();
          collapse();
        }
      }}
    >
      {/* Decode the branch-arrow colors so the death/alive paths read without
          relying on red-vs-green (WCAG 1.4.1); the arrows also carry text labels.
          Each description names where that branch lands, so the key stands alone. */}
      <ChartLegend
        className="mb-1.5"
        dense
        ariaLabel="Damage pipeline branch legend"
        items={[
          { color: STATUS_ERROR, label: 'Dead', description: 'YES → death path', shape: 'line' },
          { color: STATUS_SUCCESS, label: 'Alive', description: 'NO → Event_HitReact', shape: 'dashed' },
          { color: STATUS_WARNING, label: 'Not dead yet', description: '→ OnHealthDepleted', shape: 'line' },
        ]}
      />

      {/* The nodes carry a pointer cursor + a ▸ disclosure triangle, so say what
          they reveal — otherwise the affordance reads as decoration. Matches the
          sibling Heal/Direct flows stacked in the same panel. */}
      <p className="mb-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted"
        data-testid="damage-pipeline-hint">
        Select any step to reveal its C++ reference.
      </p>

      <ResponsiveSvgContainer intrinsicWidth={svgWidth}>
        <svg width="100%" height={totalH}
          viewBox={`0 0 ${svgWidth} ${totalH}`}
          className="overflow-visible"
          role="group"
          aria-label={`IncomingDamage pipeline flow diagram, ${DAMAGE_PIPELINE.length} steps`}
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
            // FlowNode's shapes carry the mouse `onClick`; this wrapper adds the
            // focus/ARIA contract SVG shapes never get for free — without an
            // `onClick` of its own, which would double-toggle on a real click.
            const interactive = Boolean(node.cppRef);
            const isExpanded = expandedNode === node.id;
            return (
              <g key={node.id}
                id={`${uid}-node-${node.id}`}
                role={interactive ? 'button' : 'img'}
                tabIndex={interactive ? 0 : undefined}
                aria-expanded={interactive ? isExpanded : undefined}
                aria-controls={interactive && isExpanded ? panelId : undefined}
                aria-label={`${node.label} — ${node.kind} step. ${node.detail}.${BRANCH_OUTCOME[node.id] ?? ''}${interactive ? ' Activate to show its C++ reference.' : ''}`}
                onKeyDown={(e) => {
                  if (!interactive) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(node.id);
                  }
                }}
                className={interactive ? 'focus-ring-outline cursor-pointer' : undefined}>
                <FlowNode node={node} x={nx} y={ny}
                  delay={i * STAGGER_DEFAULT}
                  expanded={isExpanded}
                  onToggle={() => toggle(node.id)} />
              </g>
            );
          })}

          {/* Connectors are a visual restatement of order + the branch outcomes
              already folded into BRANCH_OUTCOME, so keep them out of the a11y tree. */}
          <g aria-hidden="true">
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
          </g>
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
              id={panelId}
              role="region"
              aria-label={`C++ reference for ${node.label}`}
              className="mt-2 px-3 py-2 rounded-lg border border-border/40 bg-surface-deep/80"
              data-testid="pipeline-cpp-ref">
              {/* Name the step the snippet belongs to — the panel sits below a
                  scrollable diagram, so "C++ Reference" alone is ambiguous. */}
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">
                  C++ Reference — <span className="text-text">{node.label}</span>
                </div>
                <button type="button"
                  onClick={collapse}
                  aria-label={`Hide C++ reference for ${node.label}`}
                  className="focus-ring shrink-0 rounded p-0.5 text-text-muted hover:text-text"
                  data-testid="pipeline-cpp-ref-close">
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <code className="text-xs font-mono text-text break-all">{node.cppRef}</code>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ChipButton } from '@/components/ui/ChipButton';
import { ACCENT_VIOLET, OPACITY_10 } from '@/lib/chart-colors';
import { StepCard, PipelineArrow } from './StepCard';
import { runtimeTestOrder, testOrderDiffers } from './constants';
import type { QueryPipeline } from './types';

/** Interactive chip recipe — hover + keyboard affordance the `as="span"` chips lack. */
const CHIP_INTERACTIVE = 'focus-ring cursor-pointer hover:brightness-125';

export function QueryPipelineCard({ pipeline }: { pipeline: QueryPipeline }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /** Disclosure buttons by step id, so a flow-bar chip can focus its stage. */
  const stepButtons = useRef(new Map<string, HTMLButtonElement | null>());
  const PIcon = pipeline.icon;

  const toggleStep = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allExpanded = expanded.size === pipeline.steps.length;

  const toggleAll = useCallback(() => {
    setExpanded((prev) => (
      prev.size === pipeline.steps.length ? new Set() : new Set(pipeline.steps.map((s) => s.id))
    ));
  }, [pipeline.steps]);

  /** Flow-bar chip → open that stage's detail card and move focus onto it. */
  const revealStep = useCallback((id: string) => {
    setExpanded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    const button = stepButtons.current.get(id);
    // `scrollIntoView` is absent in jsdom — optional-call keeps tests safe.
    button?.scrollIntoView?.({ block: 'nearest' });
    button?.focus();
  }, []);

  /**
   * Only rendered when the authored order is not the order UE5 runs — otherwise
   * the diagram would quietly imply top-to-bottom execution (see FindCoverPosition,
   * which lists the High-cost LineOfSight above the Low-cost ElevationAdvantage).
   */
  const runtimeOrder = useMemo(() => (
    testOrderDiffers(pipeline.steps)
      ? runtimeTestOrder(pipeline.steps).map((s) => `${s.label} (${s.cost ?? 'Low'})`).join(' → ')
      : null
  ), [pipeline.steps]);

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid={`eqs-pipeline-${pipeline.id}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_10}` }}
          aria-hidden="true"
        >
          <span style={{ color: ACCENT_VIOLET }}><PIcon className="w-4 h-4" /></span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text font-mono">{pipeline.name}</h3>
          <p className="text-xs text-text-muted leading-relaxed">{pipeline.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-2xs text-text-muted">{pipeline.steps.length} stages</span>
          {/* Label changes with state, so no aria-pressed — the name carries the action. */}
          <ChipButton
            color={ACCENT_VIOLET}
            tone="outline"
            className={CHIP_INTERACTIVE}
            onClick={toggleAll}
            aria-label={`${allExpanded ? 'Collapse' : 'Expand'} all ${pipeline.name} stage details`}
            data-testid={`eqs-pipeline-${pipeline.id}-toggle-all`}
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </ChipButton>
        </div>
      </div>

      {/* Flow: horizontal summary bar. Arrows are decorative — the running order is
          already conveyed by the list semantics and repeated in the cards below.
          Each chip jumps to (and opens) its stage card. */}
      <ol
        className="px-4 py-2.5 border-b border-border/20 flex items-center gap-1 flex-wrap"
        aria-label={`${pipeline.name} stage order`}
      >
        {pipeline.steps.map((step, i) => (
          <li key={step.id} className="flex items-center gap-1">
            <ChipButton
              color={step.color}
              mono
              tone="outline"
              className={CHIP_INTERACTIVE}
              onClick={() => revealStep(step.id)}
              aria-label={`Show ${step.label} stage details`}
              data-testid={`eqs-chip-${step.id}`}
            >
              {step.label}
            </ChipButton>
            {i < pipeline.steps.length - 1 && (
              <ArrowRight aria-hidden="true" className="w-3 h-3 text-text-muted" />
            )}
          </li>
        ))}
      </ol>

      {runtimeOrder && (
        <p
          className="px-4 py-2 border-b border-border/20 flex items-start gap-1.5 text-2xs text-text-muted leading-relaxed"
          role="note"
          data-testid={`eqs-pipeline-${pipeline.id}-runtime-order`}
        >
          <Info aria-hidden="true" className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            Listed in authoring order. UE5 sorts tests by cost before running them, so the
            engine executes: <span className="font-mono text-text">{runtimeOrder}</span>.
          </span>
        </p>
      )}

      {/* Detailed step cards */}
      <div className="p-3 space-y-0">
        {pipeline.steps.map((step, i) => (
          <div key={step.id}>
            <StepCard
              step={step}
              expanded={expanded.has(step.id)}
              onToggle={() => toggleStep(step.id)}
              buttonRef={(el) => { stepButtons.current.set(step.id, el); }}
            />
            {i < pipeline.steps.length - 1 && (
              <PipelineArrow color={pipeline.steps[i + 1].color} />
            )}
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

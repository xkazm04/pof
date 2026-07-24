'use client';

import {
  ArrowRight, ChevronDown, ChevronRight,
} from 'lucide-react';
import { ChipButton } from '@/components/ui/ChipButton';
import { STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import { KIND_LABELS, KIND_ICONS } from './constants';
import type { PipelineStep } from './types';

export function StepCard({ step, expanded, onToggle, buttonRef }: {
  step: PipelineStep;
  expanded: boolean;
  onToggle: () => void;
  /** Lets the flow bar above move focus to this stage's disclosure button. */
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const KindIcon = KIND_ICONS[step.kind];
  const detailId = `eqs-step-${step.id}-detail`;

  return (
    <div
      className="rounded-lg border border-border/40 overflow-hidden"
      style={{ borderColor: `${step.color}30` }}
      data-testid={`eqs-step-${step.id}`}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailId}
        className="focus-ring-inset w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/3 transition-colors"
        data-testid={`eqs-step-${step.id}-toggle`}
      >
        {expanded
          ? <ChevronDown aria-hidden="true" className="w-3 h-3 text-text-muted shrink-0" />
          : <ChevronRight aria-hidden="true" className="w-3 h-3 text-text-muted shrink-0" />
        }
        <span aria-hidden="true" style={{ color: step.color }}><KindIcon className="w-3.5 h-3.5" /></span>
        <span className="text-xs font-bold text-text">{step.label}</span>
        <ChipButton as="span" color={step.color} className="ml-auto shrink-0">
          {KIND_LABELS[step.kind]}
        </ChipButton>
        {step.cost && (
          <ChipButton
            as="span"
            color={step.cost === 'High' ? STATUS_WARNING : STATUS_SUCCESS}
            mono
            className="shrink-0"
          >
            Cost: {step.cost}
          </ChipButton>
        )}
      </button>

      {/* Always mounted so `aria-controls` always resolves; `hidden` handles visibility. */}
      <div
        id={detailId}
        hidden={!expanded}
        className="px-3 pb-2.5 pt-0.5 border-t border-border/20 space-y-1.5"
      >
        <p className="text-xs text-text-muted leading-relaxed">{step.detail}</p>
        {step.cppClass && (
          <p className="text-2xs font-mono break-all" style={{ color: step.color }}>
            {step.cppClass}
          </p>
        )}
        {step.params && step.params.length > 0 && (
          <dl className="space-y-0.5 mt-1">
            {step.params.map((p) => (
              <div key={p.label} className="flex items-start gap-2">
                <dt className="text-xs text-text-muted w-32 shrink-0">{p.label}</dt>
                <dd className="text-xs font-mono text-text min-w-0 break-words">{p.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

export function PipelineArrow({ color }: { color: string }) {
  return (
    <div className="flex items-center justify-center py-0.5" aria-hidden="true">
      <ArrowRight className="w-3.5 h-3.5" style={{ color }} />
    </div>
  );
}

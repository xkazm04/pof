'use client';

import {
  ArrowRight, ChevronDown, ChevronRight,
} from 'lucide-react';
import { ChipButton } from '@/components/ui/ChipButton';
import { STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import { KIND_LABELS, KIND_ICONS } from './constants';
import type { PipelineStep } from './types';

export function StepCard({ step, expanded, onToggle }: { step: PipelineStep; expanded: boolean; onToggle: () => void }) {
  const KindIcon = KIND_ICONS[step.kind];

  return (
    <div
      className="rounded-lg border border-border/40 overflow-hidden"
      style={{ borderColor: `${step.color}30` }}
      data-testid={`eqs-step-${step.id}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/3 transition-colors"
        data-testid={`eqs-step-${step.id}-toggle`}
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
          : <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
        }
        <span style={{ color: step.color }}><KindIcon className="w-3.5 h-3.5" /></span>
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

      {expanded && (
        <div className="px-3 pb-2.5 pt-0.5 border-t border-border/20 space-y-1.5">
          <p className="text-2xs text-text-muted">{step.detail}</p>
          {step.cppClass && (
            <p className="text-2xs font-mono text-text-muted" style={{ color: step.color }}>
              {step.cppClass}
            </p>
          )}
          {step.params && step.params.length > 0 && (
            <div className="space-y-0.5 mt-1">
              {step.params.map((p) => (
                <div key={p.label} className="flex items-center gap-2">
                  <span className="text-2xs text-text-muted w-28 shrink-0">{p.label}</span>
                  <span className="text-2xs font-mono text-text">{p.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PipelineArrow({ color }: { color: string }) {
  return (
    <div className="flex items-center justify-center py-0.5">
      <ArrowRight className="w-3.5 h-3.5" style={{ color }} />
    </div>
  );
}

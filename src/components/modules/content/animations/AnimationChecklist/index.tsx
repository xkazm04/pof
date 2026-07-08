'use client';

import { useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Workflow } from 'lucide-react';
import { ExplainToggle } from '@/components/animations/explain';
import { ANIMATION_STEPS, ACCENT } from './constants';
import { StepCard } from './StepCard';
import type { ChecklistStep } from './types';

export type { StepType, ChecklistStep } from './types';
export { ANIMATION_STEPS } from './constants';

// ── Component ──

interface AnimationChecklistProps {
  onGenerate: (step: ChecklistStep) => void;
  isGenerating: boolean;
  completedSteps: Set<string>;
  onMarkComplete: (stepId: string) => void;
}

export function AnimationChecklist({ onGenerate, isGenerating, completedSteps, onMarkComplete }: AnimationChecklistProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const completedCount = ANIMATION_STEPS.filter((s) => completedSteps.has(s.id)).length;
  const progressPercent = (completedCount / ANIMATION_STEPS.length) * 100;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-[#03030a] rounded-2xl border border-violet-900/30 relative overflow-hidden shadow-[inset_0_0_80px_rgba(167,139,250,0.05)]">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `linear-gradient(${ACCENT} 1px, transparent 1px), linear-gradient(90deg, ${ACCENT} 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10 mb-8 pb-4 border-b border-violet-900/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl grid place-items-center bg-violet-950/50 border border-violet-800/50 shadow-[0_0_15px_rgba(167,139,250,0.15)] overflow-hidden relative">
            <Workflow className="w-5 h-5 text-violet-400 relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-violet-500/20 to-transparent" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-violet-100 font-mono tracking-widest uppercase flex items-center gap-2" style={{ textShadow: '0 0 8px rgba(167,139,250,0.4)' }}>
              INTEGRATION_CHECKLIST.sys
            </h3>
            <p className="text-xs text-violet-400/80 font-mono uppercase tracking-widest mt-0.5">
              Commandlet → Mixamo → AnimBP → Montages → Notifies
            </p>
          </div>
        </div>

        {/* Progress + Explain toggle */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <ExplainToggle />
            <div className="text-xs font-mono font-bold text-violet-300 tracking-widest uppercase">
              Progress <span className="text-violet-100">{completedCount}/{ANIMATION_STEPS.length}</span>
            </div>
          </div>
          <div className="w-32 h-2 rounded-full bg-[#0a0a1e] border border-violet-900/40 overflow-hidden relative shadow-inner">
            <motion.div
              className="absolute top-0 left-0 bottom-0 rounded-full"
              style={{
                backgroundColor: ACCENT,
                boxShadow: `0 0 10px ${ACCENT}, inset 0 0 5px rgba(255,255,255,0.5)`,
              }}
              initial={prefersReduced ? false : { width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 relative z-10">
        {ANIMATION_STEPS.map((step) => {
          const isCompleted = completedSteps.has(step.id);
          const isExpanded = expandedId === step.id;

          return (
            <StepCard
              key={step.id}
              step={step}
              isCompleted={isCompleted}
              isExpanded={isExpanded}
              isGenerating={isGenerating}
              prefersReduced={prefersReduced}
              onToggle={() => toggleExpand(step.id)}
              onGenerate={() => onGenerate(step)}
              onMarkComplete={() => onMarkComplete(step.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

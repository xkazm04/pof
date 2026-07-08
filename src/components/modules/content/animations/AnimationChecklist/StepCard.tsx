'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ExternalLink, Check, Zap, ChevronDown, ChevronRight, ArrowRight
} from 'lucide-react';
import { JargonText, PlainEnglishSummary } from '@/components/animations/explain';
import {
  ACCENT_VIOLET, ACCENT_CYAN, STATUS_SUCCESS, MODULE_COLORS,
  OPACITY_10, OPACITY_12, OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import type { ChecklistStep } from './types';
import { ACCENT } from './constants';

// ── Step Card ──

interface StepCardProps {
  step: ChecklistStep;
  isCompleted: boolean;
  isExpanded: boolean;
  isGenerating: boolean;
  prefersReduced: boolean | null;
  onToggle: () => void;
  onGenerate: () => void;
  onMarkComplete: () => void;
}

export function StepCard({ step, isCompleted, isExpanded, isGenerating, prefersReduced, onToggle, onGenerate, onMarkComplete }: StepCardProps) {
  const Icon = step.icon;
  const isCode = step.type === 'code';
  const isAuto = step.type === 'auto';
  const typeColor = isAuto ? ACCENT_CYAN : isCode ? ACCENT_VIOLET : MODULE_COLORS.content;
  const typeLabel = isAuto ? 'Auto' : isCode ? 'Code' : 'Manual';

  return (
    <motion.div
      layout={!prefersReduced}
      data-testid={`pof-module-arpg-animation-step-${step.id}`}
      initial={prefersReduced ? false : { borderRadius: 16 }}
      animate={{
        borderColor: isCompleted ? `${STATUS_SUCCESS}50` : isExpanded ? `${typeColor}80` : `${typeColor}20`,
        backgroundColor: isCompleted ? `${STATUS_SUCCESS}0A` : isExpanded ? `${typeColor}0A` : 'var(--surface-deep)',
        boxShadow: isExpanded ? `0 0 20px ${typeColor}20, inset 0 0 10px ${typeColor}10` : 'none',
      }}
      className="border relative overflow-hidden group/card"
    >
      {/* Background glow for expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : undefined}
            className="absolute top-0 right-0 w-64 h-full pointer-events-none"
            style={{ background: `linear-gradient(to left, ${typeColor}10, transparent)` }}
          />
        )}
      </AnimatePresence>

      <button
        onClick={onToggle}
        data-testid={`pof-module-arpg-animation-toggle-${step.id}`}
        className="w-full flex items-center gap-4 px-5 py-4 text-left relative z-10"
      >
        {/* Step Indicator */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold font-mono transition-all duration-300 relative group-hover/card:scale-105"
          style={{
            backgroundColor: isCompleted ? `${STATUS_SUCCESS}20` : `${typeColor}20`,
            border: `1px solid ${isCompleted ? STATUS_SUCCESS : typeColor}`,
            boxShadow: `0 0 15px ${isCompleted ? STATUS_SUCCESS : typeColor}40, inset 0 0 10px ${isCompleted ? STATUS_SUCCESS : typeColor}20`,
            color: isCompleted ? STATUS_SUCCESS : typeColor,
          }}
        >
          {isCompleted ? <Check className="w-5 h-5 drop-shadow-[0_0_8px_currentColor]" /> : step.number}

          {/* Glow Pulse */}
          {!isCompleted && isExpanded && (
            <div className="absolute inset-0 rounded-xl animate-ping opacity-30" style={{ border: `2px solid ${typeColor}` }} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span
              className="text-sm font-bold tracking-wide font-mono"
              style={{
                color: isCompleted ? STATUS_SUCCESS : isExpanded ? typeColor : '#e2e8f0',
                textShadow: isCompleted || isExpanded ? `0 0 10px ${isCompleted ? STATUS_SUCCESS : typeColor}80` : 'none'
              }}
            >
              {step.title}
            </span>
            <span
              className="text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border"
              style={{
                backgroundColor: isCompleted ? `${STATUS_SUCCESS}15` : `${typeColor}15`,
                color: isCompleted ? STATUS_SUCCESS : typeColor,
                borderColor: isCompleted ? `${STATUS_SUCCESS}40` : `${typeColor}40`,
              }}
            >
              {isCompleted ? 'OK' : typeLabel}
            </span>
          </div>
          <p className="text-[11px] text-text-muted font-mono leading-relaxed opacity-80 max-w-2xl truncate">
            <JargonText>{step.description}</JargonText>
          </p>
        </div>

        {/* Expand indicator */}
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={prefersReduced ? { duration: 0 } : undefined} className="flex-shrink-0 ml-4 p-2 rounded-lg bg-surface/50 border border-border group-hover/card:border-violet-500/50 transition-colors">
          <ChevronDown className="w-4 h-4 text-text-muted group-hover/card:text-violet-400" />
        </motion.div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden relative z-10"
          >
            <div className="px-5 pb-5 pl-[72px] space-y-4">
              {/* Plain-English summary (only when Explain toggle is on AND step touches known concepts) */}
              <PlainEnglishSummary
                source={`${step.description}\n${step.details.join('\n')}\n${step.prompt ?? ''}`}
              />

              {/* Instructions */}
              <div className="p-4 bg-black/40 border border-violet-900/40 rounded-xl shadow-inner backdrop-blur-sm">
                <ol className="space-y-2">
                  {step.details.map((detail, i) => (
                    <li key={i} className="text-[11px] text-violet-200/80 leading-relaxed flex gap-3 font-mono">
                      <span className="flex-shrink-0 text-violet-500/70 font-bold">{String(i + 1).padStart(2, '0')}.</span>
                      <span><JargonText>{detail}</JargonText></span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Links */}
              {step.links && step.links.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-4">
                  {step.links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all hover:-translate-y-0.5"
                      style={{
                        backgroundColor: `${MODULE_COLORS.content}15`,
                        color: MODULE_COLORS.content,
                        border: `1px solid ${MODULE_COLORS.content}40`,
                        boxShadow: `0 4px 10px ${MODULE_COLORS.content}15`,
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {link.label}
                    </a>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-5 pt-3 border-t border-violet-900/30">
                {(isCode || isAuto) && step.prompt && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                    disabled={isGenerating}
                    data-testid={`pof-module-arpg-animation-generate-${step.id}`}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                    style={{
                      backgroundColor: `${ACCENT}20`,
                      color: ACCENT_CYAN,
                      border: `1px solid ${ACCENT}`,
                      boxShadow: `0 0 20px ${ACCENT}40, inset 0 0 10px ${ACCENT}20`,
                    }}
                  >
                    <Zap className="w-4 h-4 text-cyan-400" />
                    Execute Process <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                  </button>
                )}

                {!isCompleted && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onMarkComplete(); }}
                    data-testid={`pof-module-arpg-animation-mark-${step.id}`}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-text-muted bg-surface/80 border border-border hover:border-green-500/50 hover:text-green-400 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                  >
                    <Check className="w-4 h-4" />
                    Verify Complete
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

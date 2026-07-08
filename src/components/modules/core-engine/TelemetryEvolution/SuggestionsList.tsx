'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ChevronDown, ChevronRight, CheckCircle2, XCircle,
  TrendingUp, Sparkles, Layers,
} from 'lucide-react';
import { STATUS_WARNING } from '@/lib/chart-colors';
import { motionSafe } from '@/lib/motion';
import { ScoreRing } from '@/components/ui/ScoreRing';
import type { GenreEvolutionSuggestion } from '@/types/telemetry';
import { GenreTemplateGallery } from '@/components/modules/core-engine/GenreTemplateGallery';
import { SUB_GENRE_STYLES } from './constants';

export function SuggestionsList({
  suggestions,
  expandedId,
  onToggle,
  onResolve,
}: {
  suggestions: GenreEvolutionSuggestion[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onResolve: (id: string, action: 'accept' | 'dismiss') => void;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionSafe({ duration: 0.22, delay: 0.1 }, prefersReduced)}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles className="w-3.5 h-3.5" style={{ color: STATUS_WARNING }} />
        <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
          Evolution Suggestions
        </span>
      </div>
      <div className="space-y-3">
        {suggestions.map((sug, i) => {
          const style = SUB_GENRE_STYLES[sug.subGenre] ?? { color: 'var(--text-muted)', icon: Layers };
          const Icon = style.icon;
          const isExpanded = expandedId === sug.id;

          return (
            <motion.div
              key={sug.id}
              initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionSafe({ duration: 0.22, delay: i * 0.04 }, prefersReduced)}
              className="bg-surface-deep border rounded-xl overflow-hidden transition-colors"
              style={{ borderColor: isExpanded ? `${style.color}30` : 'var(--border)' }}
            >
              {/* Header */}
              <button
                onClick={() => onToggle(sug.id)}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left group"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${style.color}10`, border: `1px solid ${style.color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color: style.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-text block">{sug.label}</span>
                  <span className="text-2xs text-text-muted">{sug.confidence}% confidence</span>
                </div>
                <ScoreRing value={sug.confidence} size={32} strokeWidth={2} color={style.color} labelClassName="text-2xs font-bold text-text" />
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-muted transition-colors" />
                )}
              </button>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={prefersReduced ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={motionSafe({ duration: 0.22 }, prefersReduced)}
                    className="overflow-hidden"
                  >
                    <div className="px-3.5 pb-3.5 space-y-3 border-t border-border">
                      {/* Description */}
                      <p className="text-xs text-text-muted-hover pt-3 leading-relaxed">
                        {sug.description}
                      </p>

                      {/* Evidence */}
                      {sug.patterns.length > 0 && (
                        <div>
                          <span className="text-2xs text-text-muted font-semibold uppercase tracking-wider">Evidence</span>
                          <div className="mt-1 space-y-1">
                            {sug.patterns.flatMap(p => p.evidence).slice(0, 4).map((ev, j) => (
                              <div key={j} className="flex items-start gap-1.5">
                                <TrendingUp className="w-2.5 h-2.5 text-text-muted mt-0.5 flex-shrink-0" />
                                <span className="text-2xs text-text-muted-hover">{ev}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Proposed changes */}
                      {sug.proposedChanges.add.length > 0 && (
                        <div>
                          <span className="text-2xs text-text-muted font-semibold uppercase tracking-wider">
                            New Checklist Items
                          </span>
                          <div className="mt-1 space-y-1">
                            {sug.proposedChanges.add.map(item => (
                              <div key={item.id} className="flex items-start gap-1.5">
                                <Sparkles className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" style={{ color: style.color }} />
                                <span className="text-2xs text-text-muted-hover">{item.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Genome templates — turn this recommendation into an
                          instant, genre-aligned starting point */}
                      <GenreTemplateGallery subGenre={sug.subGenre} accentColor={style.color} />

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onResolve(sug.id, 'accept'); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                          style={{
                            backgroundColor: `${style.color}15`,
                            color: style.color,
                            border: `1px solid ${style.color}30`,
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Accept Evolution
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onResolve(sug.id, 'dismiss'); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-text-muted bg-surface border border-border hover:border-border-bright transition-all"
                        >
                          <XCircle className="w-3 h-3" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, X, Network, CheckCircle2, XCircle,
  Zap, BookOpen, Sparkles,
} from 'lucide-react';
import { SUB_GENRE_TEMPLATES } from '@/lib/genre-evolution-engine';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { ImplementationPattern } from '@/types/pattern-library';
import type { Recommendation } from '@/types/evaluator';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_BLOCKER, ACCENT_VIOLET, MODULE_COLORS, OPACITY_15, OPACITY_30 } from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import type { NexusNode } from './types';
import { itemIdToModule } from './helpers';

// ─── Deep Dive Panel ───────────────────────────────────────────────────────

export function NodeDeepDivePanel({
  node,
  patterns,
  recommendations,
  history,
  onClose,
}: {
  node: NexusNode;
  patterns: ImplementationPattern[];
  recommendations: Recommendation[];
  history: { id: string; prompt: string; status: string; timestamp: number; duration?: number }[];
  onClose: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>('checklist');

  const healthColor = node.healthScore >= 70 ? STATUS_SUCCESS : node.healthScore >= 40 ? STATUS_WARNING : STATUS_ERROR;
  const successCount = history.filter((h) => h.status === 'completed').length;
  const failCount = history.filter((h) => h.status === 'failed').length;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: MOTION.base }}
      className="overflow-hidden"
    >
      <SurfaceCard className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}`, border: `1px solid ${ACCENT_VIOLET}${OPACITY_30}` }}
            >
              <Network className="w-4 h-4 text-[#a78bfa]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">{node.label}</h3>
              <div className="flex items-center gap-2 text-2xs text-text-muted">
                <span>{node.implementedCount}/{node.featureCount} features</span>
                <span>·</span>
                <span>{node.checklistDone}/{node.checklistTotal} checklist</span>
                {node.healthScore > 0 && (
                  <>
                    <span>·</span>
                    <span style={{ color: healthColor }}>Health: {node.healthScore}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <MiniStat label="Patterns" value={patterns.length.toString()} color={STATUS_SUCCESS} />
          <MiniStat
            label="Success Rate"
            value={node.patternSuccessRate !== null ? `${Math.round(node.patternSuccessRate * 100)}%` : '—'}
            color={node.patternSuccessRate !== null && node.patternSuccessRate >= 0.7 ? STATUS_SUCCESS : STATUS_WARNING}
          />
          <MiniStat label="Sessions" value={`${successCount}/${successCount + failCount}`} color={STATUS_INFO} />
          <MiniStat label="Genre Items" value={node.genreItemCount.toString()} color={ACCENT_VIOLET} />
        </div>

        {/* Sections */}
        <div className="space-y-1">
          {/* Patterns section */}
          {patterns.length > 0 && (
            <CollapsibleSection
              title="Matching Patterns"
              count={patterns.length}
              color={STATUS_SUCCESS}
              isOpen={expandedSection === 'patterns'}
              onToggle={() => setExpandedSection(expandedSection === 'patterns' ? null : 'patterns')}
            >
              <div className="space-y-1.5">
                {patterns.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background">
                    <BookOpen className="w-3 h-3 text-[#4ade80] flex-shrink-0" />
                    <span className="text-xs text-text flex-1 truncate">{p.title}</span>
                    <span className="text-2xs font-medium" style={{ color: p.successRate >= 0.7 ? STATUS_SUCCESS : STATUS_WARNING }}>
                      {Math.round(p.successRate * 100)}%
                    </span>
                    <span className="text-2xs text-text-muted">{p.sessionCount} uses</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Recommendations section */}
          {recommendations.length > 0 && (
            <CollapsibleSection
              title="Recommendations"
              count={recommendations.length}
              color={MODULE_COLORS.evaluator}
              isOpen={expandedSection === 'recs'}
              onToggle={() => setExpandedSection(expandedSection === 'recs' ? null : 'recs')}
            >
              <div className="space-y-1.5">
                {recommendations.map((rec) => {
                  const prioColor = rec.priority === 'critical' ? STATUS_ERROR : rec.priority === 'high' ? STATUS_BLOCKER : STATUS_WARNING;
                  return (
                    <div key={rec.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-background">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: prioColor }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-text">{rec.title}</span>
                        <p className="text-2xs text-text-muted mt-0.5 line-clamp-2">{rec.description}</p>
                      </div>
                      <span className="text-2xs font-bold uppercase px-1 py-0.5 rounded" style={{ color: prioColor, backgroundColor: `${prioColor}15` }}>
                        {rec.priority}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {/* Session history section */}
          {history.length > 0 && (
            <CollapsibleSection
              title="Recent CLI Sessions"
              count={history.length}
              color={STATUS_INFO}
              isOpen={expandedSection === 'sessions'}
              onToggle={() => setExpandedSection(expandedSection === 'sessions' ? null : 'sessions')}
            >
              <div className="space-y-0.5">
                {history.slice(-8).reverse().map((h) => (
                  <div key={h.id} className="flex items-center gap-2 px-2 py-1 rounded-md bg-background">
                    {h.status === 'completed' ? (
                      <CheckCircle2 className="w-3 h-3 text-[#4ade80] flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-[#f87171] flex-shrink-0" />
                    )}
                    <span className="text-xs text-text-muted flex-1 truncate">{h.prompt.slice(0, 60)}</span>
                    {h.duration && (
                      <span className="text-2xs text-text-muted flex-shrink-0">
                        {h.duration > 60000 ? `${Math.round(h.duration / 60000)}m` : `${Math.round(h.duration / 1000)}s`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Genre evolution section */}
          {node.genreItemCount > 0 && (
            <CollapsibleSection
              title="Genre Evolution Features"
              count={node.genreItemCount}
              color={ACCENT_VIOLET}
              isOpen={expandedSection === 'genre'}
              onToggle={() => setExpandedSection(expandedSection === 'genre' ? null : 'genre')}
            >
              <div className="space-y-1">
                {SUB_GENRE_TEMPLATES.filter((t) =>
                  t.priorityItems.some((itemId) => itemIdToModule(itemId) === node.moduleId),
                ).map((template) => {
                  const relevantItems = template.priorityItems.filter(
                    (itemId) => itemIdToModule(itemId) === node.moduleId,
                  );
                  return (
                    <div key={template.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background">
                      <Sparkles className="w-3 h-3 text-[#a78bfa] flex-shrink-0" />
                      <span className="text-xs text-text">{template.label}</span>
                      <span className="text-2xs text-text-muted">{relevantItems.length} priority items</span>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}
        </div>
      </SurfaceCard>
    </motion.div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-background rounded-md px-2.5 py-2 text-center">
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
      <div className="text-2xs text-text-muted">{label}</div>
    </div>
  );
}

function CollapsibleSection({
  title,
  count,
  color,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
      >
        <span className="text-xs font-semibold text-text">{title}</span>
        <span className="text-2xs font-medium px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}15` }}>
          {count}
        </span>
        <span className="ml-auto text-text-muted">
          {isOpen ? <X className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: MOTION.fast }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

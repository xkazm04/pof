'use client';

import { useState, useCallback } from 'react';
import { ClipboardCheck, PlugZap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_WARNING, withOpacity, OPACITY_5, OPACITY_8,
} from '@/lib/chart-colors';
import { STATUS_TOKENS, type StatusLevel } from '@/lib/status-token';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { StatusTag } from '@/components/ui/StatusTag';
import { SectionLabel } from '../../unique-tabs/_shared';
import type { TagAuditBreakdown } from '@/lib/ability/tag-audit';
import { useSpellbookData } from '../_shared/context';
import { TagQuickViewPopover } from './TagQuickViewPopover';

interface BreakdownCard {
  key: keyof Pick<TagAuditBreakdown, 'matched' | 'undeclared' | 'orphaned'>;
  label: string;
  level: StatusLevel;
  detail: string;
}

const BREAKDOWN_CARDS: BreakdownCard[] = [
  { key: 'matched', label: 'Matched', level: 'ok', detail: 'Declared in C++ and referenced by a rule' },
  { key: 'undeclared', label: 'Undeclared', level: 'bad', detail: 'Referenced by a rule but never declared' },
  { key: 'orphaned', label: 'Orphaned', level: 'warn', detail: 'Declared in C++ but referenced by no rule' },
];

/** Derived score + explainable breakdown (live sync active). */
function AuditResult({ audit }: { audit: TagAuditBreakdown }) {
  return (
    <>
      <div className="flex items-center gap-4 mb-3">
        <ScoreRing value={audit.score} size={48} />
        <div>
          <div className="text-sm font-bold text-text">Tag Hygiene Score</div>
          <div className="text-sm text-text-muted">
            {audit.score}/100 — {audit.matched.length} matched,{' '}
            {audit.undeclared.length} undeclared, {audit.orphaned.length} orphaned across{' '}
            {audit.declaredCount} declared / {audit.referencedCount} referenced tags
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        {BREAKDOWN_CARDS.map((card, i) => {
          const token = STATUS_TOKENS[card.level];
          const tags = audit[card.key];
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-surface-deep border rounded-lg p-3"
              style={{ borderColor: token.border }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-mono font-bold text-text">{card.label}</span>
                <StatusTag level={card.level} />
              </div>
              <div className="text-lg font-mono font-bold mb-1" style={{ color: token.color }}>{tags.length}</div>
              <div className="text-sm text-text-muted leading-tight mb-1">{card.detail}</div>
              {tags.length > 0 && (
                <details className="mt-1.5">
                  <summary className="text-xs font-mono text-text-muted cursor-pointer select-none hover:text-text">
                    {tags.length === 1 ? 'View tag' : `View ${tags.length} tags`}
                  </summary>
                  <ul className="mt-1.5 space-y-0.5">
                    {tags.map((t) => (
                      <li key={t} className="text-xs font-mono text-text-muted truncate" title={t}>{t}</li>
                    ))}
                  </ul>
                </details>
              )}
            </motion.div>
          );
        })}
      </div>
    </>
  );
}

/** Honest not-synced state — never the old hardcoded 85. */
function NotSyncedState() {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border p-3 mb-3"
      style={{ borderColor: STATUS_TOKENS.warn.border, backgroundColor: STATUS_TOKENS.warn.bg }}
    >
      <PlugZap className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: STATUS_WARNING }} aria-hidden />
      <div>
        <div className="flex items-center gap-2 mb-1">
          <StatusTag level="warn" word="NOT SYNCED" />
        </div>
        <div className="text-sm text-text-muted leading-tight">
          The audit is derived from live UE5 source — declared gameplay tags vs. tags
          referenced by ability rules. Connect the UE5 source (the{' '}
          <span className="font-mono text-text">Live from UE5</span> sync above) to compute it.
          No score is shown until a real delta is available.
        </div>
      </div>
    </div>
  );
}

export function TagAuditSection() {
  const { isLive, TAG_AUDIT, TAG_USAGE_FREQUENCY, TAG_DETAIL_MAP } = useSpellbookData();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag(prev => prev === tag ? null : tag);
  }, []);

  const handlePopoverClose = useCallback(() => {
    setSelectedTag(null);
  }, []);

  const maxUsage = Math.max(1, ...TAG_USAGE_FREQUENCY.map(t => t.count));

  return (
    <div className="space-y-4">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: withOpacity(STATUS_WARNING, OPACITY_5) }} />
        <SectionLabel icon={ClipboardCheck} label="Tag Audit Dashboard" color={STATUS_WARNING} />
        <p className="text-sm text-text-muted mt-1 mb-4">
          Reconciles gameplay tags declared in C++ source against the tags referenced by ability rules.
        </p>

        {isLive && TAG_AUDIT ? <AuditResult audit={TAG_AUDIT} /> : <NotSyncedState />}

        {/* Tag usage frequency */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-bold uppercase tracking-widest text-text-muted">Tag Usage Frequency (Top 10)</span>
          {!isLive && (
            <span className="text-xs font-mono text-text-muted/80 normal-case tracking-normal">· illustrative (static)</span>
          )}
        </div>
        <div className="space-y-1.5">
          {TAG_USAGE_FREQUENCY.slice(0, 10).map((item, i) => {
            const detail = TAG_DETAIL_MAP[item.tag];
            const barColor = detail?.color ?? MODULE_COLORS.content;
            return (
              <div key={item.tag} className="relative">
                <motion.button
                  type="button"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 w-full text-left rounded-sm transition-colors hover:bg-surface-hover/40 cursor-pointer"
                  style={selectedTag === item.tag ? { backgroundColor: withOpacity(barColor, OPACITY_8) } : undefined}
                  onClick={() => handleTagClick(item.tag)}
                >
                  <span className="text-sm font-mono text-text-muted w-36 truncate flex-shrink-0 text-right">{item.tag}</span>
                  <div className="flex-1 h-4 bg-surface-deep/50 rounded-sm overflow-hidden border border-border/30">
                    <motion.div
                      className="h-full rounded-sm"
                      style={{ backgroundColor: barColor, width: `${(item.count / maxUsage) * 100}%`, opacity: 0.7 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.count / maxUsage) * 100}%` }}
                      transition={{ delay: i * 0.04 + 0.2, duration: 0.4 }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-text w-6 text-right">{item.count}</span>
                </motion.button>
                <AnimatePresence>
                  {selectedTag === item.tag && detail && (
                    <TagQuickViewPopover tag={item.tag} detail={detail} onClose={handlePopoverClose} />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, PipelineFlow } from '../_shared';
import type { AuditCategory, TagDetail } from './data';
import { useSpellbookData } from './context';

export function TagAuditSection() {
  const { TAG_AUDIT_CATEGORIES, TAG_USAGE_FREQUENCY, TAG_AUDIT_SCORE, TAG_DETAIL_MAP } = useSpellbookData();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag(prev => prev === tag ? null : tag);
  }, []);

  const handlePopoverClose = useCallback(() => {
    setSelectedTag(null);
  }, []);

  const statusColor = (status: AuditCategory['status']) => {
    switch (status) {
      case 'pass': return STATUS_SUCCESS;
      case 'warning': return STATUS_WARNING;
      case 'error': return STATUS_ERROR;
    }
  };

  const statusIcon = (status: AuditCategory['status']) => {
    switch (status) {
      case 'pass': return 'PASS';
      case 'warning': return 'WARN';
      case 'error': return 'FAIL';
    }
  };

  const maxUsage = Math.max(...TAG_USAGE_FREQUENCY.map(t => t.count));

  return (
    <div className="space-y-4">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={ClipboardCheck} label="Tag Audit Dashboard" color={STATUS_WARNING} />
        <p className="text-sm text-text-muted mt-1 mb-4">
          Automated analysis of tag health across the Gameplay Tag hierarchy.
        </p>

        {/* Audit score */}
        <div className="flex items-center gap-4 mb-3">
          <div className="relative w-12 h-12">
            <svg width={48} height={48} viewBox="0 0 48 48">
              <circle cx={24} cy={24} r={20} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
              <circle
                cx={24} cy={24} r={20} fill="none"
                stroke={TAG_AUDIT_SCORE >= 80 ? STATUS_SUCCESS : TAG_AUDIT_SCORE >= 60 ? STATUS_WARNING : STATUS_ERROR}
                strokeWidth={4}
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - TAG_AUDIT_SCORE / 100)}
                strokeLinecap="round"
                transform="rotate(-90 24 24)"
                style={{ filter: `drop-shadow(0 0 6px ${STATUS_SUCCESS})` }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-mono font-bold" style={{ color: STATUS_SUCCESS }}>{TAG_AUDIT_SCORE}</span>
            </div>
          </div>
          <div>
            <div className="text-sm font-bold text-text">Overall Audit Score</div>
            <div className="text-sm text-text-muted">{TAG_AUDIT_SCORE}/100 - Good health, minor issues detected</div>
          </div>
        </div>

        {/* Audit categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {TAG_AUDIT_CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-surface-deep border rounded-lg p-3"
              style={{ borderColor: `${statusColor(cat.status)}30` }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-mono font-bold text-text">{cat.name}</span>
                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${statusColor(cat.status)}20`, color: statusColor(cat.status) }}
                >
                  {statusIcon(cat.status)}
                </span>
              </div>
              <div className="text-lg font-mono font-bold mb-1" style={{ color: statusColor(cat.status) }}>{cat.count}</div>
              <div className="text-sm text-text-muted leading-tight">{cat.detail}</div>
            </motion.div>
          ))}
        </div>

        {/* Tag usage frequency */}
        <div className="text-sm font-bold uppercase tracking-widest text-text-muted mb-3">Tag Usage Frequency (Top 10)</div>
        <div className="space-y-1.5">
          {TAG_USAGE_FREQUENCY.map((item, i) => {
            const detail = TAG_DETAIL_MAP[item.tag];
            const barColor = detail?.color ?? MODULE_COLORS.content;
            return (
              <div key={item.tag} className="relative">
                <motion.button
                  type="button"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 w-full text-left rounded-sm transition-colors hover:bg-surface-hover/40 cursor-pointer"
                  style={selectedTag === item.tag ? { backgroundColor: `${barColor}10` } : undefined}
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

/* ── Tag Quick-View Popover ────────────────────────────────────────────── */

function TagQuickViewPopover({ tag, detail, onClose }: { tag: string; detail: TagDetail; onClose: () => void }) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={popoverRef}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute z-50 bg-surface border border-border/40 rounded-lg shadow-2xl p-3 w-72"
      style={{ top: '100%', left: 0, marginTop: 4 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: detail.color, boxShadow: `0 0 6px ${detail.color}60` }} />
        <span className="text-sm font-bold text-text">{detail.name}</span>
        <span className="text-2xs font-mono text-text-muted ml-auto bg-surface-deep px-1.5 py-0.5 rounded border border-border/40">{detail.prefix}</span>
      </div>

      {/* Properties */}
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono text-text-muted">Tag</span>
          <span className="font-mono font-bold text-text">{tag}</span>
        </div>
        {detail.cooldown && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-text-muted">Cooldown</span>
            <span className="font-mono font-bold" style={{ color: MODULE_COLORS.content }}>{detail.cooldown}</span>
          </div>
        )}
        {detail.manaCost !== undefined && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-text-muted">Mana Cost</span>
            <span className="font-mono font-bold" style={{ color: MODULE_COLORS.core }}>{detail.manaCost === 0 ? 'None' : detail.manaCost}</span>
          </div>
        )}
      </div>

      {/* Blocking tags */}
      {detail.blockingTags.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-bold uppercase tracking-widest text-text-muted mb-1">Blocked By</div>
          <div className="flex flex-wrap gap-1">
            {detail.blockingTags.map(bt => (
              <span key={bt} className="text-xs font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                {bt}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mini PipelineFlow */}
      <div>
        <div className="text-sm font-bold uppercase tracking-widest text-text-muted mb-1.5">Lifecycle</div>
        <PipelineFlow steps={detail.lifecycle} accent={detail.color} />
      </div>
    </motion.div>
  );
}

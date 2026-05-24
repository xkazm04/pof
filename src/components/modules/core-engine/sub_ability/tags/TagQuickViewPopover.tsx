'use client';

import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_RED,
  withOpacity, OPACITY_8, OPACITY_20, OPACITY_37,
} from '@/lib/chart-colors';
import { PipelineFlow } from '../../unique-tabs/_shared';
import type { TagDetail } from '../_shared/data';

/* ── Tag Quick-View Popover ────────────────────────────────────────────── */

export function TagQuickViewPopover({ tag, detail, onClose }: { tag: string; detail: TagDetail; onClose: () => void }) {
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
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: detail.color, boxShadow: `0 0 6px ${withOpacity(detail.color, OPACITY_37)}` }} />
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
              <span key={bt} className="text-xs font-mono px-1.5 py-0.5 rounded border"
                style={{ backgroundColor: withOpacity(ACCENT_RED, OPACITY_8), color: ACCENT_RED, borderColor: withOpacity(ACCENT_RED, OPACITY_20) }}>
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

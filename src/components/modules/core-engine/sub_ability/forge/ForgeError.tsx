'use client';

import { useState } from 'react';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  OVERLAY_WHITE, OPACITY_5, OPACITY_8, OPACITY_25, OPACITY_30, withOpacity,
} from '@/lib/chart-colors';
import type { ForgeErrorInfo } from './forge-error';

/* ── Friendly, actionable error card with one-tap retry ───────────────── */

export function ForgeError({ info, isRetrying, onRetry }: {
  info: ForgeErrorInfo;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const Icon = info.icon;

  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-lg border px-3 py-3"
      style={{
        borderColor: withOpacity(info.color, OPACITY_25),
        background: withOpacity(info.color, OPACITY_5),
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-md shrink-0"
          style={{ background: withOpacity(info.color, OPACITY_8) }}
        >
          <Icon size={14} style={{ color: info.color }} />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="text-xs font-semibold" style={{ color: info.color }}>
            {info.headline}
          </div>
          <div className="text-[12px] text-zinc-300 leading-relaxed">
            {info.message}
          </div>
          {info.tip && (
            <div className="text-[11px] text-zinc-500 leading-relaxed">
              {info.tip}
            </div>
          )}

          {info.detail && (
            <button
              type="button"
              onClick={() => setShowDetail(v => !v)}
              className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-600 hover:text-zinc-400 transition-colors mt-1"
              aria-expanded={showDetail}
            >
              {showDetail ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              Technical detail
            </button>
          )}
          {showDetail && info.detail && (
            <pre
              className="mt-1 p-2 rounded text-[10px] font-mono text-zinc-400 whitespace-pre-wrap break-words"
              style={{ background: withOpacity(OVERLAY_WHITE, OPACITY_5) }}
            >
              {info.detail}
            </pre>
          )}
        </div>

        {info.retryable && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono font-medium shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: withOpacity(info.color, OPACITY_8),
              color: info.color,
              border: `1px solid ${withOpacity(info.color, OPACITY_30)}`,
            }}
          >
            <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
            {isRetrying ? 'Retrying…' : 'Retry'}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

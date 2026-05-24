'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_RED, ACCENT_GREEN,
  OVERLAY_WHITE, OPACITY_3, OPACITY_10, withOpacity,
} from '@/lib/chart-colors';
import {
  diffLines, summarizeLines, collapseDiff,
  type DiffRow,
} from './ability-diff';

const LINE_COLOR = { add: ACCENT_GREEN, del: ACCENT_RED, eq: undefined } as const;

/* ── Collapsible unified code diff for one file ──────────────────────── */

export function CodeDiff({ filename, lines }: { filename: string; lines: ReturnType<typeof diffLines> }) {
  const [open, setOpen] = useState(false);
  const { added, removed } = summarizeLines(lines);
  const rows = useMemo<DiffRow[]>(() => collapseDiff(lines, 2), [lines]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800 hover:bg-zinc-900 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-zinc-400">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {filename}
        </span>
        <span className="flex items-center gap-2 text-xs font-mono tabular-nums">
          {added > 0 && <span style={{ color: ACCENT_GREEN }}>+{added}</span>}
          {removed > 0 && <span style={{ color: ACCENT_RED }}>−{removed}</span>}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-xs leading-relaxed font-mono bg-zinc-950/50 max-h-[360px] overflow-y-auto custom-scrollbar">
              {rows.map((row, i) =>
                row.type === 'gap' ? (
                  <div
                    key={`gap-${i}`}
                    className="px-3 py-0.5 text-[10px] text-zinc-600 select-none"
                    style={{ background: withOpacity(OVERLAY_WHITE, OPACITY_3) }}
                  >
                    ⋯ {row.count} unchanged line{row.count === 1 ? '' : 's'}
                  </div>
                ) : (
                  <div
                    key={`l-${i}`}
                    className="px-3 whitespace-pre-wrap break-words"
                    style={{
                      color: LINE_COLOR[row.type] ?? 'var(--text-muted)',
                      background:
                        row.type === 'add' ? withOpacity(ACCENT_GREEN, OPACITY_10)
                        : row.type === 'del' ? withOpacity(ACCENT_RED, OPACITY_10)
                        : 'transparent',
                    }}
                  >
                    <span className="select-none text-zinc-600 mr-2">
                      {row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' '}
                    </span>
                    {row.text || ' '}
                  </div>
                ),
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

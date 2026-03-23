'use client';

import { AnimatePresence, motion } from 'framer-motion';

/* ── CalcInput ─ Numeric input for the damage calculator ──────────────────── */

export function CalcInput({ value, onChange, step = 1, min, max, label }: {
  value: number; onChange: (v: number) => void; step?: number;
  min?: number; max?: number; label: string;
}) {
  return (
    <input type="number" value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      step={step} min={min} max={max} aria-label={label}
      className="w-16 bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-xs font-mono text-center text-text focus:outline-none focus:border-blue-500/50" />
  );
}

/* ── ExecPhaseHeader ─ Phase label with colored left border ───────────────── */

export function ExecPhaseHeader({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 mt-0.5"
      style={{ borderLeft: `2px solid ${color}` }}>
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

/* ── ExecPropRow ─ Expandable property row with C++ code reveal ───────────── */

export function ExecPropRow({ name, code, codeExpanded, onToggleCode, even, children }: {
  name: string; code?: string; codeExpanded?: boolean;
  onToggleCode?: () => void; even?: boolean; children?: React.ReactNode;
}) {
  return (
    <div style={{ backgroundColor: even ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
      <div className="flex items-center justify-between px-3 py-1 min-h-[28px]">
        <div className="flex items-center gap-1.5">
          {code && onToggleCode && (
            <button onClick={onToggleCode}
              className="text-text-muted hover:text-text text-xs transition-colors leading-none">
              {codeExpanded ? '\u25BE' : '\u25B8'}
            </button>
          )}
          <span className="text-xs font-mono text-text-muted">{name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">{children}</div>
      </div>
      <AnimatePresence>
        {code && codeExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden">
            <pre className="text-2xs font-mono text-text-muted/80 leading-relaxed px-3 pb-1.5 pl-7 whitespace-pre-wrap">
              {code}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

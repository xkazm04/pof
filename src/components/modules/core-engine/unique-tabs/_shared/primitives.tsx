'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { UI_TIMEOUTS } from '@/lib/constants';
import { motion, useReducedMotion } from 'framer-motion';
import {
  STATUS_SUCCESS,
  OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_20, OPACITY_30, OPACITY_37, OPACITY_50,
  GLOW_SM, GLOW_MD,
  withOpacity,
} from '@/lib/chart-colors';
import type { FeatureStatus } from '@/types/feature-matrix';
import { STATUS_COLORS } from './constants';

/* ── PipelineFlow ─────────────────────────────────────────────────────────── */

interface PipelineStep {
  label: string;
  status?: FeatureStatus;
}

interface PipelineFlowProps {
  steps: (string | PipelineStep)[];
  accent: string;
  showStatus?: boolean;
}

export function PipelineFlow({ steps, accent, showStatus }: PipelineFlowProps) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((step, i, arr) => {
        const label = typeof step === 'string' ? step : step.label;
        const status = typeof step === 'string' ? undefined : step.status;
        const sc = status ? STATUS_COLORS[status] : undefined;
        const isLast = i === arr.length - 1;

        return (
          <motion.div
            key={label}
            initial={prefersReduced ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={prefersReduced ? { duration: 0 } : { delay: i * 0.1 }}
            className="flex items-center gap-1"
          >
            <div
              className="flex items-center gap-1.5 text-sm font-mono px-2 py-0.5 rounded-md"
              style={{
                backgroundColor: withOpacity(accent, OPACITY_8),
                color: accent,
                border: `1px solid ${withOpacity(accent, OPACITY_20)}`,
                boxShadow: `inset 0 0 10px ${withOpacity(accent, OPACITY_5)}`
              }}
            >
              {showStatus && sc && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot, boxShadow: `${GLOW_SM} ${sc.dot}` }} />
              )}
              {label}
            </div>
            {!isLast && (
              <div className="relative w-4 h-[2px] bg-border overflow-hidden rounded-full">
                {prefersReduced ? (
                  <div className="absolute inset-0 bg-current opacity-40" style={{ color: accent }} />
                ) : (
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-current"
                    style={{ color: accent }}
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: i * 0.2 }}
                  />
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── SectionLabel ─────────────────────────────────────────────────────────── */

interface SectionLabelProps {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  /** Hex color for the icon (also drives the soft drop-shadow glow). */
  color?: string;
  /**
   * Optional Tailwind color utility for the icon — used when migrating
   * legacy variant-A panels that used `text-{color}-400` inline tints.
   * Takes precedence over the `color` style if both are passed.
   */
  iconClassName?: string;
  /** Extra classes on the wrapper (e.g. spacing tokens like `DZIN_SPACING.full.sectionMb`). */
  className?: string;
  /** Type scale: `xs` matches the dzin variant-A header rhythm; `sm` (default) matches the existing tab usage. */
  size?: 'xs' | 'sm';
}

export function SectionLabel({
  icon: Icon,
  label,
  color,
  iconClassName,
  className = '',
  size = 'sm',
}: SectionLabelProps) {
  const textSize = size === 'xs' ? 'text-xs gap-2' : 'text-sm gap-1.5';
  const iconSize = size === 'xs' ? 'w-4 h-4' : 'w-3 h-3';
  const iconClass = iconClassName ? `${iconSize} ${iconClassName}` : iconSize;
  const iconStyle = !iconClassName && color
    ? { color, filter: `drop-shadow(${GLOW_SM} ${withOpacity(color, OPACITY_50)})` }
    : undefined;

  return (
    <div className={`flex items-center ${textSize} text-text-muted font-bold uppercase tracking-wider ${className}`}>
      {Icon && <Icon className={iconClass} style={iconStyle} />}
      {label}
    </div>
  );
}

/* ── CopyButton ──────────────────────────────────────────────────────────── */

interface CopyButtonProps {
  /** Returns the text to copy — called on click so the value is always fresh. */
  getText: () => string;
  /** Accent color used for the idle state. Defaults to the current text color. */
  accent?: string;
  /** Label shown next to the icon. Defaults to "Copy" / "Copied". */
  label?: { idle?: string; copied?: string };
  className?: string;
}

export function CopyButton({ getText, accent, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(getText());
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [getText]);

  const idleLabel = label?.idle ?? 'Copy';
  const copiedLabel = label?.copied ?? 'Copied';

  // Pill variant (with accent color)
  if (accent) {
    return (
      <button
        onClick={handleCopy}
        aria-label={copied ? copiedLabel : idleLabel}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-mono font-bold transition-all border focus:outline-none focus:ring-1 focus:ring-current ${className ?? ''}`}
        style={{
          borderColor: copied ? `${STATUS_SUCCESS}${OPACITY_30}` : `${accent}${OPACITY_30}`,
          color: copied ? STATUS_SUCCESS : accent,
          backgroundColor: copied ? `${STATUS_SUCCESS}${OPACITY_10}` : `${accent}${OPACITY_10}`,
        }}
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? copiedLabel : idleLabel}
      </button>
    );
  }

  // Minimal variant (no accent — icon-only style like CodeBlock)
  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? copiedLabel : idleLabel}
      className={`flex items-center gap-1 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none focus:ring-1 focus:ring-current ${className ?? ''}`}
    >
      {copied ? <Check size={12} style={{ color: STATUS_SUCCESS }} /> : <Copy size={12} />}
      {copied ? copiedLabel : idleLabel}
    </button>
  );
}

/* ── EmptyPanel ───────────────────────────────────────────────────────────── */

/**
 * Lightweight empty-state placeholder for chart/data panels inside the unique
 * tabs. Used as a short-circuit when `data.length` falls below the chart's
 * minimum (typically 1 or 2). Compact enough to fit inside a SurfaceCard
 * level=2 without disrupting the surrounding grid.
 */
export function EmptyPanel({
  label,
  hint,
  height = 120,
}: {
  label: string;
  hint?: string;
  height?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-4 rounded-md border border-dashed border-border/60 bg-surface-deep/40"
      style={{ minHeight: height }}
      role="status"
    >
      <p className="text-xs font-medium text-text-muted">{label}</p>
      {hint && <p className="text-2xs text-text-muted/70 mt-1 max-w-xs">{hint}</p>}
    </div>
  );
}

/* ── LoadingSpinner ───────────────────────────────────────────────────────── */

export function LoadingSpinner({ accent }: { accent: string }) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="flex items-center justify-center py-8">
      {prefersReduced ? (
        <div
          className="w-8 h-8 rounded-full"
          style={{
            border: `2px solid ${withOpacity(accent, OPACITY_20)}`,
            borderTopColor: accent,
            filter: `drop-shadow(${GLOW_MD} ${withOpacity(accent, OPACITY_37)})`,
          }}
        />
      ) : (
        <motion.div
          className="w-8 h-8 rounded-full"
          style={{
            border: `2px solid ${withOpacity(accent, OPACITY_20)}`,
            borderTopColor: accent,
            filter: `drop-shadow(${GLOW_MD} ${withOpacity(accent, OPACITY_37)})`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
}

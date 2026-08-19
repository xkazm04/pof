'use client';

import { ReactNode, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  OPACITY_10, OPACITY_37,
  GLOW_SM,
  withOpacity,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

/* ── NarrativeBreadcrumb ─────────────────────────────────────────────────── */

export interface NarrativeBreadcrumbStep<T extends string = string> {
  /** Subtab key this breadcrumb navigates to. */
  key: T;
  /** Human-readable label shown in the breadcrumb. */
  narrative: string;
}

export interface NarrativeBreadcrumbProps<T extends string = string> {
  steps: ReadonlyArray<NarrativeBreadcrumbStep<T>>;
  activeKey: T;
  accent: string;
  onNavigate: (key: T) => void;
}

/** Horizontal "Catalog > Step > Step" breadcrumb that doubles as subtab navigation. */
export function NarrativeBreadcrumb<T extends string = string>({
  steps, activeKey, accent, onNavigate,
}: NarrativeBreadcrumbProps<T>) {
  const activeIdx = steps.findIndex(s => s.key === activeKey);
  return (
    <div className="flex items-center gap-0.5 text-[10px] font-mono tracking-wide overflow-x-auto custom-scrollbar pb-0.5">
      {steps.map((step, i) => {
        const isPast = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center gap-0.5 flex-shrink-0">
            {i > 0 && <span className="text-text-subtle mx-0.5">{'>'}</span>}
            <button
              onClick={() => onNavigate(step.key)}
              className="px-1.5 py-0.5 rounded transition-all cursor-pointer"
              style={{
                color: isActive ? accent : isPast ? withOpacity(accent, '99') : 'var(--text-muted)',
                backgroundColor: isActive ? withOpacity(accent, OPACITY_10) : 'transparent',
                fontWeight: isActive ? 700 : isPast ? 600 : 400,
                opacity: !isActive && !isPast ? 0.5 : 1,
              }}
            >
              {step.narrative}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ── SegmentedControl ────────────────────────────────────────────────────── */

export interface SegmentedControlProps {
  options: { id: string; label: string; icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[];
  activeId: string;
  onChange: (id: string) => void;
  accent: string;
}

/* ── CollapsibleSection ──────────────────────────────────────────────────── */

export interface CollapsibleSectionProps {
  title: string;
  color: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Optional icon — when omitted, a colored dot is shown instead. */
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** Optional data-testid for the wrapper. */
  testId?: string;
  /** 'card' wraps in SurfaceCard, 'bordered' uses a plain bordered div. Default: 'card'. */
  variant?: 'card' | 'bordered';
}

export function CollapsibleSection({
  title, color, children, defaultOpen = false, icon: Icon, testId, variant = 'card',
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const prefersReduced = useReducedMotion();

  const Wrapper = variant === 'card' ? SurfaceCard : 'div';
  const wrapperProps = variant === 'card'
    ? { level: 2 as const, className: 'relative overflow-hidden', ...(testId ? { 'data-testid': testId } : {}) }
    : { className: 'border border-border/30 rounded-lg overflow-hidden', ...(testId ? { 'data-testid': testId } : {}) };

  return (
    <Wrapper {...wrapperProps}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-surface-hover/30 transition-colors"
        {...(testId ? { 'data-testid': `${testId}-toggle` } : {})}
      >
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20 }}>
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        </motion.div>
        {Icon
          ? <Icon className="w-3.5 h-3.5" style={{ color }} />
          : <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `${GLOW_SM} ${withOpacity(color, OPACITY_37)}` }} />
        }
        <span className="text-xs font-semibold text-text">{title}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={prefersReduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={prefersReduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Wrapper>
  );
}

/* ── SegmentedControl ────────────────────────────────────────────────────── */

export function SegmentedControl({ options, activeId, onChange, accent }: SegmentedControlProps) {
  return (
    <div className="flex bg-surface-deep p-1 rounded-lg border border-border/40 overflow-x-auto custom-scrollbar w-fit">
      {options.map((opt) => {
        const isActive = activeId === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`relative flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none whitespace-nowrap
              ${isActive ? 'text-white' : 'text-text-muted hover:text-text'}
            `}
          >
            {isActive && (
              <motion.div
                layoutId="segmentedControlBg"
                className="absolute inset-0 rounded-md"
                style={{ backgroundColor: accent, opacity: 0.2 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
            )}
            {Icon && <Icon className="w-3.5 h-3.5 relative z-10" style={{ color: isActive ? accent : 'currentColor' }} />}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

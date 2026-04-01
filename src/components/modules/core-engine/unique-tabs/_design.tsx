'use client';

import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MODULE_COLORS, OVERLAY_WHITE } from '@/lib/chart-colors';
import { ANIMATION_PRESETS, motionSafe } from '@/lib/motion';

const DEFAULT_ACCENT = MODULE_COLORS.core;

/* ── Corner Brackets ─ HUD targeting-reticle decoration ───────────────────── */

export function CornerBrackets({ color = DEFAULT_ACCENT, size = 10 }: { color?: string; size?: number }) {
  const s = { width: size, height: size };
  const bc = `1.5px solid ${color}35`;
  return (
    <>
      <span className="absolute top-0 left-0 pointer-events-none" style={{ ...s, borderTop: bc, borderLeft: bc }} />
      <span className="absolute top-0 right-0 pointer-events-none" style={{ ...s, borderTop: bc, borderRight: bc }} />
      <span className="absolute bottom-0 left-0 pointer-events-none" style={{ ...s, borderBottom: bc, borderLeft: bc }} />
      <span className="absolute bottom-0 right-0 pointer-events-none" style={{ ...s, borderBottom: bc, borderRight: bc }} />
    </>
  );
}

/* ── Scanline Overlay ─ Subtle horizontal CRT lines ───────────────────────── */

export function ScanlineOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${OVERLAY_WHITE}03 3px, ${OVERLAY_WHITE}03 4px)`,
    }} />
  );
}

/* ── Blueprint Panel ─ Primary card with HUD chrome ───────────────────────── */

export function BlueprintPanel({
  children, color = DEFAULT_ACCENT, className = '', noBrackets = false,
}: { children: ReactNode; color?: string; className?: string; noBrackets?: boolean }) {
  return (
    <div className={`relative rounded-lg border bg-surface-deep overflow-hidden ${className}`}
      style={{ borderColor: `${color}18` }}>
      {!noBrackets && <CornerBrackets color={color} />}
      <ScanlineOverlay />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

/* ── Section Header ─ Label with animated gradient rule ───────────────────── */

export function SectionHeader({ label, color = DEFAULT_ACCENT, icon: Icon }: {
  label: string; color?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="flex items-center gap-1.5 mb-3">
      {Icon && (
        <div className="p-1.5 rounded-md" style={{ backgroundColor: `${color}12` }}>
          <Icon className="w-3.5 h-3.5" style={{ color, filter: `drop-shadow(0 0 6px ${color})` }} />
        </div>
      )}
      <span className="text-xs font-mono font-bold uppercase tracking-wider"
        style={{ color, textShadow: `0 0 20px ${color}30` }}>{label}</span>
      <motion.div
        initial={prefersReduced ? { scaleX: 1 } : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={motionSafe({ ...ANIMATION_PRESETS.fill, duration: 0.8 }, prefersReduced)}
        className="flex-1 h-px origin-left"
        style={{ background: `linear-gradient(90deg, ${color}30, transparent)` }}
      />
    </div>
  );
}

/* ── Glow Stat ─ Numeric readout with hover glow ──────────────────────────── */

export function GlowStat({ label, value, unit, color, delay = 0 }: {
  label: string; value: string | number; unit?: string; color: string; delay?: number;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionSafe({ ...ANIMATION_PRESETS.entrance, delay }, prefersReduced)}
      className="relative p-3 rounded-lg border overflow-hidden group"
      style={{ borderColor: `${color}20`, backgroundColor: `${color}08` }}>
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{ backgroundColor: `${color}25` }} />
      <div className="text-xs font-mono uppercase tracking-wider mb-1.5 text-text-muted">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-mono font-bold tabular-nums leading-none"
          style={{ color, textShadow: `0 0 12px ${color}40` }}>{value}</span>
        {unit && <span className="text-xs font-mono uppercase tracking-wider text-text-muted">{unit}</span>}
      </div>
    </motion.div>
  );
}

/* ── Neon Bar ─ Animated progress bar with glow ───────────────────────────── */

export function NeonBar({ pct, color, height = 6, glow = false }: {
  pct: number; color: string; height?: number; glow?: boolean;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, backgroundColor: `${color}12` }}>
      <motion.div
        initial={prefersReduced ? { width: `${Math.min(100, pct)}%` } : { width: 0 }}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={motionSafe(ANIMATION_PRESETS.fill, prefersReduced)}
        className="h-full rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: glow ? `0 0 8px ${color}60, 0 0 2px ${color}` : 'none',
        }}
      />
    </div>
  );
}

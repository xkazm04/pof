'use client';

import { type CSSProperties, ReactNode, useMemo, useState, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Copy, Check } from 'lucide-react';
import { UI_TIMEOUTS } from '@/lib/constants';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_IMPROVED,
  OPACITY_8, OPACITY_10, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type {
  RadarDataPoint, TimelineEvent, HeatmapCell,
  GaugeMetric, DiffEntry, TagCloudItem,
} from '@/types/unique-tab-improvements';

/* ── Stagger Animation Variants ───────────────────────────────────────────── */

import { ANIMATION_PRESETS } from '@/lib/motion';

/** Stagger delay (seconds) for default grid/list item entrance */
export const STAGGER_DEFAULT = ANIMATION_PRESETS.stagger.default;

/** Stagger delay (seconds) for slower, more dramatic item entrance */
export const STAGGER_SLOW = ANIMATION_PRESETS.stagger.slow;

/* ── Shared STATUS_COLORS ─────────────────────────────────────────────────── */

export const STATUS_COLORS: Record<FeatureStatus, { dot: string; bg: string; label: string }> = {
  implemented: { dot: STATUS_SUCCESS, bg: `${STATUS_SUCCESS}${OPACITY_8}`, label: 'Implemented' },
  improved: { dot: STATUS_IMPROVED, bg: `${STATUS_IMPROVED}${OPACITY_8}`, label: 'Improved' },
  partial: { dot: STATUS_WARNING, bg: `${STATUS_WARNING}${OPACITY_8}`, label: 'Partial' },
  missing: { dot: STATUS_ERROR, bg: `${STATUS_ERROR}${OPACITY_8}`, label: 'Missing' },
  unknown: { dot: '#64748b', bg: '#64748b18', label: 'Unknown' },
};

/* ── Safe status lookup ───────────────────────────────────────────────────── */

const FALLBACK_STATUS = STATUS_COLORS.unknown;

/** Returns dot color + label for a FeatureStatus, falling back to 'unknown' for unrecognized values. */
export function statusInfo(status: FeatureStatus | undefined): { color: string; label: string } {
  const sc = (status && STATUS_COLORS[status]) || FALLBACK_STATUS;
  return { color: sc.dot, label: sc.label };
}

/* ── StatusDot ────────────────────────────────────────────────────────────── */

export function StatusDot({ status }: { status: FeatureStatus }) {
  const sc = STATUS_COLORS[status];
  const isActive = status === 'implemented' || status === 'improved';
  const prefersReduced = useReducedMotion();
  return (
    <span className="flex items-center gap-1.5">
      <motion.span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: sc.dot, boxShadow: isActive ? `0 0 6px ${sc.dot}` : 'none' }}
        animate={isActive && !prefersReduced ? { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] } : {}}
        transition={prefersReduced ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="text-xs font-medium" style={{ color: sc.dot }}>{sc.label}</span>
    </span>
  );
}

/* ── TabHeader ────────────────────────────────────────────────────────────── */

interface TabHeaderProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  implemented: number;
  total: number;
  accent: string;
  children?: ReactNode;
}

export function TabHeader({ icon: Icon, title, implemented, total, accent, children }: TabHeaderProps) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between pb-2 border-b border-border/40"
    >
      <div className="flex items-center gap-1.5">
        <div className="p-1.5 rounded-lg relative overflow-hidden group">
          <div className="absolute inset-0 opacity-20" style={{ backgroundColor: accent }} />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity blur-md" style={{ backgroundColor: accent }} />
          <Icon className="w-4 h-4 relative z-10" style={{ color: accent, filter: `drop-shadow(0 0 4px ${accent}80)` }} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-text tracking-wide">{title}</span>
          <span className="text-sm text-text-muted">
            <span className="font-mono font-medium" style={{ color: implemented === total ? STATUS_SUCCESS : accent }}>{implemented}</span>
            <span className="opacity-60">/{total} deployed</span>
          </span>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

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
                backgroundColor: `${accent}15`,
                color: accent,
                border: `1px solid ${accent}30`,
                boxShadow: `inset 0 0 10px ${accent}10`
              }}
            >
              {showStatus && sc && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot, boxShadow: `0 0 6px ${sc.dot}` }} />
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
  color?: string;
}

export function SectionLabel({ icon: Icon, label, color }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-text-muted font-bold uppercase tracking-wider">
      {Icon && <Icon className="w-3 h-3" style={color ? { color, filter: `drop-shadow(0 0 3px ${color}80)` } : undefined} />}
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
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? copiedLabel : idleLabel}
    </button>
  );
}

/* ── FeatureCard ──────────────────────────────────────────────────────────── */

interface FeatureCardProps {
  name: string;
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
  accent: string;
}

export function FeatureCard({ name, featureMap, defs, expanded, onToggle, accent }: FeatureCardProps) {
  const row = featureMap.get(name);
  const def = defs.find((d) => d.featureName === name);
  const status: FeatureStatus = row?.status ?? 'unknown';
  const sc = STATUS_COLORS[status];
  const isExpanded = expanded === name;
  const prefersReduced = useReducedMotion();

  return (
    <SurfaceCard level={2} className="relative overflow-hidden group">
      {/* Subtle animated gradient background on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${accent}15 0%, transparent 70%)` }}
      />

      <button
        onClick={() => onToggle(name)}
        className="relative z-10 w-full text-left px-2.5 py-1.5 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={prefersReduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 20 }}
            className="flex-shrink-0"
          >
            <ChevronRight className="w-3 h-3 text-text-muted transition-colors group-hover:text-text" />
          </motion.div>
          <span className="text-sm font-semibold text-text truncate group-hover:text-text-bright transition-colors">{name}</span>
          <span className="ml-auto flex items-center gap-1.5 flex-shrink-0 bg-surface px-2 py-0.5 rounded-md border border-border/50 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot, boxShadow: `0 0 6px ${sc.dot}80` }} />
            <span className="text-xs font-medium" style={{ color: sc.dot }}>{sc.label}</span>
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={prefersReduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { opacity: { duration: 0.2 }, height: { duration: 0.3, type: "spring", bounce: 0 } }}
            className="relative z-10 overflow-hidden"
          >
            <div className="px-2.5 pb-2 space-y-1.5 border-t border-border/40 bg-surface/30">
              <p className="text-sm text-text-muted leading-relaxed mt-1.5">
                {def?.description ?? row?.description ?? 'No description available for this feature.'}
              </p>

              {row?.filePaths && row.filePaths.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {row.filePaths.slice(0, 3).map((fp) => (
                    <span
                      key={fp}
                      className="flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${accent}10`, color: accent, border: `1px solid ${accent}30` }}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      {fp.split('/').pop()}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                {row?.qualityScore != null && (
                  <div className="flex items-center gap-1.5 bg-surface px-2 py-1 rounded-md text-xs font-mono border border-border/50">
                    <span className="text-text-muted">Quality:</span>
                    <span className={row.qualityScore >= 8 ? "text-emerald-400" : row.qualityScore >= 5 ? "text-amber-400" : "text-red-400"}>
                      {row.qualityScore}/10
                    </span>
                  </div>
                )}

                {row?.nextSteps && (
                  <div className="text-xs truncate ml-auto border-l-2 pl-2 max-w-[60%]" style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING }}>
                    <span className="opacity-70 font-semibold mr-1">Next:</span>{row.nextSteps}
                  </div>
                )}
              </div>

              {def?.dependsOn && def.dependsOn.length > 0 && (
                <div className="text-xs text-text-muted font-mono pt-1">
                  <span className="opacity-50 font-semibold mr-1">Deps:</span> {def.dependsOn.map((d) => d.replace(/.*::/, '')).join(', ')}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

/* ── FeatureGrid ──────────────────────────────────────────────────────────── */

interface FeatureGridProps {
  featureNames: string[];
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
  accent: string;
}

const gridVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

const reducedGridVariants = {
  hidden: {},
  visible: {},
};

const reducedItemVariants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
};

export function FeatureGrid({ featureNames, featureMap, defs, expanded, onToggle, accent }: FeatureGridProps) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      variants={prefersReduced ? reducedGridVariants : gridVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-1.5"
    >
      {featureNames.map((name) => (
        <motion.div key={name} variants={prefersReduced ? reducedItemVariants : itemVariants}>
          <FeatureCard
            name={name}
            featureMap={featureMap}
            defs={defs}
            expanded={expanded}
            onToggle={onToggle}
            accent={accent}
          />
        </motion.div>
      ))}
    </motion.div>
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
            border: `2px solid ${accent}30`,
            borderTopColor: accent,
            filter: `drop-shadow(0 0 8px ${accent}60)`,
          }}
        />
      ) : (
        <motion.div
          className="w-8 h-8 rounded-full"
          style={{
            border: `2px solid ${accent}30`,
            borderTopColor: accent,
            filter: `drop-shadow(0 0 8px ${accent}60)`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
}

/* ── RadarChart ──────────────────────────────────────────────────────────── */

interface RadarChartProps {
  data: RadarDataPoint[];
  size?: number;
  accent: string;
  overlays?: { data: RadarDataPoint[]; color: string; label: string }[];
  showLabels?: boolean;
}

export function RadarChart({ data, size = 220, accent, overlays, showLabels = true }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;

  const toXY = (value: number, index: number) => {
    const angle = angleStep * index - Math.PI / 2;
    return { x: cx + r * value * Math.cos(angle), y: cy + r * value * Math.sin(angle) };
  };

  const polyPoints = (pts: RadarDataPoint[]) =>
    pts.map((d, i) => { const p = toXY(d.value, i); return `${p.x},${p.y}`; }).join(' ');

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Grid rings */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={data.map((_, i) => { const p = toXY(level, i); return `${p.x},${p.y}`; }).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"
        />
      ))}
      {/* Axis lines */}
      {data.map((_, i) => {
        const p = toXY(1, i);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
      })}
      {/* Overlay polygons */}
      {overlays?.map((overlay) => (
        <polygon
          key={overlay.label}
          points={polyPoints(overlay.data)}
          fill={`${overlay.color}15`} stroke={overlay.color} strokeWidth="1.5" strokeDasharray="4 2"
        />
      ))}
      {/* Primary polygon */}
      <polygon points={polyPoints(data)} fill={`${accent}20`} stroke={accent} strokeWidth="2" />
      {/* Data points */}
      {data.map((d, i) => {
        const p = toXY(d.value, i);
        return <circle key={i} cx={p.x} cy={p.y} r="3" fill={accent} style={{ filter: `drop-shadow(0 0 4px ${accent})` }} />;
      })}
      {/* Labels */}
      {showLabels && data.map((d, i) => {
        const p = toXY(1.15, i);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
            className="text-xs font-mono font-bold uppercase tracking-wider fill-[var(--text-muted)]"
          >
            {d.axis}
          </text>
        );
      })}
    </svg>
  );
}

/* ── TimelineStrip ───────────────────────────────────────────────────────── */

interface TimelineStripProps {
  events: TimelineEvent[];
  accent: string;
  maxVisible?: number;
  height?: number;
}

export function TimelineStrip({ events, accent, maxVisible = 50, height = 100 }: TimelineStripProps) {
  const visible = events.slice(0, maxVisible);
  const minT = visible.length > 0 ? Math.min(...visible.map((e) => e.timestamp)) : 0;
  const maxT = visible.length > 0 ? Math.max(...visible.map((e) => e.timestamp + (e.duration ?? 0))) : 1;
  const range = maxT - minT || 1;

  return (
    <div className="relative w-full overflow-x-auto custom-scrollbar" style={{ height }}>
      {/* Axis line */}
      <div className="absolute bottom-4 left-0 right-0 h-[2px] bg-border/40" />
      {/* Events */}
      {visible.map((evt) => {
        const left = ((evt.timestamp - minT) / range) * 100;
        const width = evt.duration ? ((evt.duration / range) * 100) : undefined;
        return (
          <div
            key={evt.id}
            className="absolute bottom-2"
            style={{ left: `${left}%`, width: width ? `${width}%` : undefined }}
            title={`${evt.label}: ${evt.details ?? evt.category}`}
          >
            {width ? (
              <div className="h-4 rounded-sm opacity-70" style={{ backgroundColor: evt.color, minWidth: 4 }} />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full -ml-1" style={{ backgroundColor: evt.color, boxShadow: `0 0 4px ${evt.color}` }} />
            )}
            <div className="text-sm font-mono text-text-muted mt-0.5 whitespace-nowrap truncate max-w-[60px]">
              {evt.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── HeatmapGrid ─────────────────────────────────────────────────────────── */

interface HeatmapGridProps {
  rows: string[];
  cols: string[];
  cells: HeatmapCell[];
  lowColor?: string;
  highColor?: string;
  accent: string;
  onCellClick?: (row: number, col: number) => void;
}

function interpolateColor(low: string, high: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [lr, lg, lb] = parse(low);
  const [hr, hg, hb] = parse(high);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(lr, hr)}, ${mix(lg, hg)}, ${mix(lb, hb)})`;
}

export function HeatmapGrid({ rows, cols, cells, lowColor = '#1e293b', highColor, accent, onCellClick }: HeatmapGridProps) {
  const high = highColor ?? accent;
  const cellMap = useMemo(() => {
    const m = new Map<string, HeatmapCell>();
    for (const c of cells) m.set(`${c.row}-${c.col}`, c);
    return m;
  }, [cells]);

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="border-collapse text-sm" role="grid" aria-label="Heatmap grid">
        <thead>
          <tr>
            <th className="p-1" />
            {cols.map((c) => (
              <th key={c} className="p-1 font-mono font-bold text-text-muted whitespace-nowrap text-center">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((rowLabel, ri) => (
            <tr key={rowLabel}>
              <td className="p-1 font-mono font-bold text-text-muted whitespace-nowrap text-right pr-2">{rowLabel}</td>
              {cols.map((_, ci) => {
                const cell = cellMap.get(`${ri}-${ci}`);
                const v = cell?.value ?? 0;
                return (
                  <td
                    key={ci}
                    className="p-px outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:rounded-sm"
                    tabIndex={0}
                    role="gridcell"
                    aria-label={cell?.tooltip ?? `${rowLabel} × ${cols[ci]}: ${(v * 100).toFixed(0)}%`}
                    title={cell?.tooltip ?? `${rowLabel} × ${cols[ci]}: ${(v * 100).toFixed(0)}%`}
                    onClick={() => onCellClick?.(ri, ci)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onCellClick?.(ri, ci);
                      }
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-sm cursor-pointer hover:ring-1 hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-white/60 transition-all flex items-center justify-center"
                      style={{ backgroundColor: interpolateColor(lowColor, high, v) }}
                    >
                      {cell?.label && <span className="text-xs font-mono text-white/80">{cell.label}</span>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── LiveMetricGauge ─────────────────────────────────────────────────────── */

interface LiveMetricGaugeProps {
  metric: GaugeMetric;
  size?: number;
  accent?: string;
}

export function LiveMetricGauge({ metric, size = 88, accent }: LiveMetricGaugeProps) {
  const pct = Math.min(metric.current / metric.target, 1.5);
  const clamped = Math.min(pct, 1);
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const color = pct < 0.75 ? STATUS_SUCCESS : pct < 0.95 ? STATUS_WARNING : STATUS_ERROR;
  const finalColor = accent && pct < 0.75 ? accent : color;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={finalColor} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - clamped)}
            strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease-out', filter: `drop-shadow(0 0 4px ${finalColor})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col leading-none">
          <span className="text-sm font-mono font-bold" style={{ color: finalColor }}>{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-mono font-bold text-text-muted uppercase tracking-wider truncate max-w-[80px]">{metric.label}</div>
        <div className="text-sm font-mono text-text">
          {metric.current.toFixed(metric.unit === 'ms' || metric.unit === '%' ? 1 : 0)}
          <span className="text-text-muted text-xs">{metric.unit}</span>
        </div>
      </div>
    </div>
  );
}

/* ── DiffViewer ──────────────────────────────────────────────────────────── */

interface DiffViewerProps {
  entries: DiffEntry[];
  accent: string;
}

export function DiffViewer({ entries, accent }: DiffViewerProps) {
  const [showUnchanged, setShowUnchanged] = useState(false);

  const typeColors: Record<DiffEntry['changeType'], string> = {
    added: STATUS_SUCCESS,
    removed: STATUS_ERROR,
    changed: STATUS_WARNING,
    unchanged: '#64748b',
  };

  const unchangedCount = entries.filter(e => e.changeType === 'unchanged').length;
  const visibleEntries = entries.filter(e => showUnchanged || e.changeType !== 'unchanged');

  return (
    <div className="space-y-1 text-sm font-mono">
      {visibleEntries.map((e) => {
        const c = typeColors[e.changeType];
        return (
          <div key={e.field} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-surface-hover/30 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
            <span className="text-text-muted font-medium w-32 truncate flex-shrink-0">{e.field}</span>
            {e.changeType === 'changed' ? (
              <>
                <span className="text-red-400 line-through opacity-60">{String(e.oldValue)}</span>
                <span className="text-text-muted">&rarr;</span>
                <span className="text-emerald-400">{String(e.newValue)}</span>
              </>
            ) : e.changeType === 'added' ? (
              <span style={{ color: c }}>+ {String(e.newValue)}</span>
            ) : e.changeType === 'removed' ? (
              <span style={{ color: c }} className="line-through">- {String(e.oldValue)}</span>
            ) : (
              <span className="text-text-muted opacity-50">{String(e.oldValue)}</span>
            )}
          </div>
        );
      })}
      {unchangedCount > 0 && !showUnchanged && (
        <button
          onClick={() => setShowUnchanged(true)}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded border border-dashed border-slate-700/50 text-slate-500 hover:text-slate-400 hover:border-slate-600/60 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3 h-3" />
          <span>Show {unchangedCount} unchanged</span>
        </button>
      )}
      {unchangedCount > 0 && showUnchanged && (
        <button
          onClick={() => setShowUnchanged(false)}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded border border-dashed border-slate-700/50 text-slate-500 hover:text-slate-400 hover:border-slate-600/60 transition-colors cursor-pointer"
        >
          <ChevronDown className="w-3 h-3" />
          <span>Hide {unchangedCount} unchanged</span>
        </button>
      )}
    </div>
  );
}

/* ── TagCloud ────────────────────────────────────────────────────────────── */

interface TagCloudProps {
  tags: TagCloudItem[];
  accent: string;
  maxFontSize?: number;
  minFontSize?: number;
}

export function TagCloud({ tags, accent, maxFontSize = 16, minFontSize = 9 }: TagCloudProps) {
  const maxCount = Math.max(...tags.map((t) => t.count), 1);
  const minCount = Math.min(...tags.map((t) => t.count), 0);
  const range = maxCount - minCount || 1;

  return (
    <div className="flex flex-wrap gap-1 items-center justify-center p-1.5">
      {tags.map((t) => {
        const norm = (t.count - minCount) / range;
        const fontSize = minFontSize + norm * (maxFontSize - minFontSize);
        const opacity = 0.4 + norm * 0.6;
        const color = t.color ?? accent;
        return (
          <motion.span
            key={t.tag}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.1 }}
            className="font-mono font-bold cursor-default px-1.5 py-0.5 rounded transition-colors"
            style={{ fontSize, color, opacity, backgroundColor: `${color}10` }}
            title={`${t.tag}: ${t.count} references${t.category ? ` (${t.category})` : ''}`}
          >
            {t.tag}
          </motion.span>
        );
      })}
    </div>
  );
}

/* ── TabButtonGroup ──────────────────────────────────────────────────────── */

export interface TabButtonGroupItem {
  value: string;
  label: string;
  /** Per-item accent color; when set, unselected items show muted text */
  color?: string;
}

export interface TabButtonGroupProps {
  items: TabButtonGroupItem[];
  selected: string | null;
  onSelect: (value: string) => void;
  accent: string;
  ariaLabel: string;
  className?: string;
}

export function TabButtonGroup({ items, selected, onSelect, accent, ariaLabel, className }: TabButtonGroupProps) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = items.length - 1;
    if (nextIndex !== null) {
      e.preventDefault();
      buttonsRef.current[nextIndex]?.focus();
      onSelect(items[nextIndex].value);
    }
  }, [items, onSelect]);

  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex gap-1${className ? ` ${className}` : ''}`}>
      {items.map((item, i) => {
        const isSelected = selected === item.value;
        const itemColor = item.color ?? accent;

        return (
          <button
            key={item.value}
            ref={el => { buttonsRef.current[i] = el; }}
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected || (selected === null && i === 0) ? 0 : -1}
            onClick={() => onSelect(item.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80"
            style={{
              borderColor: isSelected
                ? (item.color ? `${itemColor}60` : `${accent}${OPACITY_30}`)
                : (item.color ? 'var(--border)' : `${accent}${OPACITY_30}`),
              backgroundColor: isSelected ? `${itemColor}${OPACITY_20}` : 'transparent',
              color: item.color ? (isSelected ? itemColor : 'var(--text-muted)') : accent,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── SubTabNavigation ────────────────────────────────────────────────────── */

export interface SubTab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

export interface SubTabNavigationProps {
  tabs: SubTab[];
  activeTabId: string;
  onChange: (id: string) => void;
  accent: string;
}

export function SubTabNavigation({ tabs, activeTabId, onChange, accent }: SubTabNavigationProps) {
  const prefersReduced = useReducedMotion();
  return (
    <div className="flex gap-1 mb-2 border-b border-border/40 pb-1.5 overflow-x-auto custom-scrollbar">
      {tabs.map(tab => {
        const isActive = activeTabId === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold
              transition-all duration-300 focus:outline-none whitespace-nowrap
              ${isActive ? 'text-white' : 'text-text-muted hover:text-text hover:bg-surface/50'}
            `}
          >
            {isActive && (
              <motion.div
                layoutId="activeSubTabBg"
                className="absolute inset-0 rounded-lg opacity-20"
                style={{ backgroundColor: accent }}
                transition={prefersReduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }}
              />
            )}
            {Icon && (
              <Icon
                className="w-3.5 h-3.5 relative z-10 transition-colors duration-300"
                style={{ color: isActive ? accent : 'currentColor' }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
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
          : <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }} />
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

/* ── NormalizedLineChart ──────────────────────────────────────────────────── */

interface NormalizedLineChartProps {
  /** Tailwind height class, e.g. "h-[260px]" — defaults to "h-[220px]" */
  height?: string;
  /** Show horizontal grid lines at 25 / 50 / 75 % */
  showGrid?: boolean;
  /** Grid stroke color — default "rgba(255,255,255,0.06)" */
  gridColor?: string;
  /** Y-axis labels rendered top→bottom on the left edge */
  yLabels?: string[];
  /** X-axis labels rendered left→right along the bottom edge */
  xLabels?: string[];
  /** Extra SVG <defs> (gradients, clip paths, etc.) */
  defs?: ReactNode;
  /** SVG child elements (polylines, paths, circles, etc.) */
  children: ReactNode;
  /** Extra content rendered *outside* the SVG but inside the container (legends, badges) */
  overlay?: ReactNode;
  /** Optional style override for the outer container */
  style?: CSSProperties;
}

export function NormalizedLineChart({
  height = 'h-[220px]',
  showGrid = true,
  gridColor = 'rgba(255,255,255,0.06)',
  yLabels,
  xLabels,
  defs,
  children,
  overlay,
  style,
}: NormalizedLineChartProps) {
  return (
    <div className={`w-full ${height} bg-surface-deep/30 rounded-xl relative p-4 border border-border/40 min-h-[200px]`} style={style}>
      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        {defs}
        {showGrid && [25, 50, 75].map(pct => (
          <line key={pct} x1="0" y1={pct} x2="100" y2={pct} stroke={gridColor} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {children}
      </svg>

      {yLabels && yLabels.length > 0 && (
        <div className="absolute left-1 top-4 bottom-4 flex flex-col justify-between text-xs text-text-muted font-mono">
          {yLabels.map((label, i) => <span key={i}>{label}</span>)}
        </div>
      )}

      {xLabels && xLabels.length > 0 && (
        <div className="absolute left-4 right-4 bottom-0 flex justify-between text-xs text-text-muted font-mono">
          {xLabels.map((label, i) => <span key={i}>{label}</span>)}
        </div>
      )}

      {overlay}
    </div>
  );
}

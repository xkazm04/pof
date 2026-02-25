'use client';

import { ReactNode, useMemo } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_IMPROVED,
  OPACITY_8, OPACITY_10,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type {
  RadarDataPoint, TimelineEvent, HeatmapCell,
  GaugeMetric, DiffEntry, TagCloudItem,
} from '@/types/unique-tab-improvements';

/* ── Shared STATUS_COLORS ─────────────────────────────────────────────────── */

export const STATUS_COLORS: Record<FeatureStatus, { dot: string; bg: string; label: string }> = {
  implemented: { dot: STATUS_SUCCESS, bg: `${STATUS_SUCCESS}${OPACITY_8}`, label: 'Implemented' },
  improved: { dot: STATUS_IMPROVED, bg: `${STATUS_IMPROVED}${OPACITY_8}`, label: 'Improved' },
  partial: { dot: STATUS_WARNING, bg: `${STATUS_WARNING}${OPACITY_8}`, label: 'Partial' },
  missing: { dot: STATUS_ERROR, bg: `${STATUS_ERROR}${OPACITY_8}`, label: 'Missing' },
  unknown: { dot: '#64748b', bg: '#64748b18', label: 'Unknown' },
};

/* ── StatusDot ────────────────────────────────────────────────────────────── */

export function StatusDot({ status }: { status: FeatureStatus }) {
  const sc = STATUS_COLORS[status];
  const isActive = status === 'implemented' || status === 'improved';
  return (
    <span className="flex items-center gap-1.5">
      <motion.span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: sc.dot, boxShadow: isActive ? `0 0 6px ${sc.dot}` : 'none' }}
        animate={isActive ? { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="text-2xs font-medium" style={{ color: sc.dot }}>{sc.label}</span>
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
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between pb-3 border-b border-border/40"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg relative overflow-hidden group">
          <div className="absolute inset-0 opacity-20" style={{ backgroundColor: accent }} />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity blur-md" style={{ backgroundColor: accent }} />
          <Icon className="w-5 h-5 relative z-10" style={{ color: accent, filter: `drop-shadow(0 0 4px ${accent}80)` }} />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-text tracking-wide">{title}</span>
          <span className="text-xs text-text-muted mt-0.5">
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
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {steps.map((step, i, arr) => {
        const label = typeof step === 'string' ? step : step.label;
        const status = typeof step === 'string' ? undefined : step.status;
        const sc = status ? STATUS_COLORS[status] : undefined;
        const isLast = i === arr.length - 1;

        return (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-1.5"
          >
            <div
              className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md"
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
              <div className="relative w-5 h-[2px] bg-border overflow-hidden rounded-full">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-current"
                  style={{ color: accent }}
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: i * 0.2 }}
                />
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
    <div className="flex items-center gap-1.5 text-xs text-text-muted font-bold uppercase tracking-widest">
      {Icon && <Icon className="w-3.5 h-3.5" style={color ? { color, filter: `drop-shadow(0 0 3px ${color}80)` } : undefined} />}
      {label}
    </div>
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

  return (
    <SurfaceCard level={2} className="relative overflow-hidden group">
      {/* Subtle animated gradient background on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${accent}15 0%, transparent 70%)` }}
      />

      <button
        onClick={() => onToggle(name)}
        className="relative z-10 w-full text-left px-3 py-2.5 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex-shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5 text-text-muted transition-colors group-hover:text-text" />
          </motion.div>
          <span className="text-xs font-semibold text-text truncate group-hover:text-text-bright transition-colors">{name}</span>
          <span className="ml-auto flex items-center gap-1.5 flex-shrink-0 bg-surface px-2 py-0.5 rounded-md border border-border/50 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot, boxShadow: `0 0 6px ${sc.dot}80` }} />
            <span className="text-2xs font-medium" style={{ color: sc.dot }}>{sc.label}</span>
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ opacity: { duration: 0.2 }, height: { duration: 0.3, type: "spring", bounce: 0 } }}
            className="relative z-10 overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2.5 border-t border-border/40 bg-surface/30">
              <p className="text-xs text-text-muted leading-relaxed mt-2.5">
                {def?.description ?? row?.description ?? 'No description available for this feature.'}
              </p>

              {row?.filePaths && row.filePaths.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {row.filePaths.slice(0, 3).map((fp) => (
                    <span
                      key={fp}
                      className="flex items-center gap-1 text-2xs font-mono px-1.5 py-0.5 rounded"
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
                  <div className="flex items-center gap-1.5 bg-surface px-2 py-1 rounded-md text-2xs font-mono border border-border/50">
                    <span className="text-text-muted">Quality:</span>
                    <span className={row.qualityScore >= 8 ? "text-emerald-400" : row.qualityScore >= 5 ? "text-amber-400" : "text-red-400"}>
                      {row.qualityScore}/10
                    </span>
                  </div>
                )}

                {row?.nextSteps && (
                  <div className="text-2xs truncate ml-auto border-l-2 pl-2 max-w-[60%]" style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING }}>
                    <span className="opacity-70 font-semibold mr-1">Next:</span>{row.nextSteps}
                  </div>
                )}
              </div>

              {def?.dependsOn && def.dependsOn.length > 0 && (
                <div className="text-2xs text-text-muted font-mono pt-1">
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

export function FeatureGrid({ featureNames, featureMap, defs, expanded, onToggle, accent }: FeatureGridProps) {
  return (
    <motion.div
      variants={gridVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-2"
    >
      {featureNames.map((name) => (
        <motion.div key={name} variants={itemVariants}>
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
  return (
    <div className="flex items-center justify-center py-16">
      <motion.div
        className="w-10 h-10 rounded-full"
        style={{
          border: `2px solid ${accent}30`,
          borderTopColor: accent,
          filter: `drop-shadow(0 0 8px ${accent}60)`
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
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

export function RadarChart({ data, size = 160, accent, overlays, showLabels = true }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 24;
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
        const p = toXY(1.18, i);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
            className="text-[9px] font-mono font-bold fill-[var(--text-muted)]"
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

export function TimelineStrip({ events, accent, maxVisible = 50, height = 120 }: TimelineStripProps) {
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
              <div className="h-5 rounded-sm opacity-70" style={{ backgroundColor: evt.color, minWidth: 4 }} />
            ) : (
              <div className="w-2 h-2 rounded-full -ml-1" style={{ backgroundColor: evt.color, boxShadow: `0 0 4px ${evt.color}` }} />
            )}
            <div className="text-[8px] font-mono text-text-muted mt-0.5 whitespace-nowrap truncate max-w-[60px]">
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
      <table className="border-collapse text-[10px]">
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
                    className="p-0.5"
                    title={cell?.tooltip ?? `${rowLabel} × ${cols[ci]}: ${(v * 100).toFixed(0)}%`}
                    onClick={() => onCellClick?.(ri, ci)}
                  >
                    <div
                      className="w-7 h-7 rounded-sm cursor-pointer hover:ring-1 hover:ring-white/30 transition-all flex items-center justify-center"
                      style={{ backgroundColor: interpolateColor(lowColor, high, v) }}
                    >
                      {cell?.label && <span className="text-[8px] font-mono text-white/80">{cell.label}</span>}
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

export function LiveMetricGauge({ metric, size = 80, accent }: LiveMetricGaugeProps) {
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
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={finalColor} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - clamped)}
            strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease-out', filter: `drop-shadow(0 0 4px ${finalColor})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col leading-none">
          <span className="text-xs font-mono font-bold" style={{ color: finalColor }}>{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-widest truncate max-w-[80px]">{metric.label}</div>
        <div className="text-xs font-mono text-text">
          {metric.current.toFixed(metric.unit === 'ms' || metric.unit === '%' ? 1 : 0)}
          <span className="text-text-muted text-[10px]">{metric.unit}</span>
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
  const typeColors: Record<DiffEntry['changeType'], string> = {
    added: STATUS_SUCCESS,
    removed: STATUS_ERROR,
    changed: STATUS_WARNING,
    unchanged: '#64748b',
  };

  return (
    <div className="space-y-1 text-xs font-mono">
      {entries.map((e) => {
        const c = typeColors[e.changeType];
        return (
          <div key={e.field} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-hover/30 transition-colors">
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
    <div className="flex flex-wrap gap-1.5 items-center justify-center p-2">
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

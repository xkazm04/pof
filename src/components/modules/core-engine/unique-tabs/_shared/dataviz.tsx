'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_SUBDUED,
  OPACITY_5,
  GLOW_SM,
  withOpacity,
} from '@/lib/chart-colors';
import type {
  TimelineEvent, HeatmapCell, DiffEntry, TagCloudItem,
} from '@/types/unique-tab-improvements';
import { EmptyPanel } from './primitives';

/* ── TimelineStrip ───────────────────────────────────────────────────────── */

interface TimelineStripProps {
  events: TimelineEvent[];
  accent: string;
  maxVisible?: number;
  height?: number;
}

export function TimelineStrip({ events, accent, maxVisible = 50, height = 100 }: TimelineStripProps) {
  if (events.length === 0) {
    return (
      <EmptyPanel
        label="No timeline events"
        hint="Run the simulation to populate this timeline."
        height={height}
      />
    );
  }

  const visible = events.slice(0, maxVisible);
  const minT = Math.min(...visible.map((e) => e.timestamp));
  const maxT = Math.max(...visible.map((e) => e.timestamp + (e.duration ?? 0)));
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
              <div className="w-1.5 h-1.5 rounded-full -ml-1" style={{ backgroundColor: evt.color, boxShadow: `${GLOW_SM} ${evt.color}` }} />
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
    unchanged: STATUS_SUBDUED,
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
                <span className="line-through opacity-60" style={{ color: STATUS_ERROR }}>{String(e.oldValue)}</span>
                <span className="text-text-muted">&rarr;</span>
                <span style={{ color: STATUS_SUCCESS }}>{String(e.newValue)}</span>
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
            style={{ fontSize, color, opacity, backgroundColor: withOpacity(color, OPACITY_5) }}
            title={`${t.tag}: ${t.count} references${t.category ? ` (${t.category})` : ''}`}
          >
            {t.tag}
          </motion.span>
        );
      })}
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';
import {
  Grid3x3,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { MOTION } from '@/lib/constants';
import { STATUS_COLORS, STATUS_LABELS, STATUS_KEYS, type StatusKey, type SortKey } from './constants';
import type { CellData } from './types';
import { cellIntensity, cellAlphaHex } from './helpers';

type Totals = Record<StatusKey, number> & { total: number };

export function HeatmapGrid({
  cells,
  totals,
  overallPct,
  sortBy,
  setSortBy,
  categoryGroups,
  hoveredCell,
  setHoveredCell,
  handleCellClick,
}: {
  cells: CellData[];
  totals: Totals;
  overallPct: number;
  sortBy: SortKey;
  setSortBy: (v: SortKey) => void;
  categoryGroups: Record<string, CellData[]>;
  hoveredCell: { module: string; status: StatusKey } | null;
  setHoveredCell: (v: { module: string; status: StatusKey } | null) => void;
  handleCellClick: (moduleId: SubModuleId) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Grid3x3 className="w-3.5 h-3.5 text-[#ef4444]" />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Feature Status Heatmap
          </span>
          <span className="text-2xs text-text-muted">
            {cells.length} modules / {totals.total} features
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3 h-3 text-text-muted" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-text outline-none focus:border-border-bright transition-colors"
          >
            <option value="completion">Sort: Least Complete</option>
            <option value="missing">Sort: Most Missing</option>
            <option value="name">Sort: Name A-Z</option>
          </select>
        </div>
      </div>

      <div className="bg-[#0a0a1e] border border-border rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid items-center border-b border-border bg-surface-deep"
          style={{ gridTemplateColumns: '180px repeat(4, 1fr) 80px' }}
        >
          <div className="px-3 py-2 text-2xs font-semibold text-text-muted uppercase tracking-wider">
            Module
          </div>
          {STATUS_KEYS.map((key) => (
            <div
              key={key}
              className="px-2 py-2 text-2xs font-semibold uppercase tracking-wider text-center"
              style={{ color: STATUS_COLORS[key] }}
            >
              {STATUS_LABELS[key]}
            </div>
          ))}
          <div className="px-2 py-2 text-2xs font-semibold text-text-muted uppercase tracking-wider text-center">
            Done %
          </div>
        </div>

        {/* Category groups */}
        {Object.entries(categoryGroups).map(([category, groupCells]) => (
          <div key={category}>
            {/* Category header */}
            <div className="px-3 py-1.5 bg-surface border-b border-border">
              <span className="text-2xs font-bold uppercase text-text-muted">
                {category}
              </span>
            </div>

            {/* Module rows */}
            {groupCells.map((cell, i) => {
              const pctDone = cell.total > 0 ? Math.round(cell.pctComplete * 100) : 0;
              const rowAriaLabel = `${cell.label} — ${pctDone}% complete. ${STATUS_KEYS.map((k) => `${cell[k]} ${STATUS_LABELS[k].toLowerCase()}`).join(', ')}. Open module.`;

              return (
                <motion.div
                  key={cell.moduleId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: MOTION.base, delay: i * 0.02 }}
                  role="button"
                  tabIndex={0}
                  aria-label={rowAriaLabel}
                  className="grid items-center border-b border-border/50 hover:bg-surface transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-border-bright focus-visible:ring-inset focus-visible:bg-surface"
                  style={{ gridTemplateColumns: '180px repeat(4, 1fr) 80px' }}
                  onClick={() => handleCellClick(cell.moduleId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCellClick(cell.moduleId);
                    }
                  }}
                >
                  {/* Module name */}
                  <div className="px-3 py-2.5 flex items-center gap-2">
                    <span className="text-xs font-medium text-text group-hover:text-text truncate">
                      {cell.label}
                    </span>
                    <ChevronRight className="w-3 h-3 text-text-muted opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all flex-shrink-0" />
                  </div>

                  {/* Status cells */}
                  {STATUS_KEYS.map((key) => {
                    const count = cell[key];
                    const intensity = cellIntensity(count, cell.total);
                    const isHovered = hoveredCell?.module === cell.moduleId && hoveredCell?.status === key;
                    const cellPct = cell.total > 0 ? Math.round((count / cell.total) * 100) : 0;
                    const cellTitle = count > 0
                      ? `${count}/${cell.total} ${STATUS_LABELS[key].toLowerCase()} (${cellPct}%)`
                      : `0 ${STATUS_LABELS[key].toLowerCase()}`;

                    return (
                      <div
                        key={key}
                        className="px-2 py-2.5 flex items-center justify-center relative"
                        onMouseEnter={() => setHoveredCell({ module: cell.moduleId, status: key })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <div
                          className="w-full h-7 rounded-md flex items-center justify-center transition-all duration-base"
                          title={cellTitle}
                          aria-label={cellTitle}
                          style={{
                            backgroundColor: count > 0 ? `${STATUS_COLORS[key]}${cellAlphaHex(intensity)}` : 'transparent',
                            border: isHovered && count > 0 ? `1px solid ${STATUS_COLORS[key]}` : '1px solid transparent',
                          }}
                        >
                          {count > 0 && (
                            <span
                              className="text-xs font-semibold"
                              style={{ color: intensity > 0.55 ? 'var(--text)' : STATUS_COLORS[key] }}
                            >
                              {count}
                            </span>
                          )}
                        </div>

                        {/* Tooltip */}
                        {isHovered && count > 0 && (
                          <div
                            role="tooltip"
                            className="absolute z-20 bottom-full mb-1 px-2 py-1 rounded-md text-2xs font-medium whitespace-nowrap pointer-events-none"
                            style={{
                              backgroundColor: 'var(--surface-hover)',
                              border: `1px solid ${STATUS_COLORS[key]}40`,
                              color: STATUS_COLORS[key],
                            }}
                          >
                            {count}/{cell.total} {STATUS_LABELS[key].toLowerCase()}
                            <span className="text-text-muted"> ({cellPct}%)</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Completion percentage */}
                  <div className="px-2 py-2.5 flex items-center justify-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-1.5 rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-slow"
                          style={{
                            width: `${pctDone}%`,
                            backgroundColor: pctDone >= 80 ? STATUS_SUCCESS : pctDone >= 40 ? STATUS_WARNING : pctDone > 0 ? STATUS_ERROR : 'var(--text-muted)',
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-medium w-7 text-right"
                        style={{
                          color: pctDone >= 80 ? STATUS_SUCCESS : pctDone >= 40 ? STATUS_WARNING : pctDone > 0 ? STATUS_ERROR : 'var(--text-muted)',
                        }}
                      >
                        {pctDone}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}

        {/* Footer totals */}
        <div
          className="grid items-center bg-surface border-t border-border"
          style={{ gridTemplateColumns: '180px repeat(4, 1fr) 80px' }}
        >
          <div className="px-3 py-2.5">
            <span className="text-xs font-bold text-text-muted uppercase">
              Total ({cells.length} modules)
            </span>
          </div>
          {STATUS_KEYS.map((key) => (
            <div key={key} className="px-2 py-2.5 flex items-center justify-center">
              <span className="text-xs font-bold" style={{ color: STATUS_COLORS[key] }}>
                {totals[key]}
              </span>
            </div>
          ))}
          <div className="px-2 py-2.5 flex items-center justify-center">
            <span
              className="text-xs font-bold"
              style={{ color: overallPct >= 80 ? STATUS_SUCCESS : overallPct >= 40 ? STATUS_WARNING : STATUS_ERROR }}
            >
              {overallPct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Plus, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, OVERLAY_WHITE, withOpacity, OPACITY_15 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import type {
  ComparisonMatrixStat,
  ComparisonMatrixEntity,
  ComparisonMatrixProps,
} from './data';

export type { ComparisonMatrixStat, ComparisonMatrixEntity } from './data';

/* ── Component ──────────────────────────────────────────────────────────────── */

export function ComparisonMatrix({
  stats,
  allEntities,
  selectedIds,
  onSelectedIdsChange,
  maxColumns = 8,
  minColumns = 2,
}: ComparisonMatrixProps) {
  const selectedEntities = selectedIds
    .map((id) => allEntities.find((e) => e.id === id))
    .filter(Boolean) as ComparisonMatrixEntity[];

  const canAdd = selectedIds.length < maxColumns && selectedIds.length < allEntities.length;
  const canRemove = selectedIds.length > minColumns;

  const addColumn = () => {
    const available = allEntities.filter((e) => !selectedIds.includes(e.id));
    if (available.length > 0) {
      onSelectedIdsChange([...selectedIds, available[0].id]);
    }
  };

  const removeColumn = (id: string) => {
    if (!canRemove) return;
    onSelectedIdsChange(selectedIds.filter((c) => c !== id));
  };

  const changeColumn = (index: number, newId: string) => {
    const newIds = [...selectedIds];
    newIds[index] = newId;
    onSelectedIdsChange(newIds);
  };

  return (
    <BlueprintPanel color={STATUS_SUCCESS} className="p-4">
      {/* Column controls */}
      <div className="flex items-center gap-2 mb-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          onClick={addColumn}
          disabled={!canAdd}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono uppercase tracking-[0.15em] font-bold border transition-colors hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ borderColor: withOpacity(OVERLAY_WHITE, OPACITY_15), color: 'var(--text-muted)' }}
        >
          <Plus className="w-3 h-3" /> Add Column
        </motion.button>
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
          {selectedIds.length}/{maxColumns} columns
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left py-2 pr-4 text-xs font-mono uppercase tracking-[0.15em] font-bold text-text-muted w-28">
                Stat
              </th>
              {selectedEntities.map((entity, idx) => (
                <th key={entity.id} className="py-2 px-1 text-xs text-center min-w-[80px]">
                  <div className="flex flex-col items-center gap-1">
                    <select
                      value={entity.id}
                      onChange={(e) => changeColumn(idx, e.target.value)}
                      className="text-xs font-bold bg-transparent border-none cursor-pointer text-center focus:outline-none max-w-[100px]"
                      style={{ color: entity.color }}
                    >
                      {allEntities.map((e) => (
                        <option
                          key={e.id}
                          value={e.id}
                          disabled={selectedIds.includes(e.id) && e.id !== entity.id}
                        >
                          {e.name}
                        </option>
                      ))}
                    </select>
                    {canRemove && (
                      <button
                        onClick={() => removeColumn(entity.id)}
                        className="text-text-muted hover:text-text transition-colors opacity-0 group-hover:opacity-100"
                        style={{ opacity: 0.4 }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {stats.map((stat, si) => {
              const values = selectedEntities.map((e) => e.values[si]);
              const maxV = Math.max(...values);
              const bestVal = (stat.higherIsBetter ?? true) ? maxV : Math.min(...values);

              return (
                <tr key={stat.stat} className="hover:bg-surface/30 transition-colors">
                  <td className="py-2 pr-4 font-mono font-bold text-text-muted">
                    {stat.stat}{' '}
                    {stat.unit && (
                      <span className="text-xs opacity-60">({stat.unit})</span>
                    )}
                  </td>
                  {selectedEntities.map((entity) => {
                    const val = entity.values[si];
                    const barPct = stat.maxVal > 0 ? (val / stat.maxVal) * 100 : 0;
                    const isBest = val === bestVal;
                    return (
                      <td key={entity.id} className="py-2 px-1">
                        <div className="flex items-center gap-1">
                          <div className="w-14 flex-shrink-0">
                            <NeonBar
                              pct={Math.min(barPct, 100)}
                              color={entity.color}
                              height={6}
                              glow={isBest}
                            />
                          </div>
                          <span
                            className="font-mono text-xs w-8"
                            style={{
                              color: isBest ? STATUS_SUCCESS : 'var(--text-muted)',
                              fontWeight: isBest ? 700 : 400,
                            }}
                          >
                            {val}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-border/30">
        {selectedEntities.map((entity) => (
          <span
            key={entity.id}
            className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] font-bold"
            style={{ color: entity.color }}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entity.color }} />
            {entity.name}
          </span>
        ))}
        <span className="ml-auto text-xs font-mono uppercase tracking-[0.15em] text-text-muted flex items-center gap-1">
          <span className="font-bold" style={{ color: STATUS_SUCCESS }}>Green</span> = best in stat
        </span>
      </div>
    </BlueprintPanel>
  );
}

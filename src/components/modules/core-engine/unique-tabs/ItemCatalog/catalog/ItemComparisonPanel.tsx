'use client';

import { useMemo, useState, useCallback } from 'react';
import { GitCompareArrows, RotateCcw, Plus, X } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_MUTED,
  withOpacity, OPACITY_20, OPACITY_12, OPACITY_30, OPACITY_10,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { ACCENT, RARITY_COLORS, ALL_ITEM_TYPES, type ItemData } from '../data';

/* ── Same-Type Item Comparison Panel (2-3 items) ────────────────────────── */

export function ItemComparisonPanel({ items }: { items: ItemData[] }) {
  const availableCategories = useMemo(
    () => ALL_ITEM_TYPES.filter(c => items.some(i => i.type === c)),
    [items],
  );

  const [category, setCategory] = useState<ItemData['type'] | null>(null);
  const [slotIds, setSlotIds] = useState<string[]>(['', '']);

  const pool = useMemo(
    () => (category ? items.filter(i => i.type === category) : []),
    [items, category],
  );

  const selectedItems = useMemo(
    () => slotIds.map(id => pool.find(i => i.id === id)).filter((i): i is ItemData => i != null),
    [slotIds, pool],
  );

  const canCompare = selectedItems.length >= 2 && new Set(slotIds.filter(Boolean)).size >= 2;

  const handleClear = useCallback(() => {
    setCategory(null);
    setSlotIds(['', '']);
  }, []);

  const handleSetSlot = useCallback((index: number, value: string) => {
    setSlotIds(prev => prev.map((v, i) => i === index ? value : v));
  }, []);

  const handleAddSlot = useCallback(() => {
    if (slotIds.length < 3) setSlotIds(prev => [...prev, '']);
  }, [slotIds.length]);

  const handleRemoveSlot = useCallback((index: number) => {
    if (slotIds.length <= 2) return;
    setSlotIds(prev => prev.filter((_, i) => i !== index));
  }, [slotIds.length]);

  /* stat union with max for bar scaling */
  const statRows = useMemo(() => {
    if (selectedItems.length < 2) return [];
    const keys = new Set(selectedItems.flatMap(item => item.stats.map(s => s.label)));
    return Array.from(keys).map(label => {
      const values = selectedItems.map(item => {
        const s = item.stats.find(st => st.label === label);
        return { numericValue: s?.numericValue ?? 0, display: s?.value ?? '—', maxValue: s?.maxValue ?? 0 };
      });
      const max = Math.max(...values.map(v => v.numericValue), ...values.map(v => v.maxValue), 1);
      const bestValue = Math.max(...values.map(v => v.numericValue));
      return { label, values, max, bestValue };
    });
  }, [selectedItems]);

  if (availableCategories.length === 0) return null;

  return (
    <BlueprintPanel color={ACCENT} className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader icon={GitCompareArrows} label="Item Comparison (2-3)" color={ACCENT} />
        {category && (
          <button onClick={handleClear}
            className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg transition-colors hover:bg-surface-hover cursor-pointer"
            style={{ color: STATUS_MUTED, border: `1px solid ${withOpacity(STATUS_MUTED, OPACITY_20)}` }}>
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Category selector */}
      <div className="flex gap-2 flex-wrap">
        {availableCategories.map(c => (
          <button key={c} onClick={() => { setCategory(c); setSlotIds(['', '']); }}
            className="text-sm font-mono px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            style={{
              backgroundColor: category === c ? `${withOpacity(ACCENT, OPACITY_12)}` : 'var(--surface-deep)',
              color: category === c ? ACCENT : 'var(--text-muted)',
              border: `1px solid ${category === c ? withOpacity(ACCENT, OPACITY_30) : 'var(--border)'}`,
            }}>
            {c}
          </button>
        ))}
      </div>

      {/* Item selectors */}
      {category && (
        <div className="flex gap-3 items-center flex-wrap">
          {slotIds.map((id, idx) => (
            <div key={idx} className="flex items-center gap-1 flex-1 min-w-[150px]">
              <select value={id} onChange={e => handleSetSlot(idx, e.target.value)}
                className="flex-1 text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer">
                <option value="">{`— Slot ${String.fromCharCode(65 + idx)} —`}</option>
                {pool.map(i => <option key={i.id} value={i.id}>{i.name} ({i.rarity})</option>)}
              </select>
              {slotIds.length > 2 && (
                <button onClick={() => handleRemoveSlot(idx)} className="p-1 rounded hover:bg-surface-hover text-text-muted cursor-pointer" aria-label="Remove slot">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {slotIds.length < 3 && (
            <button onClick={handleAddSlot}
              className="flex items-center gap-1 text-xs font-mono px-2.5 py-2 rounded-lg transition-colors hover:bg-surface-hover cursor-pointer"
              style={{ color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}>
              <Plus className="w-3 h-3" /> Add Slot
            </button>
          )}
        </div>
      )}

      {/* Comparison body */}
      {canCompare && (
        <>
          {/* Header names + rarity */}
          <div className="grid gap-2 items-center" style={{ gridTemplateColumns: `repeat(${selectedItems.length}, 1fr)` }}>
            {selectedItems.map(item => (
              <div key={item.id} className="text-center">
                <span className="text-sm font-mono font-bold"
                  style={{ color: RARITY_COLORS[item.rarity] ?? STATUS_MUTED }}>
                  {item.name}
                </span>
                <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
                  {item.rarity} {item.subtype}
                </div>
              </div>
            ))}
          </div>

          {/* Stat rows with bars */}
          <div className="space-y-1.5">
            {statRows.map(({ label, values, max, bestValue }) => (
              <div key={label} className="space-y-0.5">
                <div className="text-xs font-mono text-text-muted text-center">{label}</div>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
                  {values.map((v, idx) => {
                    const isBest = v.numericValue === bestValue && bestValue > 0;
                    const isWorst = v.numericValue < bestValue && bestValue > 0;
                    const barColor = isBest ? STATUS_SUCCESS : isWorst ? STATUS_ERROR : ACCENT;
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold w-12 text-right"
                          style={{ color: isBest ? STATUS_SUCCESS : isWorst ? STATUS_ERROR : 'var(--text)' }}>
                          {v.display}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-surface-deep overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${(v.numericValue / max) * 100}%`, backgroundColor: barColor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Description comparison */}
          <div className="grid gap-3 pt-2 border-t" style={{ borderColor: `${withOpacity(ACCENT, OPACITY_10)}`, gridTemplateColumns: `repeat(${selectedItems.length}, 1fr)` }}>
            {selectedItems.map(item => (
              <div key={item.id} className="space-y-1">
                <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Description</div>
                <p className="text-sm font-mono text-text/80 leading-relaxed">{item.description}</p>
                {item.effect && (
                  <p className="text-xs font-mono italic" style={{ color: ACCENT }}>{item.effect}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!category && (
        <p className="text-sm font-mono text-text-muted/50 text-center py-4">
          Select a category to compare items of the same type.
        </p>
      )}
      {category && !canCompare && (
        <p className="text-sm font-mono text-text-muted/50 text-center py-4">
          Pick two or three different items to start comparing.
        </p>
      )}
    </BlueprintPanel>
  );
}

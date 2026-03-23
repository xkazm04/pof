'use client';

import { useState } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_MUTED } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import type { ComparableItem } from './data';
import { ACCENT, RARITY_COLORS, computeEffectiveDPS } from './data';

/* ── Item Comparison Panel ─────────────────────────────────────────────── */

export function ItemComparisonPanel({ items }: { items: ComparableItem[] }) {
  const [leftId, setLeftId] = useState(items[0]?.id ?? '');
  const [rightId, setRightId] = useState(items[1]?.id ?? items[0]?.id ?? '');

  const leftItem = items.find(i => i.id === leftId) ?? items[0];
  const rightItem = items.find(i => i.id === rightId) ?? (items[1] ?? items[0]);

  if (items.length < 2) return null;

  const leftDps = computeEffectiveDPS(leftItem);
  const rightDps = computeEffectiveDPS(rightItem);
  const dpsDiff = rightDps.dps - leftDps.dps;
  const ttkDiff = rightDps.ttk - leftDps.ttk;
  const allStatKeys = leftItem.stats.map(s => s.key);

  return (
    <BlueprintPanel color={ACCENT} className="p-4 space-y-4">
      <SectionHeader icon={GitCompareArrows} label="Item Comparison" color={ACCENT} />

      {/* Selectors */}
      <div className="flex gap-3 mb-3">
        <select value={leftId} onChange={e => setLeftId(e.target.value)}
          className="flex-1 text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer">
          {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.rarity})</option>)}
        </select>
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted self-center">vs</span>
        <select value={rightId} onChange={e => setRightId(e.target.value)}
          className="flex-1 text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer">
          {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.rarity})</option>)}
        </select>
      </div>

      {/* Side-by-side header */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <div className="text-center">
          <span className="text-sm font-mono font-bold" style={{ color: RARITY_COLORS[leftItem.rarity] ?? STATUS_MUTED, textShadow: `0 0 12px ${RARITY_COLORS[leftItem.rarity] ?? STATUS_MUTED}40` }}>
            {leftItem.name}
          </span>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">{leftItem.rarity} -- {leftItem.slot}</div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Delta</div>
        <div className="text-center">
          <span className="text-sm font-mono font-bold" style={{ color: RARITY_COLORS[rightItem.rarity] ?? STATUS_MUTED, textShadow: `0 0 12px ${RARITY_COLORS[rightItem.rarity] ?? STATUS_MUTED}40` }}>
            {rightItem.name}
          </span>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">{rightItem.rarity} -- {rightItem.slot}</div>
        </div>
      </div>

      {/* Stat rows */}
      <div className="space-y-0.5">
        {allStatKeys.map(key => {
          const ls = leftItem.stats.find(s => s.key === key);
          const rs = rightItem.stats.find(s => s.key === key);
          if (!ls || !rs) return null;
          const diff = rs.value - ls.value;
          const isBetter = ls.higherIsBetter ? diff > 0 : diff < 0;
          const isWorse = ls.higherIsBetter ? diff < 0 : diff > 0;
          const diffColor = diff === 0 ? 'var(--text-muted)' : isBetter ? STATUS_SUCCESS : STATUS_ERROR;
          return (
            <div key={key} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center py-1 border-b" style={{ borderColor: `${ACCENT}10` }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-text-muted">{ls.label}</span>
                <span className={`text-sm font-mono font-bold ${isWorse ? 'text-red-400' : 'text-text'}`}>
                  {ls.value % 1 !== 0 ? ls.value.toFixed(1) : ls.value}{ls.unit}
                </span>
              </div>
              <div className="w-16 text-center">
                {diff !== 0 ? (
                  <span className="text-sm font-mono font-bold px-1.5 py-0.5 rounded-md inline-block"
                    style={{ backgroundColor: `${diffColor}15`, color: diffColor, border: `1px solid ${diffColor}30` }}>
                    {diff > 0 ? '+' : ''}{diff % 1 !== 0 ? diff.toFixed(1) : diff}
                  </span>
                ) : (
                  <span className="text-sm font-mono text-text-muted/40">---</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-mono font-bold ${isBetter ? 'text-emerald-400' : 'text-text'}`}>
                  {rs.value % 1 !== 0 ? rs.value.toFixed(1) : rs.value}{rs.unit}
                </span>
                <span className="text-sm font-mono text-text-muted">{rs.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Affixes comparison */}
      <div className="grid grid-cols-2 gap-2">
        {[leftItem, rightItem].map(item => (
          <div key={item.id}>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Affixes</div>
            {item.affixes.length > 0 ? item.affixes.map(a => (
              <div key={a.name} className="text-sm font-mono py-0.5" style={{ color: RARITY_COLORS[item.rarity] ?? STATUS_MUTED }}>
                {a.name}: {a.stat}
              </div>
            )) : <div className="text-sm font-mono text-text-muted/40 italic">None</div>}
          </div>
        ))}
      </div>

      {/* Effective DPS / TTK */}
      <div className="p-3 rounded-lg border bg-surface-deep/50" style={{ borderColor: `${ACCENT}20` }}>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
          Combat Impact (GAS Pipeline)
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <div className="text-center">
            <div className="text-sm font-mono font-bold" style={{ color: ACCENT, textShadow: `0 0 12px ${ACCENT}40` }}>{leftDps.dps.toFixed(1)}</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Effective DPS</div>
          </div>
          <div className="text-center">
            <span className="text-sm font-mono font-bold px-2 py-0.5 rounded-md inline-block"
              style={{ backgroundColor: `${dpsDiff >= 0 ? STATUS_SUCCESS : STATUS_ERROR}15`, color: dpsDiff >= 0 ? STATUS_SUCCESS : STATUS_ERROR, border: `1px solid ${dpsDiff >= 0 ? STATUS_SUCCESS : STATUS_ERROR}30` }}>
              {dpsDiff >= 0 ? '+' : ''}{dpsDiff.toFixed(1)} DPS
            </span>
          </div>
          <div className="text-center">
            <div className="text-sm font-mono font-bold" style={{ color: ACCENT, textShadow: `0 0 12px ${ACCENT}40` }}>{rightDps.dps.toFixed(1)}</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Effective DPS</div>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mt-1.5">
          <div className="text-center">
            <div className="text-sm font-mono font-bold text-text">{leftDps.ttk.toFixed(2)}s</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">TTK (1000 HP)</div>
          </div>
          <div className="text-center">
            <span className="text-sm font-mono font-bold px-1.5 py-0.5 rounded-md inline-block"
              style={{ backgroundColor: `${ttkDiff <= 0 ? STATUS_SUCCESS : STATUS_ERROR}15`, color: ttkDiff <= 0 ? STATUS_SUCCESS : STATUS_ERROR, border: `1px solid ${ttkDiff <= 0 ? STATUS_SUCCESS : STATUS_ERROR}30` }}>
              {ttkDiff > 0 ? '+' : ''}{ttkDiff.toFixed(2)}s
            </span>
          </div>
          <div className="text-center">
            <div className="text-sm font-mono font-bold text-text">{rightDps.ttk.toFixed(2)}s</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">TTK (1000 HP)</div>
          </div>
        </div>
        <div className="text-[10px] font-mono text-text-muted mt-2 text-center tracking-wide">
          Formula: (baseDmg + atkPow) x atkSpd x (1 + critChance x (critMult - 1)) -- CritMult = 2.0x
        </div>
      </div>
    </BlueprintPanel>
  );
}

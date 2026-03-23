'use client';

import { Shield, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import { ACCENT, RARITY_COLORS, LOADOUT_SLOTS, LOADOUT_SLOT_POSITIONS, ITEM_SETS } from './data';
import { STATUS_SUBDUED, STATUS_LOCKED_STROKE } from '@/lib/chart-colors';

/* ── Equipment Loadout Section ─────────────────────────────────────────── */

export function EquipmentLoadoutSection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${ACCENT}60, transparent)` }} />
      <SectionHeader icon={Shield} label="Equipment Loadout Visualizer" color={ACCENT} />
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Paper-doll layout with equipped items and stat contribution summary.</p>
      <div className="flex flex-wrap gap-4 items-start justify-center">
        {/* Paper doll SVG */}
        <div className="relative" style={{ width: 180, height: 160 }}>
          <svg width={180} height={160} viewBox="0 0 220 200" className="absolute inset-0">
            <ellipse cx="95" cy="25" rx="14" ry="16" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <line x1="95" y1="41" x2="95" y2="110" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <line x1="95" y1="55" x2="60" y2="85" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <line x1="95" y1="55" x2="130" y2="85" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <line x1="95" y1="110" x2="75" y2="165" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <line x1="95" y1="110" x2="115" y2="165" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          </svg>
          {LOADOUT_SLOTS.map(slot => {
            const pos = LOADOUT_SLOT_POSITIONS[slot.slotId];
            const color = slot.item ? RARITY_COLORS[slot.item.rarity] ?? STATUS_SUBDUED : STATUS_LOCKED_STROKE;
            return (
              <motion.div key={slot.slotId} className="absolute flex flex-col items-center"
                style={{ left: pos.x, top: pos.y }}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.1 }}>
                <div className="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-[11px] font-bold font-mono shadow-lg"
                  style={{ borderColor: `${color}80`, backgroundColor: `${color}20`, color, boxShadow: slot.item ? `0 0 8px ${color}40` : 'none' }}
                  title={slot.item ? `${slot.item.name} (${slot.item.rarity})` : `Empty: ${slot.slotName}`}>
                  {slot.item ? slot.item.name.charAt(0) : '?'}
                </div>
                <span className="text-[10px] font-mono text-text-muted mt-0.5">{slot.slotName}</span>
              </motion.div>
            );
          })}
        </div>
        {/* Stat summary */}
        <div className="flex-1 min-w-[200px] space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Stat Contributions</p>
          {(() => {
            const totals: Record<string, { value: number; sources: string[] }> = {};
            for (const slot of LOADOUT_SLOTS) {
              if (!slot.item) continue;
              for (const [stat, val] of Object.entries(slot.item.stats)) {
                if (!totals[stat]) totals[stat] = { value: 0, sources: [] };
                totals[stat].value += val;
                totals[stat].sources.push(slot.item.name);
              }
            }
            const maxVal = Math.max(...Object.values(totals).map(t => t.value), 1);
            return Object.entries(totals).map(([stat, d]) => (
              <div key={stat} className="space-y-0.5">
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-text-muted">{stat}</span>
                  <span className="text-text font-bold" style={{ textShadow: `0 0 12px ${ACCENT}40` }}>{d.value}</span>
                </div>
                <NeonBar pct={(d.value / maxVal) * 100} color={ACCENT} glow />
                <p className="text-[10px] text-text-muted opacity-60">{d.sources.join(', ')}</p>
              </div>
            ));
          })()}
        </div>
      </div>
    </BlueprintPanel>
  );
}

/* ── Set Bonus Section ─────────────────────────────────────────────────── */

export function SetBonusSection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader icon={Crown} label="Set Bonus System Preview" color={ACCENT} />
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Track set collection progress and bonus thresholds.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ITEM_SETS.map(set => {
          const ownedCount = set.pieces.filter(p => p.owned).length;
          return (
            <motion.div key={set.name} className="p-3 rounded-lg border space-y-3"
              style={{ borderColor: `${set.color}40`, backgroundColor: `${set.color}06` }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text" style={{ textShadow: `0 0 12px ${set.color}40` }}>{set.name}</span>
                <span className="text-sm font-mono font-bold" style={{ color: set.color }}>{ownedCount}/{set.pieces.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {set.pieces.map(piece => (
                  <div key={piece.slot} className="flex items-center gap-1.5 text-sm font-mono px-2 py-1 rounded border"
                    style={{ borderColor: piece.owned ? `${set.color}50` : 'var(--border)', backgroundColor: piece.owned ? `${set.color}15` : 'transparent', opacity: piece.owned ? 1 : 0.5 }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: piece.owned ? set.color : STATUS_SUBDUED }} />
                    <span className="text-text-muted">{piece.slot}:</span>
                    <span className={piece.owned ? 'text-text' : 'text-text-muted'}>{piece.name}</span>
                    {!piece.owned && <span className="text-red-400 text-[10px]">(missing)</span>}
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 border-t pt-2" style={{ borderColor: `${set.color}20` }}>
                {set.bonuses.map(bonus => {
                  const active = ownedCount >= bonus.pieces;
                  return (
                    <div key={bonus.pieces} className="flex items-center gap-2 text-sm font-mono" style={{ opacity: active ? 1 : 0.4 }}>
                      <span className="w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold border"
                        style={{ borderColor: active ? `${set.color}60` : 'var(--border)', backgroundColor: active ? `${set.color}20` : 'transparent', color: active ? set.color : 'var(--text-muted)' }}>
                        {bonus.pieces}
                      </span>
                      <span className={active ? 'text-text' : 'text-text-muted'}>{bonus.description}</span>
                      {active && <span className="text-emerald-400 text-[10px] font-mono uppercase tracking-[0.15em] ml-auto">ACTIVE</span>}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </BlueprintPanel>
  );
}

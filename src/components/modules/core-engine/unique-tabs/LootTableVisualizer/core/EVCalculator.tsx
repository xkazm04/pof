'use client';

import { useState, useMemo } from 'react';
import { Calculator, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_20, STATUS_WARNING,
  withOpacity, OPACITY_5,
} from '@/lib/chart-colors';
import { ACCENT, RARITY_TIERS, DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD } from '../data';
import { computeEVResults } from '../math';
import { BlueprintPanel, SectionHeader } from '../design';

export function EVCalculator() {
  const [rarityGold, setRarityGold] = useState<Record<string, number>>(DEFAULT_RARITY_GOLD);
  const [evKillsPerHour, setEvKillsPerHour] = useState(120);
  const [evSessionHours, setEvSessionHours] = useState(2);
  const [evTargetGold, setEvTargetGold] = useState(10000);

  const evResults = useMemo(
    () => computeEVResults(DEFAULT_ENEMY_LOOT_BINDINGS, rarityGold, evKillsPerHour, evSessionHours),
    [rarityGold, evKillsPerHour, evSessionHours],
  );

  const evMaxPerHour = useMemo(() => Math.max(...evResults.map(r => r.evPerHour), 1), [evResults]);

  return (
    <BlueprintPanel className="p-4 relative overflow-hidden">
      <SectionHeader icon={Calculator} label="Expected Value Calculator" color={ACCENT} />

      {/* Rarity sell-value inputs */}
      <div className="mb-4">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">Item Sell Values (gold per rarity)</div>
        <div className="flex flex-wrap gap-2">
          {RARITY_TIERS.map(tier => (
            <div key={tier.name} className="flex items-center gap-1.5 rounded-lg border px-2 py-1" style={{ borderColor: withOpacity(tier.color, OPACITY_20), backgroundColor: withOpacity(tier.color, OPACITY_5) }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
              <span className="text-xs font-mono" style={{ color: tier.color }}>{tier.name}</span>
              <input type="number" min={0} step={5} value={rarityGold[tier.name]}
                onChange={e => setRarityGold(prev => ({ ...prev, [tier.name]: Math.max(0, Number(e.target.value)) }))}
                className="w-16 bg-surface-deep/50 border border-border/40 rounded px-1.5 py-0.5 text-xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-current/50" />
              <span className="text-xs font-mono text-text-muted">g</span>
            </div>
          ))}
        </div>
      </div>

      {/* Session parameters */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs font-mono text-text-muted">
        <label className="flex items-center gap-1.5">
          Kills/hr:
          <input type="number" min={1} max={600} step={10} value={evKillsPerHour}
            onChange={e => setEvKillsPerHour(Math.max(1, Number(e.target.value)))}
            className="w-16 bg-surface-deep/50 border border-border/40 rounded px-1.5 py-0.5 text-xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-current/50" />
        </label>
        <label className="flex items-center gap-1.5">
          Session (hrs):
          <input type="number" min={0.5} max={12} step={0.5} value={evSessionHours}
            onChange={e => setEvSessionHours(Math.max(0.5, Number(e.target.value)))}
            className="w-16 bg-surface-deep/50 border border-border/40 rounded px-1.5 py-0.5 text-xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-current/50" />
        </label>
      </div>

      {/* EV Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {evResults.map(r => (
          <motion.div key={r.archetypeId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border p-3" style={{ borderColor: withOpacity(r.color, OPACITY_20), backgroundColor: withOpacity(r.color, OPACITY_5) }}>
            <div className="text-xs font-bold mb-2" style={{ color: r.color }}>{r.archetypeName}</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-muted">EV / kill</span>
                <span className="font-bold text-text">{r.evPerKill.toFixed(1)}g</span>
              </div>
              <div className="flex justify-between text-xs font-mono pl-3 text-text-muted">
                <span>Items</span><span>{r.goldFromItems.toFixed(1)}g</span>
              </div>
              <div className="flex justify-between text-xs font-mono pl-3 text-text-muted">
                <span>Bonus gold</span><span>{r.goldFromBonus}g</span>
              </div>
              <div className="border-t border-border/30 my-1" />
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-muted">EV / hour</span>
                <span className="font-bold" style={{ color: STATUS_WARNING }}>{Math.round(r.evPerHour).toLocaleString()}g</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-muted">EV / session ({evSessionHours}h)</span>
                <span className="font-bold" style={{ color: STATUS_WARNING }}>{Math.round(r.evPerSession).toLocaleString()}g</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Farming Efficiency Bar Chart */}
      <div className="mb-4">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">Farming Efficiency (gold/hour)</div>
        <div className="space-y-2">
          {evResults.map((r, i) => (
            <div key={r.archetypeId} className="flex items-center gap-2">
              <span className="text-xs font-mono w-24 text-right truncate" style={{ color: r.color }}>{r.archetypeName}</span>
              <div className="flex-1 h-5 bg-surface-deep/50 rounded-full overflow-hidden relative">
                <motion.div className="h-full rounded-full flex items-center justify-end pr-2" style={{ backgroundColor: r.color }}
                  initial={{ width: 0 }} animate={{ width: `${(r.evPerHour / evMaxPerHour) * 100}%` }} transition={{ duration: 0.5, delay: i * 0.1 }}>
                  <span className="text-xs font-mono font-bold text-black/80 whitespace-nowrap">{Math.round(r.evPerHour).toLocaleString()}g/hr</span>
                </motion.div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakeven Calculator */}
      <div className="rounded-lg border p-3" style={{ borderColor: withOpacity(ACCENT, OPACITY_20), backgroundColor: withOpacity(ACCENT, OPACITY_5) }}>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          <span className="text-xs font-mono font-bold" style={{ color: ACCENT }}>Breakeven Calculator</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs font-mono text-text-muted mb-3">
          Target gold:
          <input type="number" min={100} step={1000} value={evTargetGold}
            onChange={e => setEvTargetGold(Math.max(100, Number(e.target.value)))}
            className="w-24 bg-surface-deep/50 border border-border/40 rounded px-1.5 py-0.5 text-xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-current/50" />
          <span>g</span>
        </label>
        <div className="space-y-1.5">
          {evResults.map(r => {
            const killsNeeded = r.evPerKill > 0 ? Math.ceil(evTargetGold / r.evPerKill) : Infinity;
            const hoursNeeded = r.evPerHour > 0 ? evTargetGold / r.evPerHour : Infinity;
            return (
              <div key={r.archetypeId} className="flex items-center gap-3 text-xs font-mono">
                <span className="w-24 text-right font-bold truncate" style={{ color: r.color }}>{r.archetypeName}</span>
                <span className="text-text-muted">
                  <span className="font-bold text-text">{killsNeeded === Infinity ? '\u221E' : killsNeeded.toLocaleString()}</span> kills
                </span>
                <span className="text-text-muted">
                  &asymp; <span className="font-bold text-text">{hoursNeeded === Infinity ? '\u221E' : hoursNeeded.toFixed(1)}</span> hrs
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </BlueprintPanel>
  );
}

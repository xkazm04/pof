'use client';

import { useState, useMemo, useCallback } from 'react';
import { Skull, Code, Copy, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OPACITY_20, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import { SectionHeader } from './design';
import { ACCENT, RARITY_TIERS, DEFAULT_ENEMY_LOOT_BINDINGS } from './data';
import type { EnemyLootBinding as ELBinding } from './data';
import { simulateKills } from './math';
import { generateEnemyLootCpp } from './codegen';
import { BlueprintPanel } from './design';

export function EnemyLootBindingSection() {
  const [enemyLootBindings] = useState<ELBinding[]>(DEFAULT_ENEMY_LOOT_BINDINGS);
  const [simKillCount, setSimKillCount] = useState(100);
  const [copiedLootCpp, setCopiedLootCpp] = useState(false);
  const [showLootCpp, setShowLootCpp] = useState(false);

  const simResults = useMemo(
    () => enemyLootBindings.map(b => ({ binding: b, drops: simulateKills(b, simKillCount) })),
    [enemyLootBindings, simKillCount],
  );

  const handleCopyLootCpp = useCallback(() => {
    navigator.clipboard.writeText(generateEnemyLootCpp(enemyLootBindings));
    setCopiedLootCpp(true);
    setTimeout(() => setCopiedLootCpp(false), 2000);
  }, [enemyLootBindings]);

  return (
    <BlueprintPanel className="p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <SectionHeader label="Enemy -> LootTable Binding" color={ACCENT} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-2xs font-mono text-text-muted">
            <span>Kills:</span>
            <input type="number" min={10} max={10000} step={10} value={simKillCount}
              onChange={e => setSimKillCount(Math.max(10, Number(e.target.value)))}
              className="w-16 bg-surface-deep/50 border border-border/40 rounded px-1.5 py-0.5 text-2xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
          </div>
          <button onClick={() => setShowLootCpp(!showLootCpp)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-mono font-bold transition-all border"
            style={{ borderColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, backgroundColor: `${ACCENT}08` }}>
            <Code className="w-3 h-3" /> C++
          </button>
        </div>
      </div>

      {/* Binding cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2.5">
        {simResults.map(({ binding, drops }) => {
          const totalDrops = drops.reduce((s, d) => s + d.count, 0);
          const maxCount = Math.max(...drops.map(d => d.count), 1);
          const totalWeight = binding.rarityWeights.reduce((s, w) => s + w, 0);

          return (
            <div key={binding.archetypeId} className="rounded-lg border p-3" style={{ borderColor: `${binding.color}${OPACITY_20}`, backgroundColor: `${binding.color}05` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${binding.color}20`, color: binding.color }}>{binding.icon}</div>
                <div className="flex-1">
                  <div className="text-xs font-bold" style={{ color: binding.color }}>{binding.archetypeName}</div>
                  <div className="text-[11px] font-mono text-text-muted">{binding.lootTableName}</div>
                </div>
                <Skull className="w-3.5 h-3.5 text-text-muted" />
              </div>
              <div className="flex items-center gap-3 mb-2.5 text-[11px] font-mono text-text-muted">
                <span>Drop: <span className="font-bold text-text">{(binding.dropChance * 100).toFixed(0)}%</span></span>
                <span>Gold: <span className="font-bold text-text">{binding.bonusGold}</span></span>
                <span>Items: <span className="font-bold" style={{ color: binding.color }}>{totalDrops}</span></span>
              </div>
              <div className="space-y-1">
                {RARITY_TIERS.map((tier, ri) => {
                  const drop = drops[ri];
                  const pct = totalWeight > 0 ? (binding.rarityWeights[ri] / totalWeight * 100) : 0;
                  const barW = maxCount > 0 ? (drop.count / maxCount * 100) : 0;
                  return (
                    <div key={tier.name} className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono w-12 text-right text-text-muted truncate">{tier.name}</span>
                      <div className="flex-1 h-2.5 bg-surface-deep/50 rounded-full overflow-hidden relative">
                        <motion.div className="h-full rounded-full" style={{ backgroundColor: tier.color }} initial={{ width: 0 }} animate={{ width: `${barW}%` }} transition={{ duration: 0.4, delay: ri * 0.05 }} />
                      </div>
                      <span className="text-[11px] font-mono w-6 text-right font-bold" style={{ color: tier.color }}>{drop.count}</span>
                      <span className="text-[11px] font-mono w-8 text-right text-text-muted">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 h-3 rounded-full overflow-hidden flex">
                {RARITY_TIERS.map((tier, ri) => {
                  const drop = drops[ri];
                  const pct = totalDrops > 0 ? (drop.count / totalDrops * 100) : 0;
                  return <motion.div key={tier.name} className="h-full" style={{ backgroundColor: tier.color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: ri * 0.05 }} title={`${tier.name}: ${drop.count} (${pct.toFixed(1)}%)`} />;
                })}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono">
                <span className="text-text-muted">Total gold ({simKillCount} kills)</span>
                <span className="font-bold" style={{ color: STATUS_WARNING }}>{(simKillCount * binding.bonusGold).toLocaleString()}g</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rarity legend */}
      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        {RARITY_TIERS.map(tier => (
          <div key={tier.name} className="flex items-center gap-1 text-[11px] font-mono">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: tier.color }} />
            <span style={{ color: tier.color }}>{tier.name}</span>
          </div>
        ))}
      </div>

      {/* C++ code output */}
      <AnimatePresence>
        {showLootCpp && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
            <div className="bg-[#0d1117] rounded-xl border border-border/40 overflow-hidden">
              <div className="px-3 py-1.5 bg-surface-deep/50 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-3 h-3 text-text-muted" />
                  <span className="text-2xs font-mono text-text-muted">ARPGEnemyCharacter -- LootTable Integration</span>
                </div>
                <button onClick={handleCopyLootCpp} className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono font-bold"
                  style={{ color: copiedLootCpp ? STATUS_SUCCESS : ACCENT, backgroundColor: copiedLootCpp ? `${STATUS_SUCCESS}15` : `${ACCENT}10` }}>
                  {copiedLootCpp ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedLootCpp ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 text-2xs font-mono leading-relaxed text-cyan-100/90 overflow-x-auto custom-scrollbar max-h-[350px] overflow-y-auto">
                {generateEnemyLootCpp(enemyLootBindings)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BlueprintPanel>
  );
}

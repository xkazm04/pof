'use client';

import { useMemo, useState, useCallback } from 'react';
import { Coins, Dices, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  OPACITY_8, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { TabHeader, PipelineFlow, SectionLabel, FeatureCard, LoadingSpinner } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';

const ACCENT = ACCENT_ORANGE;

/* ── Rarity tiers ──────────────────────────────────────────────────────────── */

interface RarityTier {
  name: string;
  color: string;
  weight: number;
}

const RARITY_TIERS: RarityTier[] = [
  { name: 'Common', color: '#94a3b8', weight: 50 },
  { name: 'Uncommon', color: ACCENT_EMERALD, weight: 25 },
  { name: 'Rare', color: '#60a5fa', weight: 15 },
  { name: 'Epic', color: '#a78bfa', weight: 8 },
  { name: 'Legendary', color: '#fbbf24', weight: 2 },
];

const TOTAL_WEIGHT = RARITY_TIERS.reduce((sum, t) => sum + t.weight, 0);

/* ── World item examples per rarity ───────────────────────────────────────── */

const WORLD_ITEMS = [
  { name: 'Iron Sword', rarity: 'Common', beamColor: '#94a3b8', pickup: 'Auto-pickup on overlap' },
  { name: 'Forest Bow', rarity: 'Uncommon', beamColor: ACCENT_EMERALD, pickup: 'Prompt on interact' },
  { name: 'Azure Staff', rarity: 'Rare', beamColor: '#60a5fa', pickup: 'Highlight + prompt' },
  { name: 'Shadow Cloak', rarity: 'Epic', beamColor: '#a78bfa', pickup: 'Glow + prompt + SFX' },
  { name: 'Sunfire Amulet', rarity: 'Legendary', beamColor: '#fbbf24', pickup: 'Beam + VFX + fanfare' },
];

/* ── Feature names for this module ────────────────────────────────────────── */

const LOOT_FEATURES = [
  'UARPGLootTable',
  'Weighted random selection',
  'AARPGWorldItem',
  'Loot drop on death',
  'Item pickup',
  'Loot visual feedback',
  'Chest/container actors',
];

/* ── Component ─────────────────────────────────────────────────────────────── */

interface LootTableVisualizerProps {
  moduleId: SubModuleId;
}

export function LootTableVisualizer({ moduleId }: LootTableVisualizerProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [rollCount, setRollCount] = useState<number | null>(null);
  const [rollResults, setRollResults] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    let implemented = 0;
    for (const name of LOOT_FEATURES) {
      const status = featureMap.get(name)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
    }
    return { total: LOOT_FEATURES.length, implemented };
  }, [featureMap]);

  const rollDrops = useCallback((n: number) => {
    setRollCount(n);
    const tally: Record<string, number> = {};
    for (const t of RARITY_TIERS) tally[t.name] = 0;
    for (let i = 0; i < n; i++) {
      let roll = Math.random() * TOTAL_WEIGHT;
      for (const tier of RARITY_TIERS) {
        roll -= tier.weight;
        if (roll <= 0) { tally[tier.name]++; break; }
      }
    }
    setRollResults(tally);
  }, []);

  const toggleExpand = useCallback((name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-3">
      {/* Header + pipeline */}
      <TabHeader icon={Coins} title="Loot Table Visualizer" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      <SurfaceCard level={2} className="p-3">
        <SectionLabel label="Pipeline" />
        <div className="mt-2">
          <PipelineFlow steps={['LootTable', 'WeightedRandom', 'WorldItem', 'Pickup', 'Inventory']} accent={ACCENT} />
        </div>
      </SurfaceCard>

      {/* Stacked weight bar + rarity distribution */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <SurfaceCard level={2} className="p-3">
          <div className="text-2xs text-text-muted font-medium mb-2">Drop Weight Distribution</div>
          <div className="flex h-5 rounded overflow-hidden w-full">
            {RARITY_TIERS.map((tier) => (
              <div
                key={tier.name}
                title={`${tier.name}: ${tier.weight}% weight`}
                style={{ width: `${(tier.weight / TOTAL_WEIGHT) * 100}%`, backgroundColor: tier.color }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {RARITY_TIERS.map((tier) => (
              <span key={tier.name} className="flex items-center gap-1 text-2xs text-text-muted">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: tier.color }} />
                {tier.name}
              </span>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard level={2} className="p-3 min-w-[140px]">
          <div className="text-2xs text-text-muted font-medium mb-2">Rarity %</div>
          <div className="space-y-1">
            {RARITY_TIERS.map((tier) => (
              <div key={tier.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tier.color }} />
                <span className="text-2xs text-text w-16">{tier.name}</span>
                <span className="text-2xs font-mono text-text-muted ml-auto">
                  {((tier.weight / TOTAL_WEIGHT) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* Drop simulator */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Dices className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
          <span className="text-xs font-semibold text-text">Drop Simulator</span>
          <div className="flex gap-1 ml-auto">
            {[10, 100, 1000].map((n) => (
              <button
                key={n}
                onClick={() => rollDrops(n)}
                className="text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80"
                style={{
                  borderColor: `${ACCENT_CYAN}${OPACITY_30}`,
                  backgroundColor: rollCount === n ? `${ACCENT_CYAN}${OPACITY_20}` : 'transparent',
                  color: ACCENT_CYAN,
                }}
              >
                Roll {n}
              </button>
            ))}
          </div>
        </div>
        {rollCount !== null ? (
          <div className="flex flex-wrap gap-2">
            {RARITY_TIERS.map((tier) => (
              <div
                key={tier.name}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border"
                style={{ borderColor: `${tier.color}${OPACITY_30}`, backgroundColor: `${tier.color}${OPACITY_8}` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
                <span className="text-xs text-text">{tier.name}</span>
                <span className="text-xs font-mono font-semibold" style={{ color: tier.color }}>
                  {rollResults[tier.name] ?? 0}
                </span>
              </div>
            ))}
            <span className="text-2xs text-text-muted self-center">/ {rollCount} drops</span>
          </div>
        ) : (
          <p className="text-2xs text-text-muted italic">Click a button to simulate drops.</p>
        )}
      </SurfaceCard>

      {/* World item preview */}
      <div>
        <div className="mb-2 px-1"><SectionLabel label="World Item Preview" /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WORLD_ITEMS.map((item) => (
            <motion.div
              key={item.name}
              whileHover={{ y: -4, scale: 1.02 }}
              className="relative group h-full"
              style={{ perspective: 1000 }}
            >
              <SurfaceCard level={2} className="h-full px-3 py-3 flex items-start gap-3 relative overflow-hidden transition-all duration-300 border border-transparent group-hover:border-text-muted/20"
                style={{
                  boxShadow: `0 4px 15px -5px rgba(0,0,0,0.5), inset 0 0 10px -5px ${item.beamColor}40`,
                }}
              >
                {/* Glow & Particles */}
                <div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,255,255,0.05)] to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity" style={{ backgroundColor: item.beamColor }} />
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" style={{ backgroundImage: `radial-gradient(circle at center, ${item.beamColor}20 1px, transparent 1px)`, backgroundSize: '8px 8px' }} />

                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0 relative z-10 shadow-[0_0_8px_currentColor]"
                  style={{ backgroundColor: item.beamColor, color: item.beamColor }}
                />
                <div className="min-w-0 relative z-10 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 rounded bg-surface border border-border/50 shadow-inner">
                      <Package className="w-3.5 h-3.5 flex-shrink-0" style={{ color: item.beamColor, filter: `drop-shadow(0 0 4px ${item.beamColor}80)` }} />
                    </div>
                    <span className="text-sm font-bold text-text truncate tracking-wide">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5 px-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.beamColor, boxShadow: `0 0 5px ${item.beamColor}` }} />
                    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: item.beamColor }}>{item.rarity}</span>
                  </div>
                  <p className="text-xs text-text-muted bg-surface-deep/50 px-2 py-1.5 rounded border border-border/30 shadow-inner leading-relaxed">{item.pickup}</p>
                </div>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Feature status list */}
      <div className="space-y-1.5">
        {LOOT_FEATURES.map((name) => (
          <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={toggleExpand} accent={ACCENT} />
        ))}
      </div>
    </div>
  );
}

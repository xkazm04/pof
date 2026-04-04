'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_EMERALD, RARITY_COLORS } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface InventoryCatalogPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_EMERALD;

const ITEM_TYPES = [
  { name: 'Weapon', count: 12, icon: '⚔️' },
  { name: 'Armor', count: 8, icon: '🛡️' },
  { name: 'Consumable', count: 6, icon: '🧪' },
  { name: 'Material', count: 15, icon: '💎' },
] as const;

const RARITY_TIERS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;

const CATALOG_PIPELINE = ['ItemDefinition', 'ItemInstance', 'InventoryComponent', 'StackMgr', 'UI'] as const;

const INVENTORY_FEATURES = [
  'UARPGItemDefinition', 'UARPGItemInstance', 'UARPGInventoryComponent',
  'Equipment slot system', 'Consumable usage', 'Affix system',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function CatalogMicro({ defs, featureMap }: InventoryCatalogPanelProps) {
  const completed = defs.filter((d) => {
    const s = featureMap.get(d.featureName)?.status;
    return s === 'implemented' || s === 'improved';
  }).length;
  const total = defs.length;

  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Package className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{completed}/{total}</span>
      <span className="text-2xs text-text-muted">{ITEM_TYPES.reduce((s, t) => s + t.count, 0)} items</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function CatalogCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {ITEM_TYPES.map((type) => {
        return (
          <div key={type.name} className="flex items-center gap-2">
            <span className="w-4 text-center">{type.icon}</span>
            <span className="text-text font-medium flex-1">{type.name}</span>
            <span className="font-mono text-text-muted">{type.count}</span>
          </div>
        );
      })}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider}`}>
        <div className="flex gap-1">
          {RARITY_TIERS.map((r) => (
            <span
              key={r}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: RARITY_COLORS[r] }}
              title={r}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function CatalogFull({ featureMap, defs }: InventoryCatalogPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      {/* Description */}
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Item catalog system built on <span className="font-mono text-xs text-text">UARPGItemDefinition</span> (PrimaryDataAsset) with runtime instances, stack management, rarity tiers, and affix rolling.
      </SurfaceCard>

      {/* Item Type Grid */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Package} label="Item Type Catalog" color={ACCENT} />
        <div className={`grid grid-cols-2 ${DZIN_SPACING.full.gridGap} mt-2`}>
          {ITEM_TYPES.map((type, i) => (
            <motion.div
              key={type.name}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
              className="bg-surface-deep border rounded-xl p-3 text-center relative overflow-hidden group"
              style={{ borderColor: `${ACCENT}40` }}
            >
              <div className="text-lg mb-1">{type.icon}</div>
              <div className="text-xs font-mono font-bold" style={{ color: ACCENT }}>{type.name}</div>
              <div className="text-2xs text-text-muted mt-0.5">{type.count} definitions</div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Rarity Distribution */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <div className="text-xs font-bold uppercase text-text-muted mb-2">Rarity Tiers</div>
        <div className="flex gap-2">
          {RARITY_TIERS.map((r) => (
            <div key={r} className="flex-1 text-center">
              <div
                className="w-full h-2 rounded-full mb-1"
                style={{ backgroundColor: `${RARITY_COLORS[r]}40` }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ backgroundColor: RARITY_COLORS[r], width: `${100 - RARITY_TIERS.indexOf(r) * 20}%` }}
                />
              </div>
              <span className="text-2xs font-mono" style={{ color: RARITY_COLORS[r] }}>{r}</span>
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {INVENTORY_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Inventory Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...CATALOG_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function InventoryCatalogPanel({ featureMap, defs }: InventoryCatalogPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Item Catalog" icon={<Package className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <CatalogMicro featureMap={featureMap} defs={defs} />}
          {density === 'compact' && <CatalogCompact />}
          {density === 'full' && <CatalogFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}

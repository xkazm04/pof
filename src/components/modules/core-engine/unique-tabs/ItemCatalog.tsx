'use client';

import { useMemo, useState, useCallback } from 'react';
import { Package, ChevronDown, ChevronRight, ExternalLink, Layers, Search, Filter } from 'lucide-react';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { motion, AnimatePresence } from 'framer-motion';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { STATUS_COLORS, TabHeader, PipelineFlow, SectionLabel, LoadingSpinner } from './_shared';

const ACCENT = MODULE_COLORS.core;

/* ── Rarity colors ─────────────────────────────────────────────────────── */

const RARITY_COLORS: Record<string, string> = {
  Common: '#94a3b8',
  Uncommon: STATUS_SUCCESS,
  Rare: MODULE_COLORS.core,
  Epic: MODULE_COLORS.systems,
  Legendary: '#f59e0b',
};

/* ── Equipment slot layout ─────────────────────────────────────────────── */

interface SlotConfig {
  id: string;
  label: string;
  featureName: string;
}

const EQUIPMENT_SLOTS: SlotConfig[] = [
  { id: 'Head', label: 'Head', featureName: 'Equipment slot system' },
  { id: 'Chest', label: 'Chest', featureName: 'Equipment slot system' },
  { id: 'Legs', label: 'Legs', featureName: 'Equipment slot system' },
  { id: 'Feet', label: 'Feet', featureName: 'Equipment slot system' },
  { id: 'MainHand', label: 'Main Hand', featureName: 'Equipment slot system' },
  { id: 'OffHand', label: 'Off Hand', featureName: 'Equipment slot system' },
];

/* ── Affix examples ────────────────────────────────────────────────────── */

const AFFIX_EXAMPLES = [
  { name: 'of Power', stat: '+15% Atk Power', tier: 'Prefix', rarity: 'Uncommon' },
  { name: 'of Fortitude', stat: '+200 Max HP', tier: 'Prefix', rarity: 'Rare' },
  { name: 'Blazing', stat: '+Fire Damage', tier: 'Suffix', rarity: 'Rare' },
  { name: 'Vampiric', stat: '+8% Life Steal', tier: 'Prefix', rarity: 'Epic' },
  { name: 'of Legends', stat: '+2 All Skills', tier: 'Suffix', rarity: 'Legendary' },
];

/* ── System pipeline nodes ─────────────────────────────────────────────── */

const SYSTEM_PIPELINE = [
  { label: 'ItemDefinition', featureName: 'UARPGItemDefinition' },
  { label: 'ItemInstance', featureName: 'UARPGItemInstance' },
  { label: 'InventoryComponent', featureName: 'UARPGInventoryComponent' },
  { label: 'EquipmentSlot', featureName: 'Equipment slot system' },
  { label: 'GAS Effect', featureName: 'Equip/unequip GAS flow' },
];

/* ── Dummy Items for Catalog ───────────────────────────────────────────── */

interface ItemData {
  id: string;
  name: string;
  type: 'Weapon' | 'Armor' | 'Consumable';
  subtype: string;
  rarity: string;
  stats: { label: string; value: string }[];
  description: string;
  effect?: string;
}

const DUMMY_ITEMS: ItemData[] = [
  { id: '1', name: 'Iron Longsword', type: 'Weapon', subtype: 'Sword', rarity: 'Common', stats: [{ label: 'Damage', value: '12-18' }, { label: 'Speed', value: '1.2s' }], description: 'A standard issue longsword.' },
  { id: '2', name: 'Ranger\'s Bow', type: 'Weapon', subtype: 'Bow', rarity: 'Uncommon', stats: [{ label: 'Damage', value: '15-22' }, { label: 'Range', value: '25m' }], description: 'A sturdy bow made of yew.' },
  { id: '3', name: 'Crystal Staff', type: 'Weapon', subtype: 'Staff', rarity: 'Rare', stats: [{ label: 'M. Atk', value: '25-35' }, { label: 'Mana Regen', value: '+5/s' }], description: 'Pulsing with arcane energy.', effect: 'Spells cost 10% less mana.' },
  { id: '4', name: 'Steel Chestplate', type: 'Armor', subtype: 'Chestplate', rarity: 'Uncommon', stats: [{ label: 'Armor', value: '45' }, { label: 'Weight', value: 'Heavy' }], description: 'Solid protection for the frontline.' },
  { id: '5', name: 'Assassin\'s Cowl', type: 'Armor', subtype: 'Helm', rarity: 'Epic', stats: [{ label: 'Armor', value: '15' }, { label: 'Crit Chance', value: '+5%' }], description: 'Cloaks the wearer in shadows.', effect: 'Stealth detection reduced by 20%.' },
  { id: '6', name: 'Sunfire Amulet', type: 'Consumable', subtype: 'Elixir', rarity: 'Legendary', stats: [{ label: 'Uses', value: '1' }], description: 'Contains the essence of a dying star.', effect: 'Grants immunity to Fire damage for 60s.' },
  { id: '7', name: 'Minor Health Potion', type: 'Consumable', subtype: 'Potion', rarity: 'Common', stats: [{ label: 'Heal', value: '50 HP' }], description: 'A basic healing draft.' },
  { id: '8', name: 'Void Daggers', type: 'Weapon', subtype: 'Dagger', rarity: 'Legendary', stats: [{ label: 'Damage', value: '35-45' }, { label: 'Speed', value: '0.8s' }], description: 'Forged in the abyss.', effect: 'Attacks tear reality, ignoring 20% armor.' },
];

/* ── Component ─────────────────────────────────────────────────────────── */

interface ItemCatalogProps {
  moduleId: SubModuleId;
}

export function ItemCatalog({ moduleId }: ItemCatalogProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);

  const [filterType, setFilterType] = useState<string>('All');
  const [filterRarity, setFilterRarity] = useState<string>('All');
  const [affixOpen, setAffixOpen] = useState(false);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0, missing = 0;
    for (const d of defs) {
      const status = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
      else if (status === 'partial') partial++;
      else if (status === 'missing') missing++;
    }
    return { total, implemented, partial, missing };
  }, [defs, featureMap]);

  const filteredItems = useMemo(() => {
    return DUMMY_ITEMS.filter(item => {
      if (filterType !== 'All' && item.type !== filterType) return false;
      if (filterRarity !== 'All' && item.rarity !== filterRarity) return false;
      return true;
    });
  }, [filterType, filterRarity]);

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <TabHeader icon={Package} title="Item Catalog" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* System pipeline header */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent pointer-events-none" />
        <SectionLabel icon={Layers} label="System Pipeline" />
        <div className="mt-4 relative z-10">
          <PipelineFlow
            steps={SYSTEM_PIPELINE.map(n => ({ label: n.label, status: (featureMap.get(n.featureName)?.status ?? 'unknown') as FeatureStatus }))}
            accent={ACCENT}
            showStatus
          />
        </div>
      </SurfaceCard>

      {/* Main layout: Grid + Filters */}
      <div className="flex flex-col gap-4">
        {/* Filters bar */}
        <SurfaceCard level={2} className="p-3 flex flex-wrap items-center gap-4 sticky top-4 z-20 shadow-md">
          <div className="flex items-center gap-2 mr-auto">
            <Filter className="w-4 h-4 text-text-muted" />
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Filters</span>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-deep p-1 rounded-lg border border-border/40">
            {['All', 'Weapon', 'Armor', 'Consumable'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${filterType === t ? 'bg-surface text-text shadow-sm border border-border/50' : 'text-text-muted hover:text-text'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 bg-surface-deep p-1 rounded-lg border border-border/40">
            {['All', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map(r => (
              <button
                key={r}
                onClick={() => setFilterRarity(r)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${filterRarity === r ? 'bg-surface text-text shadow-sm border border-border/50' : 'text-text-muted hover:text-text'}`}
              >
                {r === 'All' ? 'All Rarities' : <span style={{ color: RARITY_COLORS[r] }}>{r}</span>}
              </button>
            ))}
          </div>
        </SurfaceCard>

        {/* Item Catalog Grid with Layout Animations */}
        <div className="relative min-h-[400px]">
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredItems.map(item => (
                <TradingCard key={item.id} item={item} />
              ))}
            </AnimatePresence>
          </motion.div>
          {filteredItems.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted opacity-50">
              <Search className="w-12 h-12 mb-4" />
              <p>No items found matching the current filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Legacy Equipment slots info (mini view) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Affix table collapsible */}
        <SurfaceCard level={2} className="p-0 overflow-hidden">
          <button
            onClick={() => setAffixOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/30 transition-colors text-left focus:outline-none"
          >
            <motion.div animate={{ rotate: affixOpen ? 90 : 0 }}>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </motion.div>
            <span className="text-sm font-bold text-text">Affix System Definitions</span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border shadow-sm ml-auto" style={{ backgroundColor: STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].bg, color: STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].dot, borderColor: `${STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].dot}40` }}>
              {STATUS_COLORS[featureMap.get('Affix system')?.status ?? 'unknown'].label}
            </span>
          </button>
          <AnimatePresence>
            {affixOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border/40 overflow-x-auto bg-surface/30">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 bg-surface-deep/50">
                        {['Affix', 'Modifier', 'Tier', 'Rarity'].map((h) => (
                          <th key={h} className="text-left px-4 py-2 text-text-muted font-bold uppercase tracking-wider text-[10px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {AFFIX_EXAMPLES.map((affix, i) => (
                        <motion.tr
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          key={affix.name} className="hover:bg-surface-hover/20 transition-colors"
                        >
                          <td className="px-4 py-2 font-mono text-text font-medium">{affix.name}</td>
                          <td className="px-4 py-2 text-text-muted">{affix.stat}</td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-0.5 rounded-md font-mono text-[10px] uppercase font-bold border shadow-sm" style={{ backgroundColor: affix.tier === 'Prefix' ? `${MODULE_COLORS.core}${OPACITY_10}` : `${MODULE_COLORS.systems}${OPACITY_10}`, color: affix.tier === 'Prefix' ? MODULE_COLORS.core : MODULE_COLORS.systems, borderColor: affix.tier === 'Prefix' ? `${MODULE_COLORS.core}40` : `${MODULE_COLORS.systems}40` }}>
                              {affix.tier}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-medium" style={{ color: RARITY_COLORS[affix.rarity] }}>{affix.rarity}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SurfaceCard>

        {/* Equipment Slots Status */}
        <SurfaceCard level={2} className="p-4">
          <SectionLabel label="Equipment Slot Topology" />
          <div className="mt-4 flex flex-wrap gap-2">
            {EQUIPMENT_SLOTS.map((slot) => {
              const slotStatus: FeatureStatus = featureMap.get(slot.featureName)?.status ?? 'unknown';
              const sc = STATUS_COLORS[slotStatus];
              return (
                <div
                  key={slot.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs shadow-sm border"
                  style={{ backgroundColor: `${sc.dot}${OPACITY_10}`, borderColor: `${sc.dot}${OPACITY_20}` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-[0_0_5px_currentColor]" style={{ backgroundColor: sc.dot, color: sc.dot }} />
                  <span className="text-text font-medium">{slot.label}</span>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

/* ── Trading Card Component ────────────────────────────────────────────── */

function TradingCard({ item }: { item: ItemData }) {
  const color = RARITY_COLORS[item.rarity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      whileHover={{ y: -5, scale: 1.02 }}
      className="group relative h-full"
      style={{ perspective: 1000 }}
    >
      <SurfaceCard
        level={3}
        className="h-full flex flex-col overflow-hidden relative border-2 shadow-xl transition-all duration-300"
        style={{
          borderColor: `${color}40`,
          boxShadow: `0 10px 30px -10px rgba(0,0,0,0.5), inset 0 0 20px -10px ${color}30`,
        }}
      >
        {/* Glow Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,255,255,0.05)] to-transparent pointer-events-none" />
        <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.1)] to-transparent -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none z-20" />

        {/* Header (Top) */}
        <div className="p-4 border-b relative" style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}>
          <div className="absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full pointer-events-none opacity-50" style={{ backgroundColor: color }} />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <h3 className="text-sm font-bold text-text leading-tight">{item.name}</h3>
              <p className="text-[10px] font-mono uppercase tracking-widest mt-1 opacity-80" style={{ color }}>{item.rarity} {item.subtype}</p>
            </div>
          </div>
        </div>

        {/* Content (Middle) */}
        <div className="p-4 flex-1 flex flex-col gap-3 relative z-10 bg-surface/50">
          {/* Main Artwork Placeholder */}
          <div className="w-full h-24 rounded-lg bg-surface-deep border flex items-center justify-center relative overflow-hidden group-hover:border-text-muted/50 transition-colors" style={{ borderColor: `${color}20` }}>
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Package className="w-10 h-10 opacity-30" style={{ color }} />
            </motion.div>
            {/* Particles */}
            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ backgroundImage: `radial-gradient(circle at center, ${color}20 1px, transparent 1px)`, backgroundSize: '10px 10px' }} />
          </div>

          {/* Stats Bar */}
          <div className="flex justify-around items-center py-2 border-y border-border/40">
            {item.stats.map(s => (
              <div key={s.label} className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">{s.label}</span>
                <span className="text-xs font-mono font-bold text-text mt-0.5">{s.value}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-text-muted italic leading-relaxed text-center">"{item.description}"</p>

          {item.effect && (
            <div className="mt-auto p-2.5 rounded-lg border text-xs font-medium text-text bg-surface-deep shadow-inner" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
              <span className="font-bold mr-1" style={{ color }}>Equip:</span>
              <span>{item.effect}</span>
            </div>
          )}
        </div>
      </SurfaceCard>
    </motion.div>
  );
}


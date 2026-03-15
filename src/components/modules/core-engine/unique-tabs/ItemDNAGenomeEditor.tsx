'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Dna, Plus, Trash2, Shuffle, Sparkles,
  Swords, Shield, Wrench, Coins, Zap, GitMerge,
  TrendingUp, Target, FlaskConical, BarChart3, Copy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, ACCENT_PINK, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, RadarChart, SubTabNavigation, SubTab, STAGGER_DEFAULT, STAGGER_SLOW } from './_shared';
import type {
  ItemGenome, TraitGene, TraitAxis, DNAAffix, DNARollResult,
} from '@/types/item-genome';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';
import {
  rollAffixesWithDNA, inheritGenomes, evolveGenome, predictDistribution,
} from '@/lib/item-dna/rolling-engine';

const ACCENT = MODULE_COLORS.core;

/* ── Trait axis config ─────────────────────────────────────────────────── */

interface AxisConfig {
  axis: TraitAxis;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  tags: string[];
}

const AXIS_CONFIGS: AxisConfig[] = [
  { axis: 'offensive', label: 'Offensive', icon: Swords, color: STATUS_ERROR, tags: ['Stat.Strength', 'Stat.AttackPower', 'Stat.CritChance', 'Stat.CritDamage', 'Stat.AttackSpeed', 'Stat.PenArmor'] },
  { axis: 'defensive', label: 'Defensive', icon: Shield, color: ACCENT_CYAN, tags: ['Stat.Armor', 'Stat.MaxHealth', 'Stat.HealthRegen', 'Stat.BlockChance', 'Stat.DodgeChance', 'Stat.Resistance'] },
  { axis: 'utility', label: 'Utility', icon: Wrench, color: ACCENT_EMERALD, tags: ['Stat.MoveSpeed', 'Stat.CooldownReduction', 'Stat.ManaCost', 'Stat.ManaRegen', 'Stat.MaxMana', 'Stat.AreaOfEffect'] },
  { axis: 'economic', label: 'Economic', icon: Coins, color: ACCENT_ORANGE, tags: ['Stat.GoldFind', 'Stat.MagicFind', 'Stat.XPBonus', 'Stat.ItemQuantity', 'Stat.VendorPrice', 'Stat.CraftBonus'] },
];

/* ── Demo affix pool ───────────────────────────────────────────────────── */

const DEMO_AFFIX_POOL: DNAAffix[] = [
  // Offensive
  { id: 'aff-str', name: 'of Strength', isPrefix: false, axis: 'offensive', tags: ['Stat.Strength'], minValue: 3, maxValue: 15, baseWeight: 1.5, minRarity: 'Common' },
  { id: 'aff-atk', name: 'Fierce', isPrefix: true, axis: 'offensive', tags: ['Stat.AttackPower'], minValue: 5, maxValue: 25, baseWeight: 1.2, minRarity: 'Common' },
  { id: 'aff-crit', name: 'of Precision', isPrefix: false, axis: 'offensive', tags: ['Stat.CritChance'], minValue: 2, maxValue: 12, baseWeight: 0.8, minRarity: 'Rare' },
  { id: 'aff-cdmg', name: 'Devastating', isPrefix: true, axis: 'offensive', tags: ['Stat.CritDamage'], minValue: 10, maxValue: 50, baseWeight: 0.5, minRarity: 'Epic' },
  { id: 'aff-aspd', name: 'of Haste', isPrefix: false, axis: 'offensive', tags: ['Stat.AttackSpeed'], minValue: 3, maxValue: 15, baseWeight: 0.7, minRarity: 'Rare' },
  // Defensive
  { id: 'aff-arm', name: 'Fortified', isPrefix: true, axis: 'defensive', tags: ['Stat.Armor'], minValue: 5, maxValue: 30, baseWeight: 1.5, minRarity: 'Common' },
  { id: 'aff-hp', name: 'of Vitality', isPrefix: false, axis: 'defensive', tags: ['Stat.MaxHealth'], minValue: 10, maxValue: 80, baseWeight: 1.3, minRarity: 'Common' },
  { id: 'aff-regen', name: 'Regenerating', isPrefix: true, axis: 'defensive', tags: ['Stat.HealthRegen'], minValue: 1, maxValue: 8, baseWeight: 0.6, minRarity: 'Rare' },
  { id: 'aff-dodge', name: 'of Evasion', isPrefix: false, axis: 'defensive', tags: ['Stat.DodgeChance'], minValue: 2, maxValue: 10, baseWeight: 0.5, minRarity: 'Epic' },
  // Utility
  { id: 'aff-spd', name: 'of Swiftness', isPrefix: false, axis: 'utility', tags: ['Stat.MoveSpeed'], minValue: 3, maxValue: 12, baseWeight: 1.0, minRarity: 'Common' },
  { id: 'aff-cdr', name: 'Quickened', isPrefix: true, axis: 'utility', tags: ['Stat.CooldownReduction'], minValue: 2, maxValue: 10, baseWeight: 0.8, minRarity: 'Rare' },
  { id: 'aff-mana', name: 'of Intellect', isPrefix: false, axis: 'utility', tags: ['Stat.MaxMana'], minValue: 10, maxValue: 60, baseWeight: 1.0, minRarity: 'Common' },
  { id: 'aff-mregen', name: 'Flowing', isPrefix: true, axis: 'utility', tags: ['Stat.ManaRegen'], minValue: 1, maxValue: 8, baseWeight: 0.7, minRarity: 'Rare' },
  // Economic
  { id: 'aff-gold', name: 'Prosperous', isPrefix: true, axis: 'economic', tags: ['Stat.GoldFind'], minValue: 5, maxValue: 30, baseWeight: 0.8, minRarity: 'Uncommon' },
  { id: 'aff-mf', name: 'of Fortune', isPrefix: false, axis: 'economic', tags: ['Stat.MagicFind'], minValue: 3, maxValue: 20, baseWeight: 0.6, minRarity: 'Rare' },
  { id: 'aff-xp', name: 'of the Scholar', isPrefix: false, axis: 'economic', tags: ['Stat.XPBonus'], minValue: 3, maxValue: 15, baseWeight: 0.5, minRarity: 'Epic' },
];

/* ── Preset genomes ────────────────────────────────────────────────────── */

function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function createGenome(name: string, color: string, overrides: Partial<ItemGenome>): ItemGenome {
  return {
    id: createId(),
    name,
    description: '',
    author: 'User',
    version: '1.0.0',
    color,
    updatedAt: new Date().toISOString(),
    traits: [
      { axis: 'offensive', weight: 0.25, affinityTags: [] },
      { axis: 'defensive', weight: 0.25, affinityTags: [] },
      { axis: 'utility', weight: 0.25, affinityTags: [] },
      { axis: 'economic', weight: 0.25, affinityTags: [] },
    ],
    mutation: { mutationRate: 0.08, maxMutations: 1, wildMutation: false },
    itemType: 'Weapon',
    minRarity: 'Common',
    ...overrides,
  };
}

const PRESET_GENOMES: ItemGenome[] = [
  createGenome('Warrior Blade', STATUS_ERROR, {
    description: 'Heavy melee weapon — biased toward raw strength and critical hits',
    itemType: 'Weapon',
    traits: [
      { axis: 'offensive', weight: 0.85, affinityTags: ['Stat.Strength', 'Stat.CritChance', 'Stat.AttackPower'] },
      { axis: 'defensive', weight: 0.15, affinityTags: ['Stat.Armor'] },
      { axis: 'utility', weight: 0.05, affinityTags: [] },
      { axis: 'economic', weight: 0.05, affinityTags: [] },
    ],
    mutation: { mutationRate: 0.05, maxMutations: 1, wildMutation: false },
    tags: ['melee', 'physical', 'warrior'],
  }),
  createGenome('Mage Staff', ACCENT_VIOLET, {
    description: 'Arcane catalyst — gravitates toward mana, cooldown, and spell amplification',
    itemType: 'Weapon',
    traits: [
      { axis: 'offensive', weight: 0.30, affinityTags: ['Stat.CritDamage'] },
      { axis: 'defensive', weight: 0.10, affinityTags: [] },
      { axis: 'utility', weight: 0.80, affinityTags: ['Stat.MaxMana', 'Stat.ManaRegen', 'Stat.CooldownReduction'] },
      { axis: 'economic', weight: 0.10, affinityTags: [] },
    ],
    mutation: { mutationRate: 0.10, maxMutations: 2, wildMutation: true },
    tags: ['ranged', 'magical', 'caster'],
  }),
  createGenome('Guardian Plate', ACCENT_CYAN, {
    description: 'Heavy armor — prioritizes survivability stats above all else',
    itemType: 'Armor',
    traits: [
      { axis: 'offensive', weight: 0.05, affinityTags: [] },
      { axis: 'defensive', weight: 0.90, affinityTags: ['Stat.Armor', 'Stat.MaxHealth', 'Stat.HealthRegen', 'Stat.BlockChance'] },
      { axis: 'utility', weight: 0.10, affinityTags: [] },
      { axis: 'economic', weight: 0.05, affinityTags: [] },
    ],
    mutation: { mutationRate: 0.03, maxMutations: 1, wildMutation: false },
    tags: ['heavy', 'tank', 'defense'],
  }),
  createGenome('Rogue Leather', ACCENT_EMERALD, {
    description: 'Agile armor — balanced offensive and utility with evasion traits',
    itemType: 'Armor',
    traits: [
      { axis: 'offensive', weight: 0.45, affinityTags: ['Stat.CritChance', 'Stat.AttackSpeed'] },
      { axis: 'defensive', weight: 0.20, affinityTags: ['Stat.DodgeChance'] },
      { axis: 'utility', weight: 0.40, affinityTags: ['Stat.MoveSpeed', 'Stat.CooldownReduction'] },
      { axis: 'economic', weight: 0.15, affinityTags: [] },
    ],
    mutation: { mutationRate: 0.12, maxMutations: 2, wildMutation: true },
    tags: ['light', 'agile', 'rogue'],
  }),
  createGenome('Merchant\'s Ring', ACCENT_ORANGE, {
    description: 'Economic accessory — maximizes gold find and magic find',
    itemType: 'Accessory',
    traits: [
      { axis: 'offensive', weight: 0.10, affinityTags: [] },
      { axis: 'defensive', weight: 0.10, affinityTags: [] },
      { axis: 'utility', weight: 0.20, affinityTags: ['Stat.XPBonus'] },
      { axis: 'economic', weight: 0.90, affinityTags: ['Stat.GoldFind', 'Stat.MagicFind', 'Stat.ItemQuantity'] },
    ],
    mutation: { mutationRate: 0.15, maxMutations: 2, wildMutation: true },
    tags: ['economic', 'farming', 'merchant'],
  }),
];

/* ── Helper: genome to radar data ──────────────────────────────────────── */

function genomeToRadar(genome: ItemGenome): RadarDataPoint[] {
  return AXIS_CONFIGS.map((cfg) => {
    const gene = genome.traits.find((g) => g.axis === cfg.axis);
    return { axis: cfg.label, value: gene?.weight ?? 0 };
  });
}

/* ── Sub-tabs ──────────────────────────────────────────────────────────── */

const SUB_TABS: SubTab[] = [
  { id: 'editor', label: 'DNA Editor', icon: Dna },
  { id: 'roller', label: 'Affix Roller', icon: Shuffle },
  { id: 'breeding', label: 'Breeding Lab', icon: GitMerge },
  { id: 'evolution', label: 'Evolution', icon: TrendingUp },
];

/* ── DNA Strand Visualization ──────────────────────────────────────────── */

function DNAStrand({ genome }: { genome: ItemGenome }) {
  const bases = 20;
  const height = 120;
  const width = 260;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Double helix backbone */}
      {Array.from({ length: bases }).map((_, i) => {
        const x = (i / (bases - 1)) * (width - 20) + 10;
        const y1 = height / 2 + Math.sin((i / bases) * Math.PI * 4) * 25;
        const y2 = height / 2 - Math.sin((i / bases) * Math.PI * 4) * 25;
        const traitIdx = i % 4;
        const cfg = AXIS_CONFIGS[traitIdx];
        const gene = genome.traits.find((g) => g.axis === cfg.axis);
        const intensity = gene?.weight ?? 0.25;

        return (
          <g key={i}>
            {/* Base pair connecting line */}
            <line x1={x} y1={y1} x2={x} y2={y2} stroke={`${cfg.color}40`} strokeWidth="1" />
            {/* Top strand node */}
            <motion.circle
              cx={x} cy={y1} r={2 + intensity * 3}
              fill={cfg.color}
              style={{ filter: `drop-shadow(0 0 ${2 + intensity * 4}px ${cfg.color})` }}
              animate={{ r: [2 + intensity * 3, 3 + intensity * 3, 2 + intensity * 3] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * STAGGER_SLOW }}
            />
            {/* Bottom strand node */}
            <motion.circle
              cx={x} cy={y2} r={2 + intensity * 3}
              fill={cfg.color}
              opacity={0.6}
              animate={{ r: [2 + intensity * 2, 3 + intensity * 2, 2 + intensity * 2] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * STAGGER_SLOW + 1 }}
            />
          </g>
        );
      })}
      {/* Backbone curves */}
      <path
        d={Array.from({ length: bases }).map((_, i) => {
          const x = (i / (bases - 1)) * (width - 20) + 10;
          const y = height / 2 + Math.sin((i / bases) * Math.PI * 4) * 25;
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ')}
        fill="none" stroke={`${genome.color}50`} strokeWidth="1.5"
      />
      <path
        d={Array.from({ length: bases }).map((_, i) => {
          const x = (i / (bases - 1)) * (width - 20) + 10;
          const y = height / 2 - Math.sin((i / bases) * Math.PI * 4) * 25;
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ')}
        fill="none" stroke={`${genome.color}50`} strokeWidth="1.5"
      />
    </svg>
  );
}

/* ── Predicted Distribution Bar ────────────────────────────────────────── */

function DistributionBar({ genome, rarity }: { genome: ItemGenome; rarity: string }) {
  const dist = useMemo(
    () => predictDistribution(genome, DEMO_AFFIX_POOL, rarity),
    [genome, rarity],
  );

  return (
    <div className="space-y-1">
      <div className="text-xs font-mono text-text-muted font-bold uppercase tracking-widest">
        Predicted Affix Distribution ({rarity})
      </div>
      <div className="flex h-5 rounded-md overflow-hidden border border-border/40">
        {AXIS_CONFIGS.map((cfg) => {
          const pct = (dist[cfg.axis] * 100);
          if (pct < 1) return null;
          return (
            <motion.div
              key={cfg.axis}
              className="h-full flex items-center justify-center text-xs font-mono font-bold"
              style={{ backgroundColor: `${cfg.color}60`, width: `${pct}%`, color: cfg.color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5 }}
              title={`${cfg.label}: ${pct.toFixed(1)}%`}
            >
              {pct > 10 ? `${pct.toFixed(0)}%` : ''}
            </motion.div>
          );
        })}
      </div>
      <div className="flex gap-3 flex-wrap">
        {AXIS_CONFIGS.map((cfg) => {
          const Icon = cfg.icon;
          return (
            <div key={cfg.axis} className="flex items-center gap-1 text-xs font-mono">
              <Icon className="w-3 h-3" style={{ color: cfg.color }} />
              <span style={{ color: cfg.color }}>{(dist[cfg.axis] * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Trait Slider ──────────────────────────────────────────────────────── */

function TraitSlider({
  gene, config, onChange,
}: { gene: TraitGene; config: AxisConfig; onChange: (w: number) => void }) {
  const Icon = config.icon;
  const pct = gene.weight * 100;

  return (
    <div className="group">
      <div className="flex items-center gap-2">
        <div className="p-1 rounded" style={{ backgroundColor: `${config.color}${OPACITY_10}` }}>
          <Icon className="w-3 h-3" style={{ color: config.color }} />
        </div>
        <span className="text-xs font-mono font-bold w-16 truncate" style={{ color: config.color }}>
          {config.label}
        </span>
        <div className="flex-1 relative h-4 flex items-center">
          <div className="absolute inset-x-0 h-1.5 bg-surface-deep rounded-full" />
          <motion.div
            className="absolute h-1.5 rounded-full"
            style={{ backgroundColor: config.color, boxShadow: `0 0 6px ${config.color}40` }}
            animate={{ width: `${Math.min(pct, 100)}%` }}
            transition={{ duration: 0.15 }}
          />
          <input
            type="range" min={0} max={100} step={1} value={pct}
            onChange={(e) => onChange(parseInt(e.target.value) / 100)}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
          <div
            className="absolute w-2.5 h-2.5 rounded-full border-2 border-surface shadow-md pointer-events-none"
            style={{ left: `calc(${Math.min(pct, 100)}% - 5px)`, backgroundColor: config.color }}
          />
        </div>
        <input
          type="number" min={0} max={100} step={1} value={Math.round(pct)}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v)) onChange(Math.max(0, Math.min(100, v)) / 100);
          }}
          className="w-12 text-xs font-mono font-bold text-right px-1 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
        />
        <span className="text-xs font-mono text-text-muted/60 w-4">%</span>
      </div>
      {/* Tag badges */}
      <div className="flex gap-1 ml-8 mt-0.5 flex-wrap">
        {gene.affinityTags.map((tag) => (
          <span
            key={tag}
            className="text-xs font-mono px-1 py-0 rounded"
            style={{ backgroundColor: `${config.color}${OPACITY_10}`, color: config.color, fontSize: '0.6rem' }}
          >
            {tag.replace('Stat.', '')}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Roll Result Card ──────────────────────────────────────────────────── */

function RollResultCard({ result, genome }: { result: DNARollResult; genome: ItemGenome }) {
  return (
    <SurfaceCard level={2} className="space-y-2 p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: genome.color }} />
          <span className="text-xs font-bold text-text">Rolled Affixes</span>
          <span className="text-xs font-mono text-text-muted">({result.affixes.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: result.coherenceScore > 0.6 ? STATUS_SUCCESS : result.coherenceScore > 0.3 ? STATUS_WARNING : STATUS_ERROR }}>
            {(result.coherenceScore * 100).toFixed(0)}% coherent
          </span>
          {result.hasMutations && (
            <span className="text-xs font-mono px-1 rounded" style={{ backgroundColor: `${ACCENT_PINK}${OPACITY_20}`, color: ACCENT_PINK }}>
              MUTANT
            </span>
          )}
        </div>
      </div>
      {result.affixes.length === 0 ? (
        <p className="text-xs text-text-muted italic">No affixes rolled (Common rarity)</p>
      ) : (
        <div className="space-y-1">
          {result.affixes.map((ra, i) => {
            const cfg = AXIS_CONFIGS.find((c) => c.axis === ra.affix.axis);
            return (
              <motion.div
                key={`${ra.affix.id}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * STAGGER_DEFAULT }}
                className="flex items-center gap-2 px-2 py-1 rounded-md text-xs"
                style={{
                  backgroundColor: ra.isMutation ? `${ACCENT_PINK}${OPACITY_10}` : `${cfg?.color ?? ACCENT}${OPACITY_10}`,
                  border: ra.isMutation ? `1px solid ${ACCENT_PINK}30` : `1px solid ${cfg?.color ?? ACCENT}20`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg?.color ?? ACCENT }} />
                <span className="font-mono font-bold" style={{ color: cfg?.color ?? ACCENT }}>
                  {ra.affix.isPrefix ? ra.affix.name : ''} Item {ra.affix.isPrefix ? '' : ra.affix.name}
                </span>
                <span className="ml-auto font-mono font-bold text-text">+{ra.rolledValue}</span>
                <span className="font-mono text-text-muted">{ra.affix.tags[0]?.replace('Stat.', '') ?? ''}</span>
                {ra.isMutation && <Dna className="w-3 h-3" style={{ color: ACCENT_PINK }} />}
              </motion.div>
            );
          })}
        </div>
      )}
    </SurfaceCard>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */

interface Props { moduleId: string }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ItemDNAGenomeEditor({ moduleId }: Props) {
  const [genomes, setGenomes] = useState<ItemGenome[]>(PRESET_GENOMES);
  const [selectedId, setSelectedId] = useState(PRESET_GENOMES[0].id);
  const [activeTab, setActiveTab] = useState('editor');
  const [rollRarity, setRollRarity] = useState('Rare');
  const [rollLevel, setRollLevel] = useState(10);
  const [rollResult, setRollResult] = useState<DNARollResult | null>(null);
  const [breedParentA, setBreedParentA] = useState<string | null>(null);
  const [breedParentB, setBreedParentB] = useState<string | null>(null);

  const selected = useMemo(
    () => genomes.find((g) => g.id === selectedId) ?? genomes[0],
    [genomes, selectedId],
  );

  const updateGenome = useCallback((id: string, updater: (g: ItemGenome) => ItemGenome) => {
    setGenomes((prev) => prev.map((g) => g.id === id ? updater(g) : g));
  }, []);

  const updateTrait = useCallback((axis: TraitAxis, weight: number) => {
    updateGenome(selected.id, (g) => ({
      ...g,
      traits: g.traits.map((t) => t.axis === axis ? { ...t, weight } : t),
      updatedAt: new Date().toISOString(),
    }));
  }, [selected.id, updateGenome]);

  const addGenome = useCallback(() => {
    const g = createGenome(`Custom ${genomes.length + 1}`, ACCENT, {});
    setGenomes((prev) => [...prev, g]);
    setSelectedId(g.id);
  }, [genomes.length]);

  const deleteGenome = useCallback((id: string) => {
    setGenomes((prev) => {
      const next = prev.filter((g) => g.id !== id);
      if (selectedId === id && next.length > 0) setSelectedId(next[0].id);
      return next;
    });
  }, [selectedId]);

  const doRoll = useCallback(() => {
    const result = rollAffixesWithDNA(selected, rollRarity, rollLevel, DEMO_AFFIX_POOL);
    setRollResult(result);
  }, [selected, rollRarity, rollLevel]);

  const doBreed = useCallback(() => {
    if (!breedParentA || !breedParentB) return;
    const pA = genomes.find((g) => g.id === breedParentA);
    const pB = genomes.find((g) => g.id === breedParentB);
    if (!pA || !pB) return;
    const result = inheritGenomes(pA, pB);
    const child = createGenome(
      `${pA.name} x ${pB.name}`,
      result.dominantParent === 'A' ? pA.color : pB.color,
      { traits: result.traits, description: `Bred from ${pA.name} + ${pB.name}`, tags: ['bred'] },
    );
    setGenomes((prev) => [...prev, child]);
    setSelectedId(child.id);
  }, [breedParentA, breedParentB, genomes]);

  const doEvolve = useCallback(() => {
    const { evolved, tierChanged } = evolveGenome(selected, 50 + Math.floor(Math.random() * 100));
    updateGenome(selected.id, () => evolved);
    if (tierChanged) setRollResult(null); // reset roll on tier change
  }, [selected, updateGenome]);

  const radarData = useMemo(() => genomeToRadar(selected), [selected]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3 p-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg relative overflow-hidden group">
            <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT }} />
            <Dna className="w-4 h-4 relative z-10" style={{ color: ACCENT, filter: `drop-shadow(0 0 4px ${ACCENT}80)` }} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-text tracking-wide">Item DNA Genome System</span>
            <span className="text-xs text-text-muted">
              <span className="font-mono font-medium" style={{ color: ACCENT }}>{genomes.length}</span>
              <span className="opacity-60"> genomes defined</span>
            </span>
          </div>
        </div>
        <button
          onClick={addGenome}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
          style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
        >
          <Plus className="w-3 h-3" /> New Genome
        </button>
      </div>

      {/* Genome selector */}
      <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
        {genomes.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedId(g.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
              g.id === selectedId ? 'ring-1 text-white' : 'text-text-muted hover:text-text'
            }`}
            style={{
              backgroundColor: g.id === selectedId ? `${g.color}${OPACITY_20}` : undefined,
              border: g.id === selectedId ? `1px solid ${g.color}60` : '1px solid transparent',
              boxShadow: g.id === selectedId ? `0 0 0 1px ${g.color}40` : undefined,
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
            {g.name}
            {g.evolution && g.evolution.tier > 0 && (
              <span className="text-xs font-mono" style={{ color: STATUS_SUCCESS }}>+{g.evolution.tier}</span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <SubTabNavigation tabs={SUB_TABS} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />

      {/* ── DNA Editor Tab ──────────────────────────────────────────────── */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-2 gap-3">
          {/* Left: DNA strand + radar */}
          <SurfaceCard level={1} className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <SectionLabel icon={Dna} label="DNA Strand" color={selected.color} />
              {genomes.length > 1 && (
                <button
                  onClick={() => deleteGenome(selected.id)}
                  className="text-xs text-text-muted hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <DNAStrand genome={selected} />
            <div className="flex justify-center">
              <RadarChart data={radarData} accent={selected.color} size={140} />
            </div>
            {/* Genome metadata */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-muted w-14">Name</span>
                <input
                  type="text" value={selected.name}
                  onChange={(e) => updateGenome(selected.id, (g) => ({ ...g, name: e.target.value }))}
                  className="flex-1 text-xs font-mono font-bold px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-muted w-14">Type</span>
                <select
                  value={selected.itemType}
                  onChange={(e) => updateGenome(selected.id, (g) => ({ ...g, itemType: e.target.value as ItemGenome['itemType'] }))}
                  className="text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none"
                >
                  {['Weapon', 'Armor', 'Consumable', 'Material', 'Accessory'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-muted w-14">MinRar</span>
                <select
                  value={selected.minRarity}
                  onChange={(e) => updateGenome(selected.id, (g) => ({ ...g, minRarity: e.target.value as ItemGenome['minRarity'] }))}
                  className="text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none"
                >
                  {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Tags */}
            {selected.tags && selected.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {selected.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-mono px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${selected.color}${OPACITY_10}`, color: selected.color }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </SurfaceCard>

          {/* Right: Trait sliders + mutation config */}
          <div className="space-y-3">
            <SurfaceCard level={1} className="space-y-3 p-3">
              <SectionLabel icon={Target} label="Trait Weights" color={ACCENT} />
              {AXIS_CONFIGS.map((cfg) => {
                const gene = selected.traits.find((g) => g.axis === cfg.axis);
                if (!gene) return null;
                return (
                  <TraitSlider
                    key={cfg.axis}
                    gene={gene}
                    config={cfg}
                    onChange={(w) => updateTrait(cfg.axis, w)}
                  />
                );
              })}
            </SurfaceCard>

            <SurfaceCard level={1} className="space-y-2 p-3">
              <SectionLabel icon={FlaskConical} label="Mutation Config" color={ACCENT_PINK} />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-xs font-mono text-text-muted block mb-0.5">Rate</span>
                  <input
                    type="number" min={0} max={100} step={1}
                    value={Math.round(selected.mutation.mutationRate * 100)}
                    onChange={(e) => updateGenome(selected.id, (g) => ({
                      ...g,
                      mutation: { ...g.mutation, mutationRate: parseInt(e.target.value) / 100 },
                    }))}
                    className="w-full text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <span className="text-xs font-mono text-text-muted block mb-0.5">Max</span>
                  <input
                    type="number" min={0} max={6} step={1}
                    value={selected.mutation.maxMutations}
                    onChange={(e) => updateGenome(selected.id, (g) => ({
                      ...g,
                      mutation: { ...g.mutation, maxMutations: parseInt(e.target.value) },
                    }))}
                    className="w-full text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <span className="text-xs font-mono text-text-muted block mb-0.5">Wild</span>
                  <button
                    onClick={() => updateGenome(selected.id, (g) => ({
                      ...g,
                      mutation: { ...g.mutation, wildMutation: !g.mutation.wildMutation },
                    }))}
                    className="w-full text-xs font-mono font-bold px-1.5 py-1 rounded border transition-colors"
                    style={{
                      backgroundColor: selected.mutation.wildMutation ? `${STATUS_SUCCESS}${OPACITY_20}` : 'transparent',
                      borderColor: selected.mutation.wildMutation ? `${STATUS_SUCCESS}60` : 'var(--border)',
                      color: selected.mutation.wildMutation ? STATUS_SUCCESS : 'var(--text-muted)',
                    }}
                  >
                    {selected.mutation.wildMutation ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </SurfaceCard>

            <DistributionBar genome={selected} rarity="Rare" />
          </div>
        </div>
      )}

      {/* ── Affix Roller Tab ────────────────────────────────────────────── */}
      {activeTab === 'roller' && (
        <div className="space-y-3">
          {/* Controls */}
          <SurfaceCard level={1} className="p-3 space-y-2">
            <SectionLabel icon={Shuffle} label="DNA-Biased Roller" color={ACCENT} />
            <div className="flex items-center gap-3">
              <div>
                <span className="text-xs font-mono text-text-muted block mb-0.5">Rarity</span>
                <select
                  value={rollRarity}
                  onChange={(e) => setRollRarity(e.target.value)}
                  className="text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text"
                >
                  {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-xs font-mono text-text-muted block mb-0.5">Item Level</span>
                <input
                  type="number" min={1} max={100} value={rollLevel}
                  onChange={(e) => setRollLevel(parseInt(e.target.value) || 1)}
                  className="w-16 text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none"
                />
              </div>
              <div className="flex-1" />
              <button
                onClick={doRoll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all hover:scale-105"
                style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
              >
                <Shuffle className="w-3.5 h-3.5" /> Roll Affixes
              </button>
            </div>
          </SurfaceCard>

          {/* DNA being used */}
          <div className="grid grid-cols-2 gap-3">
            <SurfaceCard level={1} className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selected.color }} />
                <span className="text-xs font-bold text-text">{selected.name}</span>
                <span className="text-xs font-mono text-text-muted">({selected.itemType})</span>
              </div>
              <DNAStrand genome={selected} />
              <DistributionBar genome={selected} rarity={rollRarity} />
            </SurfaceCard>

            <div className="space-y-3">
              {rollResult ? (
                <RollResultCard result={rollResult} genome={selected} />
              ) : (
                <SurfaceCard level={2} className="flex items-center justify-center py-12">
                  <div className="text-center space-y-2">
                    <Shuffle className="w-8 h-8 text-text-muted/30 mx-auto" />
                    <p className="text-xs text-text-muted">Click &ldquo;Roll Affixes&rdquo; to generate DNA-biased affixes</p>
                  </div>
                </SurfaceCard>
              )}

              {/* Rolling pipeline visualization */}
              <SurfaceCard level={2} className="p-2 space-y-1.5">
                <span className="text-xs font-mono text-text-muted font-bold uppercase tracking-widest">Rolling Pipeline</span>
                {[
                  { step: '1. Roll Count', desc: `${rollRarity} = ${({'Common': '0', 'Uncommon': '1-2', 'Rare': '3-4', 'Epic': '4-5', 'Legendary': '5-6'} as Record<string, string>)[rollRarity] ?? '?'} affixes`, color: ACCENT },
                  { step: '2. Rarity Gate', desc: 'Filter pool by MinRarity', color: STATUS_WARNING },
                  { step: '3. DNA Bias', desc: 'Weight by genome traits + tag affinity', color: selected.color },
                  { step: '4. Mutation Check', desc: `${(selected.mutation.mutationRate * 100).toFixed(0)}% chance per slot`, color: ACCENT_PINK },
                  { step: '5. Scale by Level', desc: `Base * (1 + 0.1 * ${rollLevel})`, color: STATUS_SUCCESS },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${s.color}${OPACITY_10}` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="font-bold" style={{ color: s.color }}>{s.step}</span>
                    <span className="text-text-muted ml-auto">{s.desc}</span>
                  </div>
                ))}
              </SurfaceCard>
            </div>
          </div>
        </div>
      )}

      {/* ── Breeding Lab Tab ────────────────────────────────────────────── */}
      {activeTab === 'breeding' && (
        <div className="space-y-3">
          <SurfaceCard level={1} className="p-3 space-y-3">
            <SectionLabel icon={GitMerge} label="Inheritance Breeding" color={ACCENT_PINK} />
            <p className="text-xs text-text-muted leading-relaxed">
              Select two parent genomes to breed. The offspring inherits blended traits from both parents
              with random crossover. Dominant parent contributes slightly more to the blend.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs font-mono text-text-muted block mb-1">Parent A</span>
                <select
                  value={breedParentA ?? ''}
                  onChange={(e) => setBreedParentA(e.target.value || null)}
                  className="w-full text-xs font-mono px-2 py-1.5 rounded bg-surface-deep border border-border/40 text-text"
                >
                  <option value="">Select genome...</option>
                  {genomes.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-xs font-mono text-text-muted block mb-1">Parent B</span>
                <select
                  value={breedParentB ?? ''}
                  onChange={(e) => setBreedParentB(e.target.value || null)}
                  className="w-full text-xs font-mono px-2 py-1.5 rounded bg-surface-deep border border-border/40 text-text"
                >
                  <option value="">Select genome...</option>
                  {genomes.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={doBreed}
              disabled={!breedParentA || !breedParentB || breedParentA === breedParentB}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
              style={{ backgroundColor: `${ACCENT_PINK}${OPACITY_20}`, color: ACCENT_PINK, border: `1px solid ${ACCENT_PINK}40` }}
            >
              <GitMerge className="w-3.5 h-3.5" /> Breed Offspring
            </button>
          </SurfaceCard>

          {/* Visual comparison of parents */}
          {breedParentA && breedParentB && breedParentA !== breedParentB && (
            <div className="grid grid-cols-3 gap-3">
              {[breedParentA, breedParentB].map((pid, idx) => {
                const parent = genomes.find((g) => g.id === pid);
                if (!parent) return null;
                return (
                  <SurfaceCard key={pid} level={2} className="p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: parent.color }} />
                      <span className="text-xs font-bold text-text">Parent {idx === 0 ? 'A' : 'B'}: {parent.name}</span>
                    </div>
                    <div className="flex justify-center">
                      <RadarChart data={genomeToRadar(parent)} accent={parent.color} size={100} />
                    </div>
                  </SurfaceCard>
                );
              })}
              <SurfaceCard level={2} className="p-2 flex flex-col items-center justify-center">
                <GitMerge className="w-6 h-6 text-text-muted/30 mb-2" />
                <span className="text-xs text-text-muted">Offspring will appear after breeding</span>
              </SurfaceCard>
            </div>
          )}
        </div>
      )}

      {/* ── Evolution Tab ───────────────────────────────────────────────── */}
      {activeTab === 'evolution' && (
        <div className="space-y-3">
          <SurfaceCard level={1} className="p-3 space-y-3">
            <SectionLabel icon={TrendingUp} label="Item Evolution" color={STATUS_SUCCESS} />
            <p className="text-xs text-text-muted leading-relaxed">
              Items used in combat accumulate evolution XP. At certain thresholds, they tier up —
              strengthening their dominant trait weights. Tier 0 &rarr; 1 &rarr; 2 &rarr; 3.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {/* Current evo state */}
              <SurfaceCard level={2} className="p-2 text-center">
                <span className="text-xs font-mono text-text-muted block">Tier</span>
                <span className="text-lg font-bold" style={{ color: STATUS_SUCCESS }}>
                  {selected.evolution?.tier ?? 0}
                </span>
              </SurfaceCard>
              <SurfaceCard level={2} className="p-2 text-center">
                <span className="text-xs font-mono text-text-muted block">XP</span>
                <span className="text-lg font-bold text-text">
                  {selected.evolution?.evolutionXP ?? 0}
                </span>
              </SurfaceCard>
              <SurfaceCard level={2} className="p-2 text-center">
                <span className="text-xs font-mono text-text-muted block">Uses</span>
                <span className="text-lg font-bold text-text">
                  {selected.evolution?.usageCount ?? 0}
                </span>
              </SurfaceCard>
              <SurfaceCard level={2} className="p-2 text-center">
                <span className="text-xs font-mono text-text-muted block">Next</span>
                <span className="text-lg font-bold" style={{ color: STATUS_WARNING }}>
                  {(() => {
                    const tier = selected.evolution?.tier ?? 0;
                    const xp = selected.evolution?.evolutionXP ?? 0;
                    const thresholds = [100, 500, 2000];
                    if (tier >= 3) return 'MAX';
                    return `${thresholds[tier] - xp}`;
                  })()}
                </span>
              </SurfaceCard>
            </div>
            {/* XP progress bar */}
            {(() => {
              const tier = selected.evolution?.tier ?? 0;
              const xp = selected.evolution?.evolutionXP ?? 0;
              const thresholds = [100, 500, 2000];
              if (tier >= 3) return (
                <div className="text-xs font-mono text-center" style={{ color: STATUS_SUCCESS }}>
                  Maximum evolution reached
                </div>
              );
              const target = thresholds[tier];
              const pct = Math.min((xp / target) * 100, 100);
              return (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-text-muted">
                    <span>Tier {tier}</span>
                    <span>{xp} / {target} XP</span>
                    <span>Tier {tier + 1}</span>
                  </div>
                  <div className="h-2 bg-surface-deep rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: STATUS_SUCCESS, boxShadow: `0 0 8px ${STATUS_SUCCESS}40` }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              );
            })()}
            <button
              onClick={doEvolve}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all hover:scale-105"
              style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_20}`, color: STATUS_SUCCESS, border: `1px solid ${STATUS_SUCCESS}40` }}
            >
              <Zap className="w-3.5 h-3.5" /> Simulate Combat Usage (+50-150 XP)
            </button>
          </SurfaceCard>

          {/* Evolution trait comparison */}
          <div className="grid grid-cols-2 gap-3">
            <SurfaceCard level={2} className="p-3 space-y-2">
              <SectionLabel icon={BarChart3} label="Current Traits" color={selected.color} />
              {selected.traits.map((gene) => {
                const cfg = AXIS_CONFIGS.find((c) => c.axis === gene.axis)!;
                const Icon = cfg.icon;
                return (
                  <div key={gene.axis} className="flex items-center gap-2 text-xs font-mono">
                    <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                    <span className="w-16 font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                    <div className="flex-1 h-1.5 bg-surface-deep rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${gene.weight * 100}%`, backgroundColor: cfg.color }} />
                    </div>
                    <span className="w-10 text-right font-bold">{(gene.weight * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </SurfaceCard>
            <SurfaceCard level={2} className="p-3 space-y-2">
              <SectionLabel icon={Dna} label="Evolution Thresholds" color={STATUS_SUCCESS} />
              {[
                { tier: 1, xp: 100, label: 'Awakened', bonus: '+5% dominant weight', color: STATUS_WARNING },
                { tier: 2, xp: 500, label: 'Empowered', bonus: '+10% dominant weight', color: ACCENT_ORANGE },
                { tier: 3, xp: 2000, label: 'Ascended', bonus: '+15% dominant weight', color: STATUS_SUCCESS },
              ].map((t) => {
                const currentTier = selected.evolution?.tier ?? 0;
                const reached = currentTier >= t.tier;
                return (
                  <div
                    key={t.tier}
                    className="flex items-center gap-2 text-xs font-mono px-2 py-1.5 rounded-md"
                    style={{
                      backgroundColor: reached ? `${t.color}${OPACITY_10}` : 'transparent',
                      border: `1px solid ${reached ? `${t.color}40` : 'var(--border)'}`,
                      opacity: reached ? 1 : 0.5,
                    }}
                  >
                    <span className="font-bold" style={{ color: reached ? t.color : 'var(--text-muted)' }}>
                      T{t.tier}
                    </span>
                    <span className="font-bold text-text">{t.label}</span>
                    <span className="ml-auto text-text-muted">{t.xp} XP</span>
                    <span style={{ color: t.color }}>{t.bonus}</span>
                  </div>
                );
              })}
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* ── UE5 C++ Code Generation Preview ─────────────────────────────── */}
      <SurfaceCard level={1} className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel icon={Copy} label="UE5 DNA Struct Preview" color={ACCENT} />
        </div>
        <pre className="text-xs font-mono text-text-muted leading-relaxed bg-surface-deep p-2 rounded-md overflow-x-auto custom-scrollbar whitespace-pre">
{`// Auto-generated by PoF Item DNA System
// Genome: ${selected.name} v${selected.version}

USTRUCT(BlueprintType)
struct FItemGenomeDNA
{
\tGENERATED_BODY()

\t/** Trait axis weights (0-1) biasing affix rolls */
\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tfloat OffensiveWeight = ${selected.traits.find((t) => t.axis === 'offensive')?.weight.toFixed(2) ?? '0.25'}f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tfloat DefensiveWeight = ${selected.traits.find((t) => t.axis === 'defensive')?.weight.toFixed(2) ?? '0.25'}f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tfloat UtilityWeight = ${selected.traits.find((t) => t.axis === 'utility')?.weight.toFixed(2) ?? '0.25'}f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tfloat EconomicWeight = ${selected.traits.find((t) => t.axis === 'economic')?.weight.toFixed(2) ?? '0.25'}f;

\t/** Mutation rate (0-1) for off-type affix chance */
\tUPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ClampMin="0", ClampMax="1"))
\tfloat MutationRate = ${selected.mutation.mutationRate.toFixed(2)}f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tint32 MaxMutations = ${selected.mutation.maxMutations};

\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tbool bWildMutation = ${selected.mutation.wildMutation ? 'true' : 'false'};
};`}
        </pre>
      </SurfaceCard>
    </motion.div>
  );
}

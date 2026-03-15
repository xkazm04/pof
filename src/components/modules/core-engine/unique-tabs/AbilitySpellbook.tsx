'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  BookOpen, Cpu, BarChart3, Tags, Sparkles, Flame,
  ChevronRight, Network, Clock, Calculator, ClipboardCheck, Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_IMPROVED, STATUS_WARNING, STATUS_ERROR,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';
import type { RadarDataPoint, TimelineEvent } from '@/types/unique-tab-improvements';
import {
  TabHeader, PipelineFlow, SectionLabel,
  FeatureCard as SharedFeatureCard, LoadingSpinner,
  RadarChart, TimelineStrip, SubTabNavigation, SubTab
} from './_shared';

const ACCENT = MODULE_COLORS.systems;

/* ── Spellbook sections ────────────────────────────────────────────────── */

type SectionId = 'core' | 'attributes' | 'tags' | 'abilities' | 'effects'
  | 'tag-deps' | 'effects-timeline' | 'damage-calc' | 'tag-audit' | 'loadout';

interface SectionConfig {
  id: SectionId;
  label: string;
  icon: typeof Cpu;
  color: string;
  featureNames: string[];
}

const SECTIONS: SectionConfig[] = [
  {
    id: 'core',
    label: 'Core',
    icon: Cpu,
    color: MODULE_COLORS.core,
    featureNames: ['AbilitySystemComponent'],
  },
  {
    id: 'attributes',
    label: 'Attributes',
    icon: BarChart3,
    color: '#10b981',
    featureNames: ['Core AttributeSet', 'Default attribute initialization'],
  },
  {
    id: 'tags',
    label: 'Tags',
    icon: Tags,
    color: '#f59e0b',
    featureNames: ['Gameplay Tags hierarchy'],
  },
  {
    id: 'abilities',
    label: 'Abilities',
    icon: Sparkles,
    color: '#a855f7',
    featureNames: ['Base GameplayAbility'],
  },
  {
    id: 'effects',
    label: 'Effects',
    icon: Flame,
    color: '#ef4444',
    featureNames: ['Core Gameplay Effects', 'Damage execution calculation'],
  },
  {
    id: 'tag-deps',
    label: 'Tag Deps',
    icon: Network,
    color: '#f59e0b',
    featureNames: [],
  },
  {
    id: 'effects-timeline',
    label: 'Effect Timeline',
    icon: Clock,
    color: '#ef4444',
    featureNames: [],
  },
  {
    id: 'damage-calc',
    label: 'Damage Calc',
    icon: Calculator,
    color: '#f97316',
    featureNames: [],
  },
  {
    id: 'tag-audit',
    label: 'Tag Audit',
    icon: ClipboardCheck,
    color: '#fbbf24',
    featureNames: [],
  },
  {
    id: 'loadout',
    label: 'Loadout',
    icon: Layers,
    color: '#a855f7',
    featureNames: [],
  },
];

/* ── Attribute radar data ──────────────────────────────────────────────── */

const CORE_ATTRIBUTES = ['Health', 'Mana', 'Strength', 'Dexterity', 'Intelligence'];
const DERIVED_ATTRIBUTES = ['Armor', 'AttackPower', 'CritChance', 'CritDamage'];

/* ── Tag hierarchy ─────────────────────────────────────────────────────── */

interface TagNode {
  name: string;
  children?: TagNode[];
}

const TAG_TREE: TagNode[] = [
  {
    name: 'Ability', children: [
      { name: 'Ability.MeleeAttack' },
      { name: 'Ability.Dodge' },
      { name: 'Ability.Spell' },
    ]
  },
  {
    name: 'State', children: [
      { name: 'State.Dead' },
      { name: 'State.Invulnerable' },
      { name: 'State.Stunned' },
    ]
  },
  {
    name: 'Damage', children: [
      { name: 'Damage.Physical' },
      { name: 'Damage.Magical' },
      { name: 'Damage.Fire' },
    ]
  },
  {
    name: 'Input', children: [
      { name: 'Input.Attack' },
      { name: 'Input.Dodge' },
      { name: 'Input.Interact' },
    ]
  },
];

/* ── Effect pipeline ───────────────────────────────────────────────────── */

const EFFECT_TYPES = [
  { name: 'GE_Damage', desc: 'Instant damage application', color: '#ef4444' },
  { name: 'GE_Heal', desc: 'Health restoration over time', color: '#10b981' },
  { name: 'GE_Buff', desc: 'Temporary stat modifier', color: '#3b82f6' },
  { name: 'GE_Regen', desc: 'Periodic health/mana regen', color: '#8b5cf6' },
];

/* ── 3.1 Attribute Relationship Web data ───────────────────────────────── */

interface AttrNode { id: string; label: string }
interface AttrEdge { from: string; to: string; type: 'scales' | 'partial'; label: string }

const ATTR_WEB_NODES: AttrNode[] = [
  { id: 'str', label: 'Strength' },
  { id: 'dex', label: 'Dexterity' },
  { id: 'int', label: 'Intelligence' },
  { id: 'hp', label: 'Health' },
  { id: 'mp', label: 'Mana' },
  { id: 'arm', label: 'Armor' },
  { id: 'atk', label: 'AttackPower' },
  { id: 'crit', label: 'CritChance' },
  { id: 'cdmg', label: 'CritDamage' },
];

const ATTR_WEB_EDGES: AttrEdge[] = [
  { from: 'str', to: 'atk', type: 'scales', label: 'Scales' },
  { from: 'dex', to: 'crit', type: 'scales', label: 'Scales' },
  { from: 'int', to: 'mp', type: 'scales', label: 'Scales' },
  { from: 'str', to: 'arm', type: 'partial', label: 'Partial' },
  { from: 'dex', to: 'atk', type: 'partial', label: 'Partial' },
];

/* ── 3.2 Ability Cost/Benefit Radar data ───────────────────────────────── */

const ABILITY_RADAR_AXES = ['Damage', 'Range', 'AOE', 'Speed', 'Efficiency'];

const ABILITY_RADAR_DATA: { name: string; color: string; values: number[] }[] = [
  { name: 'MeleeAttack', color: '#ef4444', values: [0.85, 0.2, 0, 0.9, 0.6] },
  { name: 'Fireball', color: '#f97316', values: [0.9, 0.85, 0.6, 0.3, 0.25] },
  { name: 'Dodge', color: '#3b82f6', values: [0, 0, 0, 0.95, 0.8] },
];

/* ── 3.3 Tag Dependency Graph data ─────────────────────────────────────── */

interface TagDepNode { id: string; label: string; category: string; color: string }
interface TagDepEdge { from: string; to: string; type: 'blocks' | 'requires' }

const TAG_DEP_CATEGORIES: Record<string, string> = {
  Ability: '#a855f7',
  State: '#ef4444',
  Damage: '#f97316',
  Input: '#06b6d4',
};

const TAG_DEP_NODES: TagDepNode[] = [
  { id: 'melee', label: 'Ability.MeleeAttack', category: 'Ability', color: TAG_DEP_CATEGORIES.Ability },
  { id: 'dodge', label: 'Ability.Dodge', category: 'Ability', color: TAG_DEP_CATEGORIES.Ability },
  { id: 'spell', label: 'Ability.Spell', category: 'Ability', color: TAG_DEP_CATEGORIES.Ability },
  { id: 'stunned', label: 'State.Stunned', category: 'State', color: TAG_DEP_CATEGORIES.State },
  { id: 'dead', label: 'State.Dead', category: 'State', color: TAG_DEP_CATEGORIES.State },
  { id: 'invuln', label: 'State.Invulnerable', category: 'State', color: TAG_DEP_CATEGORIES.State },
  { id: 'dmg_phys', label: 'Damage.Physical', category: 'Damage', color: TAG_DEP_CATEGORIES.Damage },
  { id: 'dmg_magic', label: 'Damage.Magical', category: 'Damage', color: TAG_DEP_CATEGORIES.Damage },
  { id: 'input_atk', label: 'Input.Attack', category: 'Input', color: TAG_DEP_CATEGORIES.Input },
];

const TAG_DEP_EDGES: TagDepEdge[] = [
  { from: 'stunned', to: 'melee', type: 'blocks' },
  { from: 'dead', to: 'melee', type: 'blocks' },
  { from: 'dead', to: 'dodge', type: 'blocks' },
  { from: 'dead', to: 'spell', type: 'blocks' },
  { from: 'invuln', to: 'dmg_phys', type: 'blocks' },
  { from: 'invuln', to: 'dmg_magic', type: 'blocks' },
];

/* ── 3.4 Effect Stack Timeline data ────────────────────────────────────── */

const EFFECT_TIMELINE_EVENTS: TimelineEvent[] = [
  { id: 'e1', timestamp: 0.5, label: 'GE_Damage', category: 'damage', color: '#ef4444', details: 'Instant damage' },
  { id: 'e2', timestamp: 1.0, label: 'GE_Buff(AtkUp)', category: 'buff', color: '#3b82f6', duration: 3.0, details: 'Attack buff 3s' },
  { id: 'e3', timestamp: 2.0, label: 'GE_Regen', category: 'regen', color: '#10b981', duration: 5.0, details: 'HP regen 5s' },
  { id: 'e4', timestamp: 3.5, label: 'GE_Damage', category: 'damage', color: '#ef4444', details: 'Instant damage' },
  { id: 'e5', timestamp: 4.0, label: 'GE_Buff(DefUp)', category: 'buff', color: '#3b82f6', duration: 4.0, details: 'Defense buff 4s' },
  { id: 'e6', timestamp: 5.5, label: 'GE_Heal', category: 'heal', color: '#22c55e', details: 'Instant heal' },
  { id: 'e7', timestamp: 7.0, label: 'GE_Damage', category: 'damage', color: '#ef4444', details: 'Instant damage' },
  { id: 'e8', timestamp: 8.5, label: 'GE_Regen', category: 'regen', color: '#8b5cf6', duration: 2.0, details: 'Mana regen 2s' },
];

/* ── 3.6 Attribute Growth Projections data ─────────────────────────────── */

interface GrowthPoint { level: number; power: number }

const GROWTH_BUILDS: { name: string; color: string; points: GrowthPoint[] }[] = [
  {
    name: 'Warrior', color: '#ef4444',
    points: [
      { level: 1, power: 10 }, { level: 5, power: 35 }, { level: 10, power: 80 },
      { level: 15, power: 140 }, { level: 20, power: 210 }, { level: 25, power: 290 },
      { level: 30, power: 370 }, { level: 35, power: 440 }, { level: 40, power: 500 },
      { level: 45, power: 550 }, { level: 50, power: 600 },
    ],
  },
  {
    name: 'Mage', color: '#3b82f6',
    points: [
      { level: 1, power: 8 }, { level: 5, power: 25 }, { level: 10, power: 60 },
      { level: 15, power: 110 }, { level: 20, power: 190 }, { level: 25, power: 300 },
      { level: 30, power: 420 }, { level: 35, power: 530 }, { level: 40, power: 620 },
      { level: 45, power: 690 }, { level: 50, power: 750 },
    ],
  },
  {
    name: 'Rogue', color: '#22c55e',
    points: [
      { level: 1, power: 12 }, { level: 5, power: 40 }, { level: 10, power: 90 },
      { level: 15, power: 150 }, { level: 20, power: 220 }, { level: 25, power: 280 },
      { level: 30, power: 350 }, { level: 35, power: 420 }, { level: 40, power: 510 },
      { level: 45, power: 610 }, { level: 50, power: 720 },
    ],
  },
];

/* ── 3.7 Cooldown Flow data ────────────────────────────────────────────── */

const COOLDOWN_ABILITIES = [
  { name: 'MeleeAttack', cd: 0.5, remaining: 0.2, color: '#ef4444' },
  { name: 'Fireball', cd: 3.0, remaining: 1.8, color: '#f97316' },
  { name: 'FrostNova', cd: 8.0, remaining: 5.5, color: '#3b82f6' },
  { name: 'Dodge', cd: 1.5, remaining: 0.0, color: '#22c55e' },
];

/* ── 3.8 GAS Architecture Explorer steps ───────────────────────────────── */

const GAS_STEPS = [
  { label: 'CommitAbility', desc: 'Lock resources, check tags', color: '#3b82f6' },
  { label: 'CheckCost', desc: 'Verify mana/stamina available', color: '#8b5cf6' },
  { label: 'ApplyCost', desc: 'Deduct resource from AttributeSet', color: '#a855f7' },
  { label: 'SpawnProjectile', desc: 'Create projectile actor (if ranged)', color: '#f59e0b' },
  { label: 'OnHit', desc: 'Collision triggers effect application', color: '#f97316' },
  { label: 'ApplyDamage', desc: 'GameplayEffect modifies target HP', color: '#ef4444' },
  { label: 'PostGEExecute', desc: 'Run post-effect callbacks', color: '#10b981' },
];

/* ── 3.9 Tag Audit Dashboard data ──────────────────────────────────────── */

interface AuditCategory { name: string; status: 'pass' | 'warning' | 'error'; count: number; detail: string }

const TAG_AUDIT_CATEGORIES: AuditCategory[] = [
  { name: 'Duplicates', status: 'pass', count: 0, detail: 'No duplicate tags found' },
  { name: 'Unused', status: 'warning', count: 3, detail: 'Input.Interact, Damage.Fire, State.Invulnerable' },
  { name: 'Missing', status: 'error', count: 1, detail: 'Ability.RangedAttack referenced but not defined' },
  { name: 'Naming', status: 'pass', count: 0, detail: 'All tags follow naming convention' },
];

const TAG_USAGE_FREQUENCY = [
  { tag: 'State.Dead', count: 14 },
  { tag: 'Ability.MeleeAttack', count: 12 },
  { tag: 'Damage.Physical', count: 11 },
  { tag: 'State.Stunned', count: 9 },
  { tag: 'Ability.Dodge', count: 8 },
  { tag: 'Input.Attack', count: 7 },
  { tag: 'Damage.Magical', count: 6 },
  { tag: 'Ability.Spell', count: 5 },
  { tag: 'Input.Dodge', count: 4 },
  { tag: 'State.Invulnerable', count: 2 },
];

const TAG_AUDIT_SCORE = 85;

/* ── Tag quick-view popover data ───────────────────────────────────────── */

interface TagDetail {
  name: string;
  prefix: string;
  cooldown?: string;
  manaCost?: number;
  blockingTags: string[];
  lifecycle: string[];
  color: string;
}

const TAG_DETAIL_MAP: Record<string, TagDetail> = {
  'State.Dead': {
    name: 'Dead State', prefix: 'State', blockingTags: [],
    lifecycle: ['OnHealthDepleted', 'SetTag', 'BlockAll', 'Ragdoll', 'Cleanup'],
    color: '#ef4444',
  },
  'Ability.MeleeAttack': {
    name: 'Melee Attack', prefix: 'Ability', cooldown: 'Cooldown.MeleeAttack (0.5s)',
    manaCost: 0, blockingTags: ['State.Dead', 'State.Stunned'],
    lifecycle: ['CanActivate', 'CommitAbility', 'PlayMontage', 'ApplyDamage', 'EndAbility'],
    color: '#a855f7',
  },
  'Damage.Physical': {
    name: 'Physical Damage', prefix: 'Damage', blockingTags: ['State.Invulnerable'],
    lifecycle: ['CalcMagnitude', 'ArmorReduction', 'ApplyToTarget', 'PostExecute'],
    color: '#f97316',
  },
  'State.Stunned': {
    name: 'Stunned State', prefix: 'State', blockingTags: [],
    lifecycle: ['OnStunApplied', 'SetTag', 'BlockAbilities', 'Duration', 'RemoveTag'],
    color: '#ef4444',
  },
  'Ability.Dodge': {
    name: 'Dodge', prefix: 'Ability', cooldown: 'Cooldown.Dodge (1.5s)',
    manaCost: 10, blockingTags: ['State.Dead', 'State.Stunned'],
    lifecycle: ['CanActivate', 'CommitAbility', 'GrantInvuln', 'PlayMontage', 'EndAbility'],
    color: '#3b82f6',
  },
  'Input.Attack': {
    name: 'Attack Input', prefix: 'Input', blockingTags: ['State.Dead'],
    lifecycle: ['InputPressed', 'FindAbility', 'TryActivate', 'InputReleased'],
    color: '#06b6d4',
  },
  'Damage.Magical': {
    name: 'Magical Damage', prefix: 'Damage', blockingTags: ['State.Invulnerable'],
    lifecycle: ['CalcMagnitude', 'ResistCheck', 'ApplyToTarget', 'PostExecute'],
    color: '#f97316',
  },
  'Ability.Spell': {
    name: 'Spell Cast', prefix: 'Ability', cooldown: 'Cooldown.Spell (3.0s)',
    manaCost: 25, blockingTags: ['State.Dead', 'State.Stunned'],
    lifecycle: ['CanActivate', 'CheckMana', 'CommitAbility', 'SpawnProjectile', 'EndAbility'],
    color: '#a855f7',
  },
  'Input.Dodge': {
    name: 'Dodge Input', prefix: 'Input', blockingTags: ['State.Dead'],
    lifecycle: ['InputPressed', 'FindAbility', 'TryActivate', 'InputReleased'],
    color: '#06b6d4',
  },
  'State.Invulnerable': {
    name: 'Invulnerable State', prefix: 'State', blockingTags: [],
    lifecycle: ['OnDodge', 'SetTag', 'BlockDamage', 'Duration', 'RemoveTag'],
    color: '#22c55e',
  },
};

/* ── 3.10 Ability Loadout Optimizer data ───────────────────────────────── */

interface LoadoutEntry { slot: number; ability: string; color: string }

const OPTIMAL_LOADOUT: LoadoutEntry[] = [
  { slot: 1, ability: 'MeleeAttack', color: '#ef4444' },
  { slot: 2, ability: 'Fireball', color: '#f97316' },
  { slot: 3, ability: 'FrostNova', color: '#3b82f6' },
  { slot: 4, ability: 'Dodge', color: '#22c55e' },
];

const LOADOUT_RADAR: RadarDataPoint[] = [
  { axis: 'Coverage', value: 0.85 },
  { axis: 'Synergy', value: 0.7 },
  { axis: 'DPS', value: 0.9 },
  { axis: 'Burst', value: 0.75 },
  { axis: 'Utility', value: 0.6 },
];

const LOADOUT_SCORE = 78;

const ALTERNATIVE_LOADOUTS = [
  { name: 'Burst DPS', abilities: ['MeleeAttack', 'Fireball', 'Fireball', 'Dodge'], score: 72 },
  { name: 'Control', abilities: ['FrostNova', 'FrostNova', 'Dodge', 'Dodge'], score: 65 },
  { name: 'Balanced', abilities: ['MeleeAttack', 'Fireball', 'Dodge', 'Dodge'], score: 74 },
];

/* ── Component ─────────────────────────────────────────────────────────── */

interface AbilitySpellbookProps {
  moduleId: SubModuleId;
}

export function AbilitySpellbook({ moduleId }: AbilitySpellbookProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [activeTab, setActiveTab] = useState('core');
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  const tabs: SubTab[] = useMemo(() => [
    { id: 'core', label: 'Core & Architecture', icon: Cpu },
    { id: 'abilities', label: 'Abilities', icon: Sparkles },
    { id: 'effects', label: 'Effects', icon: Flame },
    { id: 'tags', label: 'Tags & Attributes', icon: Tags },
  ], []);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const toggleFeature = useCallback((name: string) => {
    setExpandedFeature((prev) => (prev === name ? null : name));
  }, []);

  // Summary stats
  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0;
    for (const d of defs) {
      const status = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
      else if (status === 'partial') partial++;
    }
    return { total, implemented, partial };
  }, [defs, featureMap]);

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-1.5">
        <TabHeader icon={BookOpen} title="Ability Spellbook" implemented={stats.implemented} total={stats.total} accent={ACCENT} />
        <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
      </div>

      <div className="mt-2.5 relative min-h-[300px]">
        <AnimatePresence mode="sync">
          {activeTab === 'core' && (
            <motion.div key="core" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                <CoreSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} />
                <LoadoutSection />
              </div>
            </motion.div>
          )}
          {activeTab === 'abilities' && (
            <motion.div key="abilities" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                <AbilitiesSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} />
                <DamageCalcSection />
              </div>
            </motion.div>
          )}
          {activeTab === 'effects' && (
            <motion.div key="effects" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                <EffectsSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} />
                <EffectsTimelineSection />
              </div>
            </motion.div>
          )}
          {activeTab === 'tags' && (
            <motion.div key="tags" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <AttributesSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                <TagsSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} />
                <div className="space-y-2.5">
                  <TagDepsSection />
                  <TagAuditSection />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Section: Core (enhanced with 3.8 GAS Architecture Explorer) ──────── */

function CoreSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  return (
    <div className="space-y-2.5">
      <SurfaceCard level={3} className="p-3 bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed">
        The Ability System Component (ASC) is the central hub that manages abilities, attributes, tags, and effects.
        It must be attached to the character base class and implement <span className="font-mono text-xs text-text">IAbilitySystemInterface</span>.
      </SurfaceCard>

      <SharedFeatureCard name="AbilitySystemComponent" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={MODULE_COLORS.core} />

      {/* Connection diagram */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full" />
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-400" /> ASC Connections
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {['AttributeSet', 'Tag Container', 'Ability Instances', 'Active Effects'].map((conn, i) => (
            <motion.div
              key={conn}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-2 text-sm bg-surface p-2.5 rounded-lg border border-border/50 shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.6)]" />
              <span className="text-text font-medium">{conn}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* GAS Architecture Pipeline */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent" />
        <SectionLabel label="GAS Architecture Pipeline" />
        <div className="mt-3 relative z-10">
          <PipelineFlow steps={['ASC', 'AttributeSet', 'Tags', 'GameplayAbility', 'GameplayEffect', 'Execution']} accent={ACCENT} />
        </div>
      </SurfaceCard>

      {/* 3.8 GAS Architecture Explorer - Animated sequence diagram */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute left-0 top-0 w-40 h-40 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={Cpu} label="GAS Execution Sequence" color={MODULE_COLORS.core} />
        <div className="mt-2.5 relative z-10">
          <GASArchitectureExplorer />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── 3.8 GAS Architecture Explorer component ──────────────────────────── */

function GASArchitectureExplorer() {
  const stepH = 36;
  const stepW = 180;
  const arrowGap = 16;
  const totalH = GAS_STEPS.length * stepH + (GAS_STEPS.length - 1) * arrowGap + 20;
  const cx = stepW / 2 + 40;

  return (
    <svg width="100%" height={totalH} viewBox={`0 0 ${stepW + 80} ${totalH}`} className="overflow-visible">
      {GAS_STEPS.map((step, i) => {
        const y = 10 + i * (stepH + arrowGap);
        const isLast = i === GAS_STEPS.length - 1;
        return (
          <g key={step.label}>
            {/* Box */}
            <motion.rect
              x={cx - stepW / 2} y={y}
              width={stepW} height={stepH}
              rx={8} fill={`${step.color}15`}
              stroke={step.color} strokeWidth={1.5}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12 }}
            />
            {/* Step label */}
            <motion.text
              x={cx} y={y + 18}
              textAnchor="middle"
              className="text-[11px] font-mono font-bold"
              fill={step.color}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.12 + 0.05 }}
            >
              {step.label}
            </motion.text>
            {/* Description */}
            <motion.text
              x={cx} y={y + 34}
              textAnchor="middle"
              className="text-[9px] font-mono fill-[var(--text-muted)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.12 + 0.1 }}
            >
              {step.desc}
            </motion.text>
            {/* Arrow to next */}
            {!isLast && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.12 + 0.15 }}
              >
                <line
                  x1={cx} y1={y + stepH}
                  x2={cx} y2={y + stepH + arrowGap}
                  stroke="rgba(255,255,255,0.15)" strokeWidth={1.5}
                />
                <polygon
                  points={`${cx - 4},${y + stepH + arrowGap - 6} ${cx},${y + stepH + arrowGap} ${cx + 4},${y + stepH + arrowGap - 6}`}
                  fill="rgba(255,255,255,0.25)"
                />
              </motion.g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Section: Attributes (enhanced with 3.1 Relationship Web + 3.6 Growth) */

function AttributesSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  const attrStatus = featureMap.get('Core AttributeSet')?.status ?? 'unknown';

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <SharedFeatureCard name="Core AttributeSet" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#10b981" />
        <SharedFeatureCard name="Default attribute initialization" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#10b981" />
      </div>

      {/* Attribute catalog */}
      <SurfaceCard level={2} className="p-3 relative">
        <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" /> Attribute Set Catalog
        </div>

        {/* Core Attributes */}
        <div className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">Core Attributes</div>
        <div className="grid grid-cols-3 gap-2 mb-2.5">
          {CORE_ATTRIBUTES.map((attr, i) => {
            const isInit = attrStatus === 'implemented' || attrStatus === 'improved';
            return (
              <motion.div
                key={attr}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border"
                style={{
                  backgroundColor: isInit ? `${STATUS_SUCCESS}15` : 'var(--surface)',
                  borderColor: isInit ? `${STATUS_SUCCESS}30` : 'var(--border)',
                  color: isInit ? STATUS_SUCCESS : 'var(--text-muted)'
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isInit ? STATUS_SUCCESS : 'var(--border-bright)' }} />
                <span className="font-mono">{attr}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Derived Attributes */}
        <div className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">Derived Attributes</div>
        <div className="grid grid-cols-3 gap-2">
          {DERIVED_ATTRIBUTES.map((attr, i) => {
            const isInit = attrStatus === 'implemented' || attrStatus === 'improved';
            return (
              <motion.div
                key={attr}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (CORE_ATTRIBUTES.length + i) * 0.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border"
                style={{
                  backgroundColor: isInit ? `${STATUS_IMPROVED}15` : 'var(--surface)',
                  borderColor: isInit ? `${STATUS_IMPROVED}30` : 'var(--border)',
                  color: isInit ? STATUS_IMPROVED : 'var(--text-muted)'
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isInit ? STATUS_IMPROVED : 'var(--border-bright)' }} />
                <span className="font-mono">{attr}</span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* 3.1 Attribute Relationship Web */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 w-40 h-40 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={Network} label="Attribute Relationship Web" color="#10b981" />
        <div className="mt-2.5 flex justify-center">
          <AttributeRelationshipWeb />
        </div>
      </SurfaceCard>

      {/* 3.6 Attribute Growth Projections */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute left-0 top-0 w-40 h-40 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={BarChart3} label="Attribute Growth Projections (Lv 1-50)" color="#10b981" />
        <div className="mt-2.5">
          <AttributeGrowthChart />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── 3.1 Attribute Relationship Web component ─────────────────────────── */

function AttributeRelationshipWeb() {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 50;
  const n = ATTR_WEB_NODES.length;

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    ATTR_WEB_NODES.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions[node.id] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
    return positions;
  }, []);

  // Compute connected subgraph via BFS from hovered node
  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return null;
    const visited = new Set<string>();
    const queue = [hoveredNode];
    visited.add(hoveredNode);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of ATTR_WEB_EDGES) {
        if (edge.from === current && !visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push(edge.to);
        }
        if (edge.to === current && !visited.has(edge.from)) {
          visited.add(edge.from);
          queue.push(edge.from);
        }
      }
    }
    return visited;
  }, [hoveredNode]);

  const isEdgeConnected = useCallback((edge: AttrEdge) => {
    if (!connectedNodes) return true;
    return connectedNodes.has(edge.from) && connectedNodes.has(edge.to);
  }, [connectedNodes]);

  const isNodeConnected = useCallback((nodeId: string) => {
    if (!connectedNodes) return true;
    return connectedNodes.has(nodeId);
  }, [connectedNodes]);

  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible"
      onMouseLeave={() => setHoveredNode(null)}
    >
      {/* Glow filter for highlighted elements */}
      <defs>
        <filter id="attr-web-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodOpacity="0.6" />
        </filter>
      </defs>
      {/* Edges */}
      {ATTR_WEB_EDGES.map((edge, i) => {
        const from = nodePositions[edge.from];
        const to = nodePositions[edge.to];
        if (!from || !to) return null;
        const edgeColor = edge.type === 'scales' ? '#10b981' : '#f59e0b';
        const connected = isEdgeConnected(edge);
        const dimmed = hoveredNode !== null && !connected;
        return (
          <motion.g key={`${edge.from}-${edge.to}`}
            initial={{ opacity: 0 }} animate={{ opacity: dimmed ? 0.15 : 1 }} transition={{ duration: 0.2 }}
          >
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={edgeColor} strokeWidth={edge.type === 'scales' ? 2 : 1.5}
              strokeDasharray={edge.type === 'partial' ? '4 3' : undefined}
              opacity={0.7}
              filter={hoveredNode && connected ? 'url(#attr-web-glow)' : undefined}
            />
            <text
              x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5}
              textAnchor="middle" className="text-[7px] font-mono font-bold" fill={edgeColor}
            >
              {edge.label}
            </text>
          </motion.g>
        );
      })}
      {/* Nodes */}
      {ATTR_WEB_NODES.map((node, i) => {
        const pos = nodePositions[node.id];
        if (!pos) return null;
        const isCore = CORE_ATTRIBUTES.map(a => a.toLowerCase()).includes(node.label.toLowerCase());
        const nodeColor = isCore ? '#10b981' : STATUS_IMPROVED;
        const connected = isNodeConnected(node.id);
        const dimmed = hoveredNode !== null && !connected;
        const isHovered = hoveredNode === node.id;
        return (
          <motion.g key={node.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: dimmed ? 0.15 : 1, scale: 1 }}
            transition={{ duration: 0.2, delay: dimmed ? 0 : i * 0.06 }}
            onMouseEnter={() => setHoveredNode(node.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={pos.x} cy={pos.y} r={isHovered ? 16 : 14}
              fill={`${nodeColor}20`} stroke={nodeColor}
              strokeWidth={isHovered ? 2.5 : 1.5}
              filter={hoveredNode && connected ? 'url(#attr-web-glow)' : undefined}
            />
            <text
              x={pos.x} y={pos.y + 1}
              textAnchor="middle" dominantBaseline="central"
              className="text-[8px] font-mono font-bold" fill={nodeColor}
            >
              {node.label.slice(0, 3)}
            </text>
            {/* Full label outside */}
            <text
              x={pos.x} y={pos.y + (pos.y > cy ? 26 : -20)}
              textAnchor="middle"
              className="text-[8px] font-mono fill-[var(--text-muted)]"
            >
              {node.label}
            </text>
          </motion.g>
        );
      })}
      {/* Legend */}
      <g transform={`translate(10, ${size - 30})`}>
        <line x1={0} y1={0} x2={16} y2={0} stroke="#10b981" strokeWidth={2} />
        <text x={20} y={4} className="text-[8px] font-mono fill-[var(--text-muted)]">Scales</text>
        <line x1={65} y1={0} x2={81} y2={0} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={85} y={4} className="text-[8px] font-mono fill-[var(--text-muted)]">Partial</text>
      </g>
    </svg>
  );
}

/* ── 3.6 Attribute Growth Chart component ─────────────────────────────── */

function AttributeGrowthChart() {
  const w = 500;
  const h = 150;
  const pad = { top: 10, right: 20, bottom: 30, left: 45 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const maxPower = Math.max(...GROWTH_BUILDS.flatMap(b => b.points.map(p => p.power)));
  const maxLevel = 50;

  const toX = (level: number) => pad.left + (level / maxLevel) * chartW;
  const toY = (power: number) => pad.top + chartH - (power / maxPower) * chartH;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
      {/* Grid lines */}
      {[0, 200, 400, 600].map(v => (
        <g key={v}>
          <line x1={pad.left} y1={toY(v)} x2={w - pad.right} y2={toY(v)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={pad.left - 8} y={toY(v) + 3} textAnchor="end" className="text-[8px] font-mono fill-[var(--text-muted)]">{v}</text>
        </g>
      ))}
      {/* X-axis labels */}
      {[1, 10, 20, 30, 40, 50].map(lvl => (
        <text key={lvl} x={toX(lvl)} y={h - 5} textAnchor="middle" className="text-[8px] font-mono fill-[var(--text-muted)]">Lv{lvl}</text>
      ))}
      {/* Build lines */}
      {GROWTH_BUILDS.map((build) => {
        const pathData = build.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.level)} ${toY(p.power)}`).join(' ');
        return (
          <motion.g key={build.name}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          >
            <path d={pathData} fill="none" stroke={build.color} strokeWidth={2} opacity={0.8} />
            {build.points.map((p, pi) => (
              <circle key={pi} cx={toX(p.level)} cy={toY(p.power)} r={2.5} fill={build.color} opacity={0.9} />
            ))}
          </motion.g>
        );
      })}
      {/* Legend */}
      {GROWTH_BUILDS.map((build, i) => (
        <g key={build.name} transform={`translate(${pad.left + i * 90}, ${h - 18})`}>
          <rect width={10} height={3} rx={1} fill={build.color} />
          <text x={14} y={4} className="text-[8px] font-mono font-bold" fill={build.color}>{build.name}</text>
        </g>
      ))}
      {/* Axis labels */}
      <text x={w / 2} y={h} textAnchor="middle" className="text-[8px] font-mono fill-[var(--text-muted)]">Level</text>
    </svg>
  );
}

/* ── Section: Tags ─────────────────────────────────────────────────────── */

function TagsSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  return (
    <div className="space-y-2.5 flex">
      <div className="w-1/2 pr-2">
        <SharedFeatureCard name="Gameplay Tags hierarchy" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#f59e0b" />
      </div>

      <div className="w-1/2 pl-2">
        <SurfaceCard level={2} className="p-4 h-full">
          <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2">
            <Tags className="w-4 h-4 text-amber-500" /> Tag Hierarchy Data
          </div>
          <div className="space-y-2 bg-surface-deep/30 p-3 rounded-lg border border-border/40">
            {TAG_TREE.map((node) => (
              <TagTreeNode key={node.name} node={node} depth={0} />
            ))}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

function TagTreeNode({ node, depth }: { node: TagNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
      className="overflow-hidden"
    >
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className="flex items-center gap-1.5 text-sm py-1 hover:bg-surface-hover/50 rounded transition-colors w-full text-left focus:outline-none pr-2"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <motion.div animate={{ rotate: open ? 90 : 0 }} className="flex-shrink-0">
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
          </motion.div>
        ) : (
          <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </span>
        )}
        <span className={`font-mono text-xs ${hasChildren ? 'text-amber-400 font-bold' : 'text-text-muted'}`}>
          {node.name}
        </span>
      </button>
      <AnimatePresence>
        {open && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children?.map((child) => (
              <TagTreeNode key={child.name} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Section: Abilities (enhanced with 3.2 Radar + 3.7 Cooldowns) ────── */

function AbilitiesSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  const crossModuleAbilities = [
    { name: 'Melee attack ability', module: 'arpg-combat' },
    { name: 'Dodge ability (GAS)', module: 'arpg-combat' },
  ];

  return (
    <div className="space-y-2.5">
      <SharedFeatureCard name="Base GameplayAbility" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#a855f7" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <SurfaceCard level={2} className="p-3 relative">
          <div className="absolute right-0 top-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
          <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" /> Derived Cross-Module
          </div>
          <div className="space-y-2.5">
            {crossModuleAbilities.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 text-sm bg-surface p-2.5 rounded-lg border border-border/50"
              >
                <div className="bg-purple-500/10 p-1.5 rounded">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                </div>
                <span className="text-text font-medium">{a.name}</span>
                <span className="text-2xs text-text-muted font-mono ml-auto bg-surface-deep px-1.5 py-0.5 rounded border border-border/40">
                  {a.module}
                </span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Ability lifecycle */}
        <SurfaceCard level={2} className="p-4 flex flex-col justify-center">
          <SectionLabel label="Ability Lifecycle" />
          <div className="mt-2.5">
            <PipelineFlow steps={['CanActivate', 'CommitAbility', 'ActivateAbility', 'ApplyCost', 'EndAbility']} accent="#a855f7" />
          </div>
        </SurfaceCard>
      </div>

      {/* 3.2 Ability Cost/Benefit Radar */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute left-0 top-0 w-40 h-40 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={Sparkles} label="Ability Cost/Benefit Radar" color="#a855f7" />
        <div className="mt-2.5 flex items-center gap-2.5 justify-center flex-wrap">
          <RadarChart
            data={ABILITY_RADAR_AXES.map((axis, i) => ({
              axis,
              value: ABILITY_RADAR_DATA[0].values[i],
            }))}
            size={150}
            accent={ABILITY_RADAR_DATA[0].color}
            overlays={ABILITY_RADAR_DATA.slice(1).map(ab => ({
              data: ABILITY_RADAR_AXES.map((axis, i) => ({ axis, value: ab.values[i] })),
              color: ab.color,
              label: ab.name,
            }))}
          />
          {/* Legend */}
          <div className="flex flex-col gap-2">
            {ABILITY_RADAR_DATA.map(ab => (
              <div key={ab.name} className="flex items-center gap-2 text-xs font-mono">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ab.color }} />
                <span style={{ color: ab.color }}>{ab.name}</span>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* 3.7 Cooldown Flow Visualization */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 w-40 h-40 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={Clock} label="Cooldown Flow" color="#a855f7" />
        <div className="mt-2.5 flex items-center gap-2.5 justify-center flex-wrap">
          {COOLDOWN_ABILITIES.map((ab, i) => (
            <CooldownWheel key={ab.name} ability={ab} index={i} />
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── 3.7 Cooldown Wheel component ─────────────────────────────────────── */

function CooldownWheel({ ability, index }: { ability: typeof COOLDOWN_ABILITIES[number]; index: number }) {
  const size = 56;
  const strokeW = 5;
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = ability.remaining / ability.cd;
  const ready = ability.remaining === 0;

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} />
          {/* Cooldown arc */}
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={ready ? '#22c55e' : ability.color}
            strokeWidth={strokeW}
            strokeDasharray={circ}
            strokeDashoffset={circ * pct}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ filter: `drop-shadow(0 0 4px ${ready ? '#22c55e' : ability.color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-[10px] font-mono font-bold" style={{ color: ready ? '#22c55e' : ability.color }}>
            {ready ? 'READY' : `${ability.remaining.toFixed(1)}s`}
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[9px] font-mono font-bold text-text truncate max-w-[70px]">{ability.name}</div>
        <div className="text-[8px] font-mono text-text-muted">{ability.cd}s CD</div>
      </div>
    </motion.div>
  );
}

/* ── Section: Effects ──────────────────────────────────────────────────── */

function EffectsSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <SharedFeatureCard name="Core Gameplay Effects" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#ef4444" />
        <SharedFeatureCard name="Damage execution calculation" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#ef4444" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Effect type cards */}
        <div className="grid grid-cols-2 gap-3">
          {EFFECT_TYPES.map((effect, i) => (
            <motion.div
              key={effect.name}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
              className="bg-surface-deep border border-border/60 rounded-xl p-3 shadow-sm hover:border-text-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: effect.color, boxShadow: `0 0 6px ${effect.color}60` }} />
                <span className="text-xs font-mono font-bold text-text">{effect.name}</span>
              </div>
              <p className="text-2xs text-text-muted leading-relaxed">{effect.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Damage execution pipeline */}
        <SurfaceCard level={2} className="p-4 flex flex-col justify-center">
          <SectionLabel label="Damage Execution Pipeline" />
          <div className="mt-2.5">
            <PipelineFlow steps={['GameplayEffect', 'ExecutionCalc', 'Armor Reduction', 'Crit Multiplier', 'Final Damage']} accent="#ef4444" />
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

/* ── Section: Tag Dependencies (3.3) ──────────────────────────────────── */

function TagDepsSection() {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 60;
  const n = TAG_DEP_NODES.length;

  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    TAG_DEP_NODES.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions[node.id] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
    return positions;
  }, []);

  return (
    <div className="space-y-2.5">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={Network} label="Gameplay Tag Dependency Graph" color="#f59e0b" />
        <p className="text-xs text-text-muted mt-1 mb-2.5">
          Tags interact through blocking and requirement relationships. Red dashed edges indicate blocking dependencies.
        </p>

        <div className="flex justify-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
            {/* Edges */}
            {TAG_DEP_EDGES.map((edge, i) => {
              const from = nodePositions[edge.from];
              const to = nodePositions[edge.to];
              if (!from || !to) return null;
              const edgeColor = edge.type === 'blocks' ? '#ef4444' : '#3b82f6';
              return (
                <motion.g key={`${edge.from}-${edge.to}`}
                  initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: i * 0.08 }}
                >
                  <line
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={edgeColor} strokeWidth={1.5}
                    strokeDasharray={edge.type === 'blocks' ? '6 3' : undefined}
                    markerEnd="url(#arrowhead)"
                  />
                  <text
                    x={(from.x + to.x) / 2 + 5} y={(from.y + to.y) / 2 - 6}
                    textAnchor="middle" className="text-[7px] font-mono font-bold" fill={edgeColor}
                  >
                    {edge.type}
                  </text>
                </motion.g>
              );
            })}

            {/* Arrow marker definition */}
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.4)" />
              </marker>
            </defs>

            {/* Nodes */}
            {TAG_DEP_NODES.map((node, i) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;
              return (
                <motion.g key={node.id}
                  initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
                >
                  <circle cx={pos.x} cy={pos.y} r={16} fill={`${node.color}20`} stroke={node.color} strokeWidth={1.5} />
                  <text
                    x={pos.x} y={pos.y + 1}
                    textAnchor="middle" dominantBaseline="central"
                    className="text-[7px] font-mono font-bold" fill={node.color}
                  >
                    {node.label.split('.')[1]?.slice(0, 4) ?? node.label.slice(0, 4)}
                  </text>
                  {/* Full label outside */}
                  <text
                    x={pos.x} y={pos.y + (pos.y > cy ? 28 : -22)}
                    textAnchor="middle"
                    className="text-[7px] font-mono fill-[var(--text-muted)]"
                  >
                    {node.label}
                  </text>
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Category legend */}
        <div className="flex items-center gap-2.5 justify-center mt-2.5 flex-wrap">
          {Object.entries(TAG_DEP_CATEGORIES).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5 text-xs font-mono">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: `${color}30`, border: `1.5px solid ${color}` }} />
              <span style={{ color }}>{cat}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="w-5 h-0 border-t-[1.5px] border-dashed border-red-500" />
            <span className="text-red-400">blocks</span>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Section: Effects Timeline (3.4) ──────────────────────────────────── */

function EffectsTimelineSection() {
  const lanes = useMemo(() => {
    const laneMap: Record<string, TimelineEvent[]> = {};
    for (const evt of EFFECT_TIMELINE_EVENTS) {
      if (!laneMap[evt.category]) laneMap[evt.category] = [];
      laneMap[evt.category].push(evt);
    }
    return Object.entries(laneMap);
  }, []);

  return (
    <div className="space-y-2.5">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute left-0 top-0 w-40 h-40 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={Clock} label="Effect Stack Timeline" color="#ef4444" />
        <p className="text-xs text-text-muted mt-1 mb-2.5">
          Swim-lane view of 8 effect events over a 10-second combat sequence. Duration bars show persistent effects.
        </p>

        {/* Full timeline strip */}
        <div className="mb-2.5">
          <TimelineStrip events={EFFECT_TIMELINE_EVENTS} accent="#ef4444" height={70} />
        </div>

        {/* Swim-lane breakdown */}
        <div className="space-y-3">
          {lanes.map(([category, events]) => (
            <div key={category} className="flex items-center gap-3">
              <div className="w-16 text-[10px] font-mono font-bold text-text-muted uppercase flex-shrink-0 text-right">
                {category}
              </div>
              <div className="flex-1 h-8 bg-surface-deep/50 rounded relative border border-border/30">
                {events.map((evt) => {
                  const left = (evt.timestamp / 10) * 100;
                  const width = evt.duration ? (evt.duration / 10) * 100 : undefined;
                  return (
                    <motion.div
                      key={evt.id}
                      className="absolute top-1 bottom-1"
                      style={{ left: `${left}%`, width: width ? `${width}%` : undefined }}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      title={`${evt.label} at ${evt.timestamp}s${evt.duration ? ` (${evt.duration}s)` : ''}`}
                    >
                      {width ? (
                        <div className="h-full rounded-sm opacity-70" style={{ backgroundColor: evt.color, minWidth: 6 }} />
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full -ml-1 mt-0.5" style={{ backgroundColor: evt.color, boxShadow: `0 0 6px ${evt.color}` }} />
                      )}
                    </motion.div>
                  );
                })}
                {/* Time ticks */}
                {[0, 2, 4, 6, 8, 10].map(t => (
                  <div key={t} className="absolute bottom-0 w-px h-1.5 bg-border/40" style={{ left: `${(t / 10) * 100}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Time axis */}
        <div className="flex items-center gap-3 mt-1">
          <div className="w-16 flex-shrink-0" />
          <div className="flex-1 flex justify-between text-[8px] font-mono text-text-muted">
            {[0, 2, 4, 6, 8, 10].map(t => <span key={t}>{t}s</span>)}
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Section: Damage Calculator (3.5) ─────────────────────────────────── */

function DamageCalcSection() {
  const [baseDamage, setBaseDamage] = useState(50);
  const [attackerPower, setAttackerPower] = useState(100);
  const [targetArmor, setTargetArmor] = useState(50);
  const [critChance, setCritChance] = useState(15);
  const [critMultiplier, setCritMultiplier] = useState(1.5);

  const calc = useMemo(() => {
    const scaledDamage = baseDamage * (1 + attackerPower / 100);
    const armorReduction = targetArmor / (targetArmor + 100);
    const afterArmor = scaledDamage * (1 - armorReduction);
    const expectedCritMulti = 1 + (critChance / 100) * (critMultiplier - 1);
    const finalDamage = afterArmor * expectedCritMulti;
    const critDamage = afterArmor * critMultiplier;
    return { scaledDamage, armorReduction, afterArmor, expectedCritMulti, finalDamage, critDamage };
  }, [baseDamage, attackerPower, targetArmor, critChance, critMultiplier]);

  return (
    <div className="space-y-2.5">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 bg-orange-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={Calculator} label="Damage Formula Sandbox" color="#f97316" />
        <p className="text-xs text-text-muted mt-1 mb-2.5">
          Adjust parameters to explore how the GAS damage formula works. All calculations follow the standard execution pipeline.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Sliders */}
          <div className="space-y-2.5">
            <SliderParam label="Base Damage" value={baseDamage} min={10} max={100} onChange={setBaseDamage} color="#ef4444" />
            <SliderParam label="Attacker Power" value={attackerPower} min={1} max={200} onChange={setAttackerPower} color="#f97316" />
            <SliderParam label="Target Armor" value={targetArmor} min={0} max={200} onChange={setTargetArmor} color="#3b82f6" />
            <SliderParam label="Crit Chance" value={critChance} min={0} max={100} onChange={setCritChance} unit="%" color="#a855f7" />
            <SliderParam label="Crit Multiplier" value={critMultiplier} min={1.0} max={3.0} step={0.1} onChange={setCritMultiplier} unit="x" color="#f59e0b" />
          </div>

          {/* Results */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Formula Steps</div>

            <FormulaStep
              step={1}
              label="Scaled Damage"
              formula={`${baseDamage} x (1 + ${attackerPower}/100)`}
              result={calc.scaledDamage}
              color="#ef4444"
            />
            <FormulaStep
              step={2}
              label="Armor Reduction"
              formula={`${targetArmor} / (${targetArmor} + 100)`}
              result={calc.armorReduction}
              unit="%"
              isPercent
              color="#3b82f6"
            />
            <FormulaStep
              step={3}
              label="After Armor"
              formula={`${calc.scaledDamage.toFixed(1)} x (1 - ${(calc.armorReduction * 100).toFixed(1)}%)`}
              result={calc.afterArmor}
              color="#f97316"
            />
            <FormulaStep
              step={4}
              label="Expected Crit"
              formula={`1 + (${critChance}% x (${critMultiplier} - 1))`}
              result={calc.expectedCritMulti}
              unit="x"
              color="#a855f7"
            />

            {/* Final damage display */}
            <SurfaceCard level={3} className="p-3 mt-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xs font-bold uppercase tracking-widest text-text-muted">Expected Damage</div>
                  <div className="text-2xl font-mono font-bold text-orange-400 mt-1" style={{ textShadow: '0 0 12px rgba(249,115,22,0.4)' }}>
                    {calc.finalDamage.toFixed(1)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xs font-bold uppercase tracking-widest text-text-muted">On Crit</div>
                  <div className="text-lg font-mono font-bold text-purple-400 mt-1">
                    {calc.critDamage.toFixed(1)}
                  </div>
                </div>
              </div>
            </SurfaceCard>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Slider + Formula helpers ─────────────────────────────────────────── */

function SliderParam({ label, value, min, max, step = 1, onChange, unit, color }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string; color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono font-medium text-text-muted">{label}</span>
        <span className="text-xs font-mono font-bold" style={{ color }}>
          {step < 1 ? value.toFixed(1) : value}{unit ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 100%)`,
        }}
      />
    </div>
  );
}

function FormulaStep({ step, label, formula, result, unit, isPercent, color }: {
  step: number; label: string; formula: string; result: number;
  unit?: string; isPercent?: boolean; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: step * 0.08 }}
      className="flex items-center gap-2 text-xs bg-surface-deep/50 p-2 rounded-lg border border-border/40"
    >
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {step}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-mono font-bold text-text truncate">{label}</div>
        <div className="text-[10px] font-mono text-text-muted truncate">{formula}</div>
      </div>
      <span className="font-mono font-bold flex-shrink-0" style={{ color }}>
        {isPercent ? `${(result * 100).toFixed(1)}%` : `${result.toFixed(1)}${unit ?? ''}`}
      </span>
    </motion.div>
  );
}

/* ── Tag Quick-View Popover ────────────────────────────────────────────── */

function TagQuickViewPopover({ tag, detail, onClose }: { tag: string; detail: TagDetail; onClose: () => void }) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={popoverRef}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute z-50 bg-surface border border-border/40 rounded-lg shadow-2xl p-3 w-72"
      style={{ top: '100%', left: 0, marginTop: 4 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: detail.color, boxShadow: `0 0 6px ${detail.color}60` }} />
        <span className="text-sm font-bold text-text">{detail.name}</span>
        <span className="text-2xs font-mono text-text-muted ml-auto bg-surface-deep px-1.5 py-0.5 rounded border border-border/40">{detail.prefix}</span>
      </div>

      {/* Properties */}
      <div className="space-y-1.5 mb-2.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-mono text-text-muted">Tag</span>
          <span className="font-mono font-bold text-text">{tag}</span>
        </div>
        {detail.cooldown && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-mono text-text-muted">Cooldown</span>
            <span className="font-mono font-bold" style={{ color: '#f59e0b' }}>{detail.cooldown}</span>
          </div>
        )}
        {detail.manaCost !== undefined && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-mono text-text-muted">Mana Cost</span>
            <span className="font-mono font-bold" style={{ color: '#3b82f6' }}>{detail.manaCost === 0 ? 'None' : detail.manaCost}</span>
          </div>
        )}
      </div>

      {/* Blocking tags */}
      {detail.blockingTags.length > 0 && (
        <div className="mb-2.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Blocked By</div>
          <div className="flex flex-wrap gap-1">
            {detail.blockingTags.map(bt => (
              <span key={bt} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                {bt}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mini PipelineFlow */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Lifecycle</div>
        <PipelineFlow steps={detail.lifecycle} accent={detail.color} />
      </div>
    </motion.div>
  );
}

/* ── Section: Tag Audit Dashboard (3.9) ───────────────────────────────── */

function TagAuditSection() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag(prev => prev === tag ? null : tag);
  }, []);

  const handlePopoverClose = useCallback(() => {
    setSelectedTag(null);
  }, []);

  const statusColor = (status: AuditCategory['status']) => {
    switch (status) {
      case 'pass': return STATUS_SUCCESS;
      case 'warning': return STATUS_WARNING;
      case 'error': return STATUS_ERROR;
    }
  };

  const statusIcon = (status: AuditCategory['status']) => {
    switch (status) {
      case 'pass': return 'PASS';
      case 'warning': return 'WARN';
      case 'error': return 'FAIL';
    }
  };

  const maxUsage = Math.max(...TAG_USAGE_FREQUENCY.map(t => t.count));

  return (
    <div className="space-y-2.5">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={ClipboardCheck} label="Tag Audit Dashboard" color="#fbbf24" />
        <p className="text-xs text-text-muted mt-1 mb-2.5">
          Automated analysis of tag health across the Gameplay Tag hierarchy.
        </p>

        {/* Audit score */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="relative w-12 h-12">
            <svg width={48} height={48} viewBox="0 0 48 48">
              <circle cx={24} cy={24} r={20} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
              <circle
                cx={24} cy={24} r={20} fill="none"
                stroke={TAG_AUDIT_SCORE >= 80 ? STATUS_SUCCESS : TAG_AUDIT_SCORE >= 60 ? STATUS_WARNING : STATUS_ERROR}
                strokeWidth={4}
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - TAG_AUDIT_SCORE / 100)}
                strokeLinecap="round"
                transform="rotate(-90 24 24)"
                style={{ filter: `drop-shadow(0 0 6px ${STATUS_SUCCESS})` }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-mono font-bold" style={{ color: STATUS_SUCCESS }}>{TAG_AUDIT_SCORE}</span>
            </div>
          </div>
          <div>
            <div className="text-sm font-bold text-text">Overall Audit Score</div>
            <div className="text-xs text-text-muted">{TAG_AUDIT_SCORE}/100 - Good health, minor issues detected</div>
          </div>
        </div>

        {/* Audit categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {TAG_AUDIT_CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-surface-deep border rounded-lg p-3"
              style={{ borderColor: `${statusColor(cat.status)}30` }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono font-bold text-text">{cat.name}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${statusColor(cat.status)}20`, color: statusColor(cat.status) }}
                >
                  {statusIcon(cat.status)}
                </span>
              </div>
              <div className="text-lg font-mono font-bold mb-1" style={{ color: statusColor(cat.status) }}>{cat.count}</div>
              <div className="text-[10px] text-text-muted leading-tight">{cat.detail}</div>
            </motion.div>
          ))}
        </div>

        {/* Tag usage frequency */}
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Tag Usage Frequency (Top 10)</div>
        <div className="space-y-1.5">
          {TAG_USAGE_FREQUENCY.map((item, i) => {
            const detail = TAG_DETAIL_MAP[item.tag];
            const barColor = detail?.color ?? '#f59e0b';
            return (
              <div key={item.tag} className="relative">
                <motion.button
                  type="button"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 w-full text-left rounded-sm transition-colors hover:bg-surface-hover/40 cursor-pointer"
                  style={selectedTag === item.tag ? { backgroundColor: `${barColor}10` } : undefined}
                  onClick={() => handleTagClick(item.tag)}
                >
                  <span className="text-[10px] font-mono text-text-muted w-36 truncate flex-shrink-0 text-right">{item.tag}</span>
                  <div className="flex-1 h-4 bg-surface-deep/50 rounded-sm overflow-hidden border border-border/30">
                    <motion.div
                      className="h-full rounded-sm"
                      style={{ backgroundColor: barColor, width: `${(item.count / maxUsage) * 100}%`, opacity: 0.7 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.count / maxUsage) * 100}%` }}
                      transition={{ delay: i * 0.04 + 0.2, duration: 0.4 }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-text w-6 text-right">{item.count}</span>
                </motion.button>
                <AnimatePresence>
                  {selectedTag === item.tag && detail && (
                    <TagQuickViewPopover tag={item.tag} detail={detail} onClose={handlePopoverClose} />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Section: Loadout Optimizer (3.10) ────────────────────────────────── */

function LoadoutSection() {
  return (
    <div className="space-y-2.5">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute left-0 top-0 w-40 h-40 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={Layers} label="Ability Loadout Optimizer" color="#a855f7" />
        <p className="text-xs text-text-muted mt-1 mb-2.5">
          Optimal ability loadout for 4 slots, scored on coverage, synergy, DPS, burst, and utility.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Loadout slots */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Optimal Loadout</div>
            <div className="grid grid-cols-2 gap-3">
              {OPTIMAL_LOADOUT.map((slot, i) => (
                <motion.div
                  key={slot.slot}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                  className="bg-surface-deep border rounded-xl p-3 text-center relative overflow-hidden group"
                  style={{ borderColor: `${slot.color}40` }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `radial-gradient(ellipse at 50% 50%, ${slot.color}10, transparent 70%)` }}
                  />
                  <div className="text-[10px] font-mono text-text-muted mb-1">Slot {slot.slot}</div>
                  <div className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center mb-1.5"
                    style={{ backgroundColor: `${slot.color}20`, border: `1.5px solid ${slot.color}50` }}
                  >
                    <Sparkles className="w-5 h-5" style={{ color: slot.color }} />
                  </div>
                  <div className="text-xs font-mono font-bold" style={{ color: slot.color }}>{slot.ability}</div>
                </motion.div>
              ))}
            </div>

            {/* Loadout score */}
            <SurfaceCard level={3} className="p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-bold text-text-muted">Loadout Score</div>
                <div className="text-xl font-mono font-bold text-purple-400" style={{ textShadow: '0 0 10px rgba(168,85,247,0.3)' }}>
                  {LOADOUT_SCORE}/100
                </div>
              </div>
            </SurfaceCard>
          </div>

          {/* Radar + alternatives */}
          <div className="space-y-2.5">
            <div className="flex justify-center">
              <RadarChart data={LOADOUT_RADAR} size={140} accent="#a855f7" />
            </div>

            {/* Alternative loadouts */}
            <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Alternative Loadouts</div>
            <div className="space-y-2">
              {ALTERNATIVE_LOADOUTS.map((alt, i) => (
                <motion.div
                  key={alt.name}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 text-xs bg-surface-deep/50 p-2.5 rounded-lg border border-border/40"
                >
                  <span className="font-mono font-bold text-text w-20 flex-shrink-0">{alt.name}</span>
                  <div className="flex gap-1 flex-1">
                    {alt.abilities.map((ab, ai) => (
                      <span key={ai} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border/40 text-text-muted truncate">
                        {ab}
                      </span>
                    ))}
                  </div>
                  <span className="font-mono font-bold text-text-muted flex-shrink-0">{alt.score}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Shared types ──────────────────────────────────────────────────────── */

interface SectionProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
}

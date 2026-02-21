'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  BookOpen, Cpu, BarChart3, Tags, Sparkles, Flame,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_IMPROVED,
  OPACITY_10, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import {
  STATUS_COLORS, TabHeader, PipelineFlow, SectionLabel,
  FeatureCard as SharedFeatureCard, LoadingSpinner,
} from './_shared';

const ACCENT = MODULE_COLORS.systems;

/* ── Spellbook sections ────────────────────────────────────────────────── */

type SectionId = 'core' | 'attributes' | 'tags' | 'abilities' | 'effects';

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
];

/* ── Attribute radar data ──────────────────────────────────────────────── */

const ATTRIBUTES = [
  'Health', 'Mana', 'Strength', 'Dexterity', 'Intelligence',
  'Armor', 'AttackPower', 'CritChance', 'CritDamage',
];

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

/* ── Component ─────────────────────────────────────────────────────────── */

interface AbilitySpellbookProps {
  moduleId: SubModuleId;
}

export function AbilitySpellbook({ moduleId }: AbilitySpellbookProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [activeSection, setActiveSection] = useState<SectionId>('core');
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

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
    <div className="space-y-4">
      {/* Header */}
      <TabHeader icon={BookOpen} title="Ability Spellbook" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* Section tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {SECTIONS.map((s) => {
          const isActive = s.id === activeSection;
          const SIcon = s.icon;
          const sectionDone = s.featureNames.filter((n) => {
            const st = featureMap.get(n)?.status;
            return st === 'implemented' || st === 'improved';
          }).length;

          return (
            <motion.button
              key={s.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveSection(s.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all relative overflow-hidden group"
              style={isActive
                ? { backgroundColor: `${s.color}15`, color: s.color, border: `1px solid ${s.color}50`, boxShadow: `0 0 10px ${s.color}20` }
                : { backgroundColor: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
              }
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabGlow"
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none"
                  transition={{ duration: 0.3 }}
                />
              )}
              <SIcon className="w-4 h-4" />
              {s.label}
              {sectionDone > 0 && (
                <span className="text-2xs px-1.5 py-0.5 rounded-md ml-1" style={{ backgroundColor: `${s.color}20` }}>
                  {sectionDone}/{s.featureNames.length}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Section content */}
      <div className="min-h-[200px] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 w-full"
          >
            {activeSection === 'core' && (
              <CoreSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} />
            )}
            {activeSection === 'attributes' && (
              <AttributesSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} />
            )}
            {activeSection === 'tags' && (
              <TagsSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} />
            )}
            {activeSection === 'abilities' && (
              <AbilitiesSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} />
            )}
            {activeSection === 'effects' && (
              <EffectsSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Spacer to push pipeline down */}
      <div className="h-[200px]" />

      {/* GAS Architecture overview - always visible */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent" />
        <SectionLabel label="GAS Architecture Pipeline" />
        <div className="mt-3 relative z-10">
          <PipelineFlow steps={['ASC', 'AttributeSet', 'Tags', 'GameplayAbility', 'GameplayEffect', 'Execution']} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Section: Core ─────────────────────────────────────────────────────── */

function CoreSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  return (
    <div className="space-y-4">
      <SurfaceCard level={3} className="p-3 bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed">
        The Ability System Component (ASC) is the central hub that manages abilities, attributes, tags, and effects.
        It must be attached to the character base class and implement <span className="font-mono text-xs text-text">IAbilitySystemInterface</span>.
      </SurfaceCard>

      <SharedFeatureCard name="AbilitySystemComponent" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={MODULE_COLORS.core} />

      {/* Connection diagram */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden">
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
    </div>
  );
}

/* ── Section: Attributes ───────────────────────────────────────────────── */

function AttributesSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  const attrStatus = featureMap.get('Core AttributeSet')?.status ?? 'unknown';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SharedFeatureCard name="Core AttributeSet" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#10b981" />
        <SharedFeatureCard name="Default attribute initialization" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#10b981" />
      </div>

      {/* Attribute radar visualization */}
      <SurfaceCard level={2} className="p-4 relative">
        <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" /> Attribute Set Catalog
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ATTRIBUTES.map((attr, i) => {
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
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: isInit ? STATUS_SUCCESS : 'var(--border-bright)' }}
                />
                <span className="font-mono">{attr}</span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Section: Tags ─────────────────────────────────────────────────────── */

function TagsSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  return (
    <div className="space-y-4 flex">
      <div className="w-1/2 pr-2">
        <SharedFeatureCard name="Gameplay Tags hierarchy" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#f59e0b" />
      </div>

      <div className="w-1/2 pl-2">
        <SurfaceCard level={2} className="p-4 h-full">
          <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
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

/* ── Section: Abilities ────────────────────────────────────────────────── */

function AbilitiesSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  const crossModuleAbilities = [
    { name: 'Melee attack ability', module: 'arpg-combat' },
    { name: 'Dodge ability (GAS)', module: 'arpg-combat' },
  ];

  return (
    <div className="space-y-4">
      <SharedFeatureCard name="Base GameplayAbility" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#a855f7" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SurfaceCard level={2} className="p-4 relative">
          <div className="absolute right-0 top-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
          <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
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
          <div className="mt-4">
            <PipelineFlow steps={['CanActivate', 'CommitAbility', 'ActivateAbility', 'ApplyCost', 'EndAbility']} accent="#a855f7" />
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

/* ── Section: Effects ──────────────────────────────────────────────────── */

function EffectsSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SharedFeatureCard name="Core Gameplay Effects" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#ef4444" />
        <SharedFeatureCard name="Damage execution calculation" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent="#ef4444" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="mt-4">
            <PipelineFlow steps={['GameplayEffect', 'ExecutionCalc', 'Armor Reduction', 'Crit Multiplier', 'Final Damage']} accent="#ef4444" />
          </div>
        </SurfaceCard>
      </div>
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

'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Trash2, Code, GitCompare, ArrowRight, GripVertical,
  Zap, Shield, Heart, Swords, Timer, Tag, Cable, Circle, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD,
  MODULE_COLORS, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, SegmentedControl } from './_shared';

const ACCENT = MODULE_COLORS.systems;

/* ══════════════════════════════════════════════════════════════════════════
   DATA MODEL — mirrors C++ GAS types
   ══════════════════════════════════════════════════════════════════════════ */

type AttrCategory = 'meta' | 'vital' | 'primary' | 'combat' | 'progression';

interface EditorAttribute {
  id: string;
  name: string;
  category: AttrCategory;
  defaultValue: number;
  clampMin?: number;
  clampMax?: string; // string to allow "MaxHealth" references
}

interface AttrRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'scale' | 'clamp' | 'regen';
  formula: string;
}

type EffectDuration = 'instant' | 'duration' | 'infinite';

interface EditorEffect {
  id: string;
  name: string;
  duration: EffectDuration;
  durationSec: number;
  cooldownSec: number;
  color: string;
  modifiers: { attribute: string; operation: 'add' | 'multiply'; magnitude: number }[];
  grantedTags: string[];
}

interface TagRule {
  id: string;
  sourceTag: string;
  targetTag: string;
  type: 'blocks' | 'cancels' | 'requires';
}

interface LoadoutSlot {
  id: string;
  slot: number;
  abilityName: string;
  iconColor: string;
  cooldownTag: string;
}

interface EditorState {
  attributes: EditorAttribute[];
  relationships: AttrRelationship[];
  effects: EditorEffect[];
  tagRules: TagRule[];
  loadout: LoadoutSlot[];
}

/* ── Seed data from real C++ ARPGAttributeSet / ARPGGameplayTags ──────── */

const SEED_ATTRIBUTES: EditorAttribute[] = [
  { id: 'a-indmg', name: 'IncomingDamage', category: 'meta', defaultValue: 0 },
  { id: 'a-incrit', name: 'IncomingCrit', category: 'meta', defaultValue: 0 },
  { id: 'a-inheal', name: 'IncomingHeal', category: 'meta', defaultValue: 0 },
  { id: 'a-hp', name: 'Health', category: 'vital', defaultValue: 100, clampMin: 0, clampMax: 'MaxHealth' },
  { id: 'a-maxhp', name: 'MaxHealth', category: 'vital', defaultValue: 100, clampMin: 1 },
  { id: 'a-mp', name: 'Mana', category: 'vital', defaultValue: 50, clampMin: 0, clampMax: 'MaxMana' },
  { id: 'a-maxmp', name: 'MaxMana', category: 'vital', defaultValue: 50, clampMin: 0 },
  { id: 'a-str', name: 'Strength', category: 'primary', defaultValue: 10 },
  { id: 'a-dex', name: 'Dexterity', category: 'primary', defaultValue: 10 },
  { id: 'a-int', name: 'Intelligence', category: 'primary', defaultValue: 10 },
  { id: 'a-armor', name: 'Armor', category: 'combat', defaultValue: 0, clampMin: 0 },
  { id: 'a-atkpow', name: 'AttackPower', category: 'combat', defaultValue: 10, clampMin: 0 },
  { id: 'a-crit', name: 'CriticalChance', category: 'combat', defaultValue: 0.05, clampMin: 0, clampMax: '1.0' },
  { id: 'a-critdmg', name: 'CriticalDamage', category: 'combat', defaultValue: 1.5, clampMin: 1 },
  { id: 'a-xp', name: 'CurrentXP', category: 'progression', defaultValue: 0, clampMin: 0 },
  { id: 'a-xpnext', name: 'XPToNextLevel', category: 'progression', defaultValue: 100, clampMin: 1 },
  { id: 'a-level', name: 'CharacterLevel', category: 'progression', defaultValue: 1, clampMin: 1, clampMax: '50' },
];

const SEED_RELATIONSHIPS: AttrRelationship[] = [
  { id: 'r1', sourceId: 'a-indmg', targetId: 'a-hp', type: 'clamp', formula: 'Health -= IncomingDamage' },
  { id: 'r2', sourceId: 'a-inheal', targetId: 'a-hp', type: 'clamp', formula: 'Health += IncomingHeal' },
  { id: 'r3', sourceId: 'a-maxhp', targetId: 'a-hp', type: 'clamp', formula: 'clamp(0, MaxHealth)' },
  { id: 'r4', sourceId: 'a-maxmp', targetId: 'a-mp', type: 'clamp', formula: 'clamp(0, MaxMana)' },
  { id: 'r5', sourceId: 'a-int', targetId: 'a-maxmp', type: 'scale', formula: 'MaxMana += Intelligence * 5' },
  { id: 'r6', sourceId: 'a-str', targetId: 'a-atkpow', type: 'scale', formula: 'AttackPower += Strength * 2' },
];

const SEED_EFFECTS: EditorEffect[] = [
  { id: 'e1', name: 'GE_Damage', duration: 'instant', durationSec: 0, cooldownSec: 0, color: '#ef4444', modifiers: [{ attribute: 'IncomingDamage', operation: 'add', magnitude: 0 }], grantedTags: [] },
  { id: 'e2', name: 'GE_Heal', duration: 'instant', durationSec: 0, cooldownSec: 0, color: '#10b981', modifiers: [{ attribute: 'IncomingHeal', operation: 'add', magnitude: 25 }], grantedTags: [] },
  { id: 'e3', name: 'GE_Regen_Health', duration: 'infinite', durationSec: 0, cooldownSec: 2, color: '#8b5cf6', modifiers: [{ attribute: 'Health', operation: 'add', magnitude: 5 }], grantedTags: [] },
  { id: 'e4', name: 'GE_Buff_WarCry', duration: 'duration', durationSec: 15, cooldownSec: 0, color: '#3b82f6', modifiers: [{ attribute: 'AttackPower', operation: 'add', magnitude: 20 }, { attribute: 'Armor', operation: 'add', magnitude: 15 }], grantedTags: ['State.Buffed.WarCry'] },
  { id: 'e5', name: 'GE_Stun', duration: 'duration', durationSec: 2, cooldownSec: 0, color: '#f59e0b', modifiers: [], grantedTags: ['State.Stunned'] },
];

const SEED_TAG_RULES: TagRule[] = [
  { id: 't1', sourceTag: 'State.Dead', targetTag: 'Ability.*', type: 'blocks' },
  { id: 't2', sourceTag: 'State.Stunned', targetTag: 'Ability.*', type: 'blocks' },
  { id: 't3', sourceTag: 'State.Invulnerable', targetTag: 'Damage.*', type: 'blocks' },
  { id: 't4', sourceTag: 'State.Attacking', targetTag: 'Ability.Melee.*', type: 'blocks' },
  { id: 't5', sourceTag: 'Cooldown.Fireball', targetTag: 'Ability.Fireball', type: 'blocks' },
];

const SEED_LOADOUT: LoadoutSlot[] = [
  { id: 'l1', slot: 1, abilityName: 'Fireball', iconColor: '#ef4444', cooldownTag: 'Cooldown.Fireball' },
  { id: 'l2', slot: 2, abilityName: 'GroundSlam', iconColor: '#10b981', cooldownTag: 'Cooldown.GroundSlam' },
  { id: 'l3', slot: 3, abilityName: 'DashStrike', iconColor: '#06b6d4', cooldownTag: 'Cooldown.DashStrike' },
  { id: 'l4', slot: 4, abilityName: 'WarCry', iconColor: '#fbbf24', cooldownTag: 'Cooldown.WarCry' },
];

const CAT_COLORS: Record<AttrCategory, string> = {
  meta: ACCENT_CYAN,
  vital: STATUS_SUCCESS,
  primary: ACCENT_VIOLET,
  combat: ACCENT_ORANGE,
  progression: '#3b82f6',
};

const DURATION_OPTIONS = [
  { id: 'instant', label: 'Instant' },
  { id: 'duration', label: 'Duration' },
  { id: 'infinite', label: 'Infinite' },
];

/* ══════════════════════════════════════════════════════════════════════════
   C++ CODE GENERATION
   ══════════════════════════════════════════════════════════════════════════ */

function generateAttributeSetHeader(attrs: EditorAttribute[]): string {
  const lines: string[] = [
    '// Auto-generated by PoF GAS Blueprint Editor',
    '#pragma once',
    '#include "AttributeSet.h"',
    '#include "AbilitySystemComponent.h"',
    '#include "ARPGAttributeSet.generated.h"',
    '',
    'UCLASS()',
    'class UARPGAttributeSet : public UAttributeSet',
    '{',
    '    GENERATED_BODY()',
    '',
    'public:',
    '    UARPGAttributeSet();',
    '',
  ];

  const grouped = new Map<string, EditorAttribute[]>();
  for (const a of attrs) {
    const arr = grouped.get(a.category) || [];
    arr.push(a);
    grouped.set(a.category, arr);
  }

  for (const [cat, catAttrs] of grouped) {
    lines.push(`    // ── ${cat.charAt(0).toUpperCase() + cat.slice(1)} ──`);
    for (const a of catAttrs) {
      const meta = a.clampMin != null ? `, Meta=(AllowPrivateAccess="true")` : '';
      lines.push(`    UPROPERTY(BlueprintReadOnly, Category="Attributes|${cat}"${meta})`);
      lines.push(`    FGameplayAttributeData ${a.name};`);
      lines.push(`    ATTRIBUTE_ACCESSORS(UARPGAttributeSet, ${a.name})`);
      lines.push('');
    }
  }

  lines.push('    virtual void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override;');
  lines.push('    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;');
  lines.push('};');

  return lines.join('\n');
}

function generateTagsHeader(rules: TagRule[], loadout: LoadoutSlot[]): string {
  const tags = new Set<string>();
  for (const r of rules) {
    tags.add(r.sourceTag.replace(/\.\*/g, ''));
    tags.add(r.targetTag.replace(/\.\*/g, ''));
  }
  for (const s of loadout) {
    if (s.cooldownTag) tags.add(s.cooldownTag);
    tags.add(`Ability.${s.abilityName}`);
  }

  const lines: string[] = [
    '// Auto-generated by PoF GAS Blueprint Editor',
    '#pragma once',
    '#include "GameplayTagContainer.h"',
    '',
    'struct FARPGGameplayTags',
    '{',
    '    static const FARPGGameplayTags& Get() { return GameplayTags; }',
    '',
  ];

  const sorted = [...tags].filter(t => t.length > 0).sort();
  for (const tag of sorted) {
    const varName = tag.replace(/\./g, '_');
    lines.push(`    FGameplayTag ${varName};`);
  }

  lines.push('', 'private:', '    static FARPGGameplayTags GameplayTags;', '};');
  return lines.join('\n');
}

function generateEffectsCode(effects: EditorEffect[]): string {
  const lines: string[] = ['// Auto-generated GameplayEffect class stubs by PoF GAS Blueprint Editor', ''];

  for (const eff of effects) {
    lines.push(`// ── ${eff.name} ──`);
    lines.push(`// Duration: ${eff.duration}${eff.duration === 'duration' ? ` (${eff.durationSec}s)` : ''}`);
    if (eff.cooldownSec > 0) lines.push(`// Period: ${eff.cooldownSec}s`);
    if (eff.modifiers.length > 0) {
      lines.push('// Modifiers:');
      for (const m of eff.modifiers) {
        lines.push(`//   ${m.attribute}: ${m.operation === 'add' ? '+' : '*'}${m.magnitude}`);
      }
    }
    if (eff.grantedTags.length > 0) {
      lines.push(`// Granted Tags: ${eff.grantedTags.join(', ')}`);
    }
    lines.push(`U${eff.name}::U${eff.name}()`);
    lines.push('{');
    lines.push(`    DurationPolicy = EGameplayEffectDurationType::${eff.duration === 'instant' ? 'Instant' : eff.duration === 'duration' ? 'HasDuration' : 'Infinite'};`);
    if (eff.duration === 'duration') {
      lines.push(`    DurationMagnitude = FScalableFloat(${eff.durationSec.toFixed(1)}f);`);
    }
    if (eff.cooldownSec > 0) {
      lines.push(`    Period = FScalableFloat(${eff.cooldownSec.toFixed(1)}f);`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

/* ══════════════════════════════════════════════════════════════════════════
   SUB-EDITORS
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Attribute Relationship Web Editor ──────────────────────────────────── */

function RelationshipWebEditor({
  attributes, relationships, onChange,
}: {
  attributes: EditorAttribute[];
  relationships: AttrRelationship[];
  onChange: (rels: AttrRelationship[]) => void;
}) {
  const [dragSource, setDragSource] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    const byCat = new Map<AttrCategory, EditorAttribute[]>();
    for (const a of attributes) {
      const arr = byCat.get(a.category) || [];
      arr.push(a);
      byCat.set(a.category, arr);
    }
    const catOrder: AttrCategory[] = ['meta', 'vital', 'primary', 'combat', 'progression'];
    let col = 0;
    for (const cat of catOrder) {
      const items = byCat.get(cat) || [];
      for (let i = 0; i < items.length; i++) {
        positions.set(items[i].id, {
          x: 30 + col * 80,
          y: 25 + i * 32,
        });
      }
      col++;
    }
    return positions;
  }, [attributes]);

  const svgW = 430;
  const svgH = Math.max(200, (Math.max(...[...nodePositions.values()].map(p => p.y)) || 100) + 50);

  const relColors: Record<AttrRelationship['type'], string> = {
    scale: ACCENT_VIOLET,
    clamp: STATUS_WARNING,
    regen: STATUS_SUCCESS,
  };

  const handleDragStart = useCallback((attrId: string) => {
    setDragSource(attrId);
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    if (!dragSource || dragSource === targetId) { setDragSource(null); return; }
    const newRel: AttrRelationship = {
      id: `r-${Date.now()}`,
      sourceId: dragSource,
      targetId,
      type: 'scale',
      formula: `${attributes.find(a => a.id === targetId)?.name} += ${attributes.find(a => a.id === dragSource)?.name} * 1.0`,
    };
    onChange([...relationships, newRel]);
    setDragSource(null);
  }, [dragSource, attributes, relationships, onChange]);

  const removeRel = useCallback((relId: string) => {
    onChange(relationships.filter(r => r.id !== relId));
  }, [relationships, onChange]);

  return (
    <div className="space-y-2">
      <div className="text-2xs text-text-muted">Drag from one attribute to another to create a dependency. Click an edge to remove.</div>
      <div className="relative overflow-x-auto custom-scrollbar">
        <svg ref={svgRef} width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
          {/* Relationship edges */}
          {relationships.map((rel) => {
            const from = nodePositions.get(rel.sourceId);
            const to = nodePositions.get(rel.targetId);
            if (!from || !to) return null;
            return (
              <g key={rel.id} className="cursor-pointer" onClick={() => removeRel(rel.id)}>
                <line
                  x1={from.x + 34} y1={from.y + 10} x2={to.x} y2={to.y + 10}
                  stroke={relColors[rel.type]} strokeWidth={1.5}
                  strokeDasharray={rel.type === 'clamp' ? '4 3' : undefined}
                  opacity={0.6}
                  markerEnd="url(#gas-arrow)"
                />
                {(rel.type === 'scale' || rel.type === 'regen') && (
                  <circle r={2} fill={relColors[rel.type]} opacity={0.6} className="pointer-events-none">
                    <animateMotion
                      dur={rel.type === 'regen' ? '1.5s' : '2.5s'}
                      repeatCount="indefinite"
                      path={`M ${from.x + 34},${from.y + 10} L ${to.x},${to.y + 10}`}
                    />
                  </circle>
                )}
                <text
                  x={(from.x + 34 + to.x) / 2} y={(from.y + to.y) / 2 + 6}
                  fill={relColors[rel.type]} fontSize={7} fontFamily="monospace" textAnchor="middle"
                  className="pointer-events-none"
                >
                  {rel.type}
                </text>
              </g>
            );
          })}

          <defs>
            <marker id="gas-arrow" viewBox="0 0 6 4" refX="6" refY="2" markerWidth="6" markerHeight="4" orient="auto">
              <path d="M0,0 L6,2 L0,4" fill="rgba(255,255,255,0.4)" />
            </marker>
          </defs>

          {/* Attribute nodes */}
          {attributes.map((attr) => {
            const pos = nodePositions.get(attr.id);
            if (!pos) return null;
            const color = CAT_COLORS[attr.category];
            const isDragTarget = dragSource && dragSource !== attr.id;
            return (
              <g
                key={attr.id}
                className="cursor-grab active:cursor-grabbing"
                onMouseDown={() => handleDragStart(attr.id)}
                onMouseUp={() => isDragTarget && handleDrop(attr.id)}
              >
                <rect
                  x={pos.x - 2} y={pos.y} width={70} height={20} rx={4}
                  fill={isDragTarget ? `${color}30` : `${color}15`}
                  stroke={isDragTarget ? color : `${color}50`}
                  strokeWidth={isDragTarget ? 1.5 : 0.8}
                />
                <text x={pos.x + 33} y={pos.y + 13} fill={color} fontSize={8} fontFamily="monospace" textAnchor="middle">
                  {attr.name.length > 10 ? attr.name.slice(0, 9) + '…' : attr.name}
                </text>
              </g>
            );
          })}

          {/* Category column headers */}
          {(['meta', 'vital', 'primary', 'combat', 'progression'] as AttrCategory[]).map((cat, i) => (
            <text key={cat} x={30 + i * 80 + 33} y={14} fill={CAT_COLORS[cat]} fontSize={8} fontFamily="monospace"
              textAnchor="middle" fontWeight="bold" opacity={0.7}>
              {cat.toUpperCase()}
            </text>
          ))}
        </svg>
      </div>

      {/* Active relationships list */}
      <div className="space-y-1">
        {relationships.map((rel) => (
          <div key={rel.id} className="flex items-center gap-2 px-2 py-1 rounded text-2xs font-mono" style={{ backgroundColor: `${relColors[rel.type]}08`, border: `1px solid ${relColors[rel.type]}20` }}>
            <span style={{ color: relColors[rel.type] }}>{rel.type}</span>
            <span className="text-text-muted">{attributes.find(a => a.id === rel.sourceId)?.name}</span>
            <ArrowRight className="w-2.5 h-2.5 text-text-muted" />
            <span className="text-text">{attributes.find(a => a.id === rel.targetId)?.name}</span>
            <span className="text-text-muted ml-auto truncate max-w-[150px]">{rel.formula}</span>
            <button onClick={() => removeRel(rel.id)} className="text-text-muted hover:text-red-400 ml-1 flex-shrink-0">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Effect Lifecycle Timeline Editor ──────────────────────────────────── */

function EffectTimelineEditor({
  effects, onChange, onSelectItem,
}: {
  effects: EditorEffect[];
  onChange: (effs: EditorEffect[]) => void;
  onSelectItem?: (label: string | null) => void;
}) {
  const [selectedEffect, setSelectedEffectRaw] = useState<string | null>(null);
  const [playheadTime, setPlayheadTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef<SVGSVGElement>(null);
  const setSelectedEffect = useCallback((id: string | null) => {
    setSelectedEffectRaw(id);
    const eff = id ? effects.find(e => e.id === id) : null;
    onSelectItem?.(eff ? eff.name : null);
  }, [effects, onSelectItem]);

  const maxTime = useMemo(() => {
    let t = 10;
    for (const e of effects) {
      const end = (e.durationSec || 0) + (e.cooldownSec || 0);
      if (end > t) t = end + 2;
    }
    return t;
  }, [effects]);

  // Convert mouse X to time value
  const xToTime = useCallback((clientX: number): number => {
    const svg = timelineRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const svgWidth = rect.width;
    const viewBoxWidth = 400;
    const scale = viewBoxWidth / svgWidth;
    const svgX = (clientX - rect.left) * scale;
    const t = ((svgX - 40) / 350) * maxTime;
    return Math.max(0, Math.min(maxTime, t));
  }, [maxTime]);

  const handleTimelineMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    setPlayheadTime(xToTime(e.clientX));
  }, [xToTime]);

  const handleTimelineMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setPlayheadTime(xToTime(e.clientX));
  }, [isDragging, xToTime]);

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Determine which effects are active at playhead time
  const activeAtPlayhead = useMemo(() => {
    if (playheadTime === null) return new Set<string>();
    const active = new Set<string>();
    for (const eff of effects) {
      if (eff.duration === 'instant') {
        // Instant effects are "active" only at t=0 (flash)
        if (playheadTime < 0.3) active.add(eff.id);
      } else if (eff.duration === 'infinite') {
        active.add(eff.id);
      } else {
        // duration-based: active from 0 to durationSec
        if (playheadTime <= eff.durationSec) active.add(eff.id);
      }
    }
    return active;
  }, [effects, playheadTime]);

  const activeEffectDetails = useMemo(() => {
    if (playheadTime === null) return [];
    return effects.filter(e => activeAtPlayhead.has(e.id));
  }, [effects, activeAtPlayhead, playheadTime]);

  const addEffect = useCallback(() => {
    const newEff: EditorEffect = {
      id: `e-${Date.now()}`,
      name: `GE_New_${effects.length + 1}`,
      duration: 'instant',
      durationSec: 0,
      cooldownSec: 0,
      color: ['#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'][effects.length % 5],
      modifiers: [],
      grantedTags: [],
    };
    onChange([...effects, newEff]);
    setSelectedEffect(newEff.id);
  }, [effects, onChange]);

  const removeEffect = useCallback((id: string) => {
    onChange(effects.filter(e => e.id !== id));
    if (selectedEffect === id) setSelectedEffect(null);
  }, [effects, onChange, selectedEffect]);

  const updateEffect = useCallback((id: string, updates: Partial<EditorEffect>) => {
    onChange(effects.map(e => e.id === id ? { ...e, ...updates } : e));
  }, [effects, onChange]);

  const sel = effects.find(e => e.id === selectedEffect);

  return (
    <div className="space-y-2">
      {/* Timeline visualization */}
      <div className="relative overflow-x-auto custom-scrollbar">
        <svg
          ref={timelineRef}
          width="100%" height={80 + effects.length * 28} viewBox={`0 0 400 ${80 + effects.length * 28}`}
          preserveAspectRatio="xMinYMin" className="overflow-visible cursor-crosshair"
          onMouseDown={handleTimelineMouseDown}
          onMouseMove={handleTimelineMouseMove}
          onMouseUp={handleTimelineMouseUp}
          onMouseLeave={handleTimelineMouseUp}
        >
          {/* Time axis */}
          <line x1={40} y1={20} x2={390} y2={20} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          {Array.from({ length: Math.ceil(maxTime) + 1 }, (_, i) => {
            const x = 40 + (i / maxTime) * 350;
            return (
              <g key={i}>
                <line x1={x} y1={18} x2={x} y2={22} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                <text x={x} y={14} fill="rgba(255,255,255,0.3)" fontSize={7} fontFamily="monospace" textAnchor="middle">{i}s</text>
              </g>
            );
          })}

          {/* Effect blocks */}
          {effects.map((eff, i) => {
            const y = 32 + i * 28;
            const isSelected = selectedEffect === eff.id;
            const isActive = playheadTime !== null ? activeAtPlayhead.has(eff.id) : true;
            const blockOpacity = playheadTime !== null ? (isActive ? 1 : 0.25) : (isSelected ? 1 : 0.7);

            if (eff.duration === 'instant') {
              const x = 40;
              return (
                <g key={eff.id} className="cursor-pointer" onClick={() => setSelectedEffect(eff.id)} opacity={blockOpacity}>
                  <circle cx={x + 4} cy={y + 10} r={6} fill={eff.color}
                    stroke={isSelected ? '#fff' : isActive && playheadTime !== null ? eff.color : 'none'}
                    strokeWidth={1.5}
                    style={isActive && playheadTime !== null ? { filter: `drop-shadow(0 0 4px ${eff.color})` } : undefined}
                  />
                  <text x={x + 16} y={y + 13} fill={eff.color} fontSize={8} fontFamily="monospace">{eff.name}</text>
                </g>
              );
            }

            const blockW = Math.max(20, (eff.durationSec / maxTime) * 350);
            return (
              <g key={eff.id} className="cursor-pointer" onClick={() => setSelectedEffect(eff.id)} opacity={blockOpacity}>
                <rect x={40} y={y} width={blockW} height={20} rx={3}
                  fill={`${eff.color}${isActive && playheadTime !== null ? '50' : '30'}`}
                  stroke={isSelected ? '#fff' : `${eff.color}60`} strokeWidth={isSelected ? 1.5 : 0.8}
                  style={isActive && playheadTime !== null ? { filter: `drop-shadow(0 0 3px ${eff.color}60)` } : undefined}
                />
                <text x={44} y={y + 13} fill={eff.color} fontSize={8} fontFamily="monospace">{eff.name}</text>
                {eff.duration === 'duration' && (
                  <text x={40 + blockW - 4} y={y + 13} fill="rgba(255,255,255,0.4)" fontSize={7} fontFamily="monospace" textAnchor="end">
                    {eff.durationSec}s
                  </text>
                )}
                {eff.duration === 'infinite' && (
                  <text x={40 + blockW - 4} y={y + 13} fill="rgba(255,255,255,0.4)" fontSize={7} fontFamily="monospace" textAnchor="end">∞</text>
                )}
                {/* Cooldown zone */}
                {eff.cooldownSec > 0 && (
                  <rect x={40 + blockW} y={y + 2} width={Math.max(8, (eff.cooldownSec / maxTime) * 350)} height={16} rx={2}
                    fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} strokeDasharray="3 2" />
                )}
              </g>
            );
          })}

          {/* Playhead */}
          {playheadTime !== null && (() => {
            const px = 40 + (playheadTime / maxTime) * 350;
            const svgH = 80 + effects.length * 28;
            return (
              <g>
                <line x1={px} y1={8} x2={px} y2={svgH - 4} stroke={ACCENT} strokeWidth={1.5} opacity={0.9} />
                {/* Playhead handle */}
                <polygon
                  points={`${px - 5},6 ${px + 5},6 ${px},13`}
                  fill={ACCENT} stroke="none"
                />
                {/* Time label on handle */}
                <text x={px} y={4} fill={ACCENT} fontSize={7} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                  {playheadTime.toFixed(1)}s
                </text>
              </g>
            );
          })()}
        </svg>

        {/* Active effects badge */}
        {playheadTime !== null && activeEffectDetails.length > 0 && (
          <div className="absolute top-0 right-0 mt-1 mr-1 p-1.5 rounded-lg border border-border/40 bg-surface-deep/90 backdrop-blur-sm max-w-[160px]">
            <div className="text-[9px] font-mono font-bold text-text-muted uppercase tracking-wider mb-1">
              Active @ {playheadTime.toFixed(1)}s
            </div>
            {activeEffectDetails.map((eff) => (
              <div key={eff.id} className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: eff.color, boxShadow: `0 0 4px ${eff.color}` }} />
                <span className="text-[9px] font-mono font-bold truncate" style={{ color: eff.color }}>{eff.name}</span>
              </div>
            ))}
            {activeEffectDetails.some(e => e.grantedTags.length > 0) && (
              <div className="mt-1 pt-1 border-t border-border/30">
                <div className="text-[8px] font-mono text-text-muted uppercase tracking-wider mb-0.5">Tags</div>
                <div className="flex flex-wrap gap-0.5">
                  {activeEffectDetails.flatMap(e => e.grantedTags.map(t => ({ tag: t, color: e.color }))).map(({ tag, color }) => (
                    <span key={tag} className="text-[8px] font-mono px-1 py-0 rounded" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}25` }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={addEffect} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
          <Plus className="w-3 h-3" /> Add Effect
        </button>
      </div>

      {/* Selected effect editor */}
      <AnimatePresence>
        {sel && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-2.5 rounded-lg border border-border/40 bg-surface-deep/50 space-y-2">
              <div className="flex items-center justify-between">
                <input
                  value={sel.name} onChange={(e) => updateEffect(sel.id, { name: e.target.value })}
                  className="bg-transparent text-xs font-mono font-bold text-text border-b border-border/40 focus:border-current focus:outline-none w-40 pb-0.5"
                  style={{ color: sel.color }}
                />
                <button onClick={() => removeEffect(sel.id)} className="text-text-muted hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-2xs text-text-muted font-bold uppercase tracking-wider">Duration Type</label>
                  <SegmentedControl
                    options={DURATION_OPTIONS}
                    activeId={sel.duration}
                    onChange={(id) => updateEffect(sel.id, { duration: id as EffectDuration })}
                    accent={sel.color}
                  />
                </div>
                {sel.duration === 'duration' && (
                  <div>
                    <label className="text-2xs text-text-muted font-bold uppercase tracking-wider">Seconds</label>
                    <input type="number" value={sel.durationSec} min={0} step={0.5}
                      onChange={(e) => updateEffect(sel.id, { durationSec: Number(e.target.value) })}
                      className="w-16 bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-xs font-mono text-text focus:outline-none focus:border-current"
                      style={{ color: sel.color }}
                    />
                  </div>
                )}
                <div>
                  <label className="text-2xs text-text-muted font-bold uppercase tracking-wider">Cooldown</label>
                  <input type="number" value={sel.cooldownSec} min={0} step={0.5}
                    onChange={(e) => updateEffect(sel.id, { cooldownSec: Number(e.target.value) })}
                    className="w-16 bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-xs font-mono text-text focus:outline-none focus:border-current"
                  />
                </div>
              </div>

              {/* Modifiers */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-2xs text-text-muted font-bold uppercase tracking-wider">Modifiers</label>
                  <button
                    onClick={() => updateEffect(sel.id, { modifiers: [...sel.modifiers, { attribute: 'Health', operation: 'add', magnitude: 0 }] })}
                    className="text-2xs text-text-muted hover:text-text"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1 mt-1">
                  {sel.modifiers.map((m, mi) => (
                    <div key={mi} className="flex items-center gap-1.5 text-2xs font-mono">
                      <input
                        value={m.attribute}
                        onChange={(e) => {
                          const mods = [...sel.modifiers];
                          mods[mi] = { ...m, attribute: e.target.value };
                          updateEffect(sel.id, { modifiers: mods });
                        }}
                        className="bg-surface-deep border border-border/30 rounded px-1 py-0.5 text-text w-28 focus:outline-none"
                      />
                      <select
                        value={m.operation}
                        onChange={(e) => {
                          const mods = [...sel.modifiers];
                          mods[mi] = { ...m, operation: e.target.value as 'add' | 'multiply' };
                          updateEffect(sel.id, { modifiers: mods });
                        }}
                        className="bg-surface-deep border border-border/30 rounded px-1 py-0.5 text-text-muted focus:outline-none"
                      >
                        <option value="add">+</option>
                        <option value="multiply">×</option>
                      </select>
                      <input
                        type="number" value={m.magnitude} step={1}
                        onChange={(e) => {
                          const mods = [...sel.modifiers];
                          mods[mi] = { ...m, magnitude: Number(e.target.value) };
                          updateEffect(sel.id, { modifiers: mods });
                        }}
                        className="bg-surface-deep border border-border/30 rounded px-1 py-0.5 text-text w-16 focus:outline-none"
                      />
                      <button onClick={() => {
                        const mods = sel.modifiers.filter((_, j) => j !== mi);
                        updateEffect(sel.id, { modifiers: mods });
                      }} className="text-text-muted hover:text-red-400"><Trash2 className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Granted tags */}
              <div>
                <label className="text-2xs text-text-muted font-bold uppercase tracking-wider">Granted Tags</label>
                <input
                  value={sel.grantedTags.join(', ')}
                  onChange={(e) => updateEffect(sel.id, { grantedTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  placeholder="State.Stunned, ..."
                  className="w-full bg-surface-deep border border-border/30 rounded px-1.5 py-0.5 text-2xs font-mono text-text mt-0.5 focus:outline-none"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Tag Dependency Graph Editor ───────────────────────────────────────── */

interface TagValidation {
  srcUnmatched: boolean;
  tgtUnmatched: boolean;
  conflict: string | null; // description of the contradiction
}

/** Check if a tag matches any known tag (supports wildcard .* suffix) */
function tagMatchesKnown(tag: string, knownTags: Set<string>): boolean {
  if (!tag || tag.endsWith('.')) return false; // incomplete tag
  if (knownTags.has(tag)) return true;
  // Check wildcard: "Ability.*" should match if any known tag starts with "Ability."
  if (tag.endsWith('.*')) {
    const prefix = tag.slice(0, -1); // "Ability."
    for (const known of knownTags) {
      if (known.startsWith(prefix)) return true;
    }
  }
  // Check if a known wildcard pattern covers this tag
  for (const known of knownTags) {
    if (known.endsWith('.*')) {
      const prefix = known.slice(0, -1);
      if (tag.startsWith(prefix)) return true;
    }
  }
  return false;
}

/** Check if two tag patterns can overlap (for contradiction detection) */
function tagsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.endsWith('.*') && b.startsWith(a.slice(0, -1))) return true;
  if (b.endsWith('.*') && a.startsWith(b.slice(0, -1))) return true;
  return false;
}

function TagRulesEditor({
  rules, onChange, effects, loadout,
}: {
  rules: TagRule[];
  onChange: (rules: TagRule[]) => void;
  effects: EditorEffect[];
  loadout: LoadoutSlot[];
}) {
  const addRule = useCallback(() => {
    const newRule: TagRule = {
      id: `tr-${Date.now()}`,
      sourceTag: 'State.',
      targetTag: 'Ability.',
      type: 'blocks',
    };
    onChange([...rules, newRule]);
  }, [rules, onChange]);

  const removeRule = useCallback((id: string) => {
    onChange(rules.filter(r => r.id !== id));
  }, [rules, onChange]);

  const updateRule = useCallback((id: string, updates: Partial<TagRule>) => {
    onChange(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  }, [rules, onChange]);

  const ruleColors: Record<TagRule['type'], string> = {
    blocks: STATUS_ERROR,
    cancels: ACCENT_ORANGE,
    requires: STATUS_SUCCESS,
  };

  // Build known tags set from effects grantedTags and loadout cooldownTags
  const knownTags = useMemo(() => {
    const tags = new Set<string>();
    for (const eff of effects) {
      for (const t of eff.grantedTags) if (t) tags.add(t);
    }
    for (const slot of loadout) {
      if (slot.cooldownTag) tags.add(slot.cooldownTag);
    }
    // Also include tags used in rules themselves (source/target) as "known" cross-references
    for (const r of rules) {
      if (r.sourceTag && !r.sourceTag.endsWith('.')) tags.add(r.sourceTag);
      if (r.targetTag && !r.targetTag.endsWith('.')) tags.add(r.targetTag);
    }
    return tags;
  }, [effects, loadout, rules]);

  // Validate each rule
  const validations = useMemo((): Map<string, TagValidation> => {
    const map = new Map<string, TagValidation>();
    for (const rule of rules) {
      const srcUnmatched = rule.sourceTag.length > 0 && !rule.sourceTag.endsWith('.') && !tagMatchesKnown(rule.sourceTag, knownTags);
      const tgtUnmatched = rule.targetTag.length > 0 && !rule.targetTag.endsWith('.') && !tagMatchesKnown(rule.targetTag, knownTags);

      // Contradiction detection: same source blocks AND requires overlapping target
      let conflict: string | null = null;
      if (rule.type === 'blocks' || rule.type === 'requires') {
        const oppositeType = rule.type === 'blocks' ? 'requires' : 'blocks';
        const contradicting = rules.find(other =>
          other.id !== rule.id &&
          other.type === oppositeType &&
          tagsOverlap(other.sourceTag, rule.sourceTag) &&
          tagsOverlap(other.targetTag, rule.targetTag)
        );
        if (contradicting) {
          conflict = `Conflicts with "${contradicting.sourceTag} ${contradicting.type} ${contradicting.targetTag}"`;
        }
      }

      map.set(rule.id, { srcUnmatched, tgtUnmatched, conflict });
    }
    return map;
  }, [rules, knownTags]);

  return (
    <div className="space-y-2">
      {/* Rule visualization */}
      <div className="relative overflow-x-auto custom-scrollbar">
        <svg width="100%" height={Math.max(80, rules.length * 24 + 20)} viewBox={`0 0 380 ${Math.max(80, rules.length * 24 + 20)}`} preserveAspectRatio="xMinYMin" className="overflow-visible">
          {rules.map((rule, i) => {
            const y = 10 + i * 24;
            const color = ruleColors[rule.type];
            const v = validations.get(rule.id);
            return (
              <g key={rule.id}>
                {/* Source tag */}
                <rect x={4} y={y} width={110} height={18} rx={3} fill={`${color}15`} stroke={v?.srcUnmatched ? `${STATUS_WARNING}80` : `${color}40`} strokeWidth={v?.srcUnmatched ? 1.2 : 0.8} />
                <text x={59} y={y + 12} fill={color} fontSize={8} fontFamily="monospace" textAnchor="middle">{rule.sourceTag}</text>
                {v?.srcUnmatched && (
                  <circle cx={4} cy={y} r={3.5} fill={STATUS_WARNING}>
                    <title>Unmatched: no effect or loadout uses this tag</title>
                  </circle>
                )}
                {/* Arrow */}
                <line x1={118} y1={y + 9} x2={168} y2={y + 9} stroke={color} strokeWidth={1.5}
                  strokeDasharray={rule.type === 'cancels' ? '4 2' : undefined} />
                <text x={143} y={y + 6} fill={color} fontSize={7} fontFamily="monospace" textAnchor="middle" fontWeight="bold">{rule.type}</text>
                {/* Target tag */}
                <rect x={172} y={y} width={110} height={18} rx={3} fill="rgba(255,255,255,0.03)" stroke={v?.tgtUnmatched ? `${STATUS_WARNING}80` : 'rgba(255,255,255,0.1)'} strokeWidth={v?.tgtUnmatched ? 1.2 : 0.8} />
                <text x={227} y={y + 12} fill="rgba(255,255,255,0.6)" fontSize={8} fontFamily="monospace" textAnchor="middle">{rule.targetTag}</text>
                {v?.tgtUnmatched && (
                  <circle cx={282} cy={y} r={3.5} fill={STATUS_WARNING}>
                    <title>Unmatched: no effect or loadout uses this tag</title>
                  </circle>
                )}
                {/* Conflict badge */}
                {v?.conflict && (
                  <g>
                    <rect x={290} y={y + 2} width={80} height={14} rx={3} fill={`${STATUS_ERROR}20`} stroke={`${STATUS_ERROR}60`} strokeWidth={0.8} />
                    <text x={330} y={y + 12} fill={STATUS_ERROR} fontSize={6.5} fontFamily="monospace" textAnchor="middle" fontWeight="bold">CONFLICT</text>
                    <title>{v.conflict}</title>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Editable rule list */}
      <div className="space-y-1">
        {rules.map((rule) => {
          const color = ruleColors[rule.type];
          const v = validations.get(rule.id);
          return (
            <div key={rule.id} className="flex items-center gap-1.5 text-2xs font-mono">
              <div className="relative">
                <input
                  value={rule.sourceTag}
                  onChange={(e) => updateRule(rule.id, { sourceTag: e.target.value })}
                  className="bg-surface-deep border rounded px-1.5 py-0.5 text-text w-32 focus:outline-none"
                  style={{ borderColor: v?.srcUnmatched ? `${STATUS_WARNING}80` : undefined }}
                />
                {v?.srcUnmatched && (
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_WARNING }}
                    title="Unmatched: no effect or loadout uses this tag"
                  />
                )}
              </div>
              <select
                value={rule.type}
                onChange={(e) => updateRule(rule.id, { type: e.target.value as TagRule['type'] })}
                className="bg-surface-deep border border-border/30 rounded px-1 py-0.5 focus:outline-none"
                style={{ color }}
              >
                <option value="blocks">blocks</option>
                <option value="cancels">cancels</option>
                <option value="requires">requires</option>
              </select>
              <div className="relative">
                <input
                  value={rule.targetTag}
                  onChange={(e) => updateRule(rule.id, { targetTag: e.target.value })}
                  className="bg-surface-deep border rounded px-1.5 py-0.5 text-text w-32 focus:outline-none"
                  style={{ borderColor: v?.tgtUnmatched ? `${STATUS_WARNING}80` : undefined }}
                />
                {v?.tgtUnmatched && (
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_WARNING }}
                    title="Unmatched: no effect or loadout uses this tag"
                  />
                )}
              </div>
              {v?.conflict && (
                <span
                  className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ backgroundColor: `${STATUS_ERROR}20`, color: STATUS_ERROR, border: `1px solid ${STATUS_ERROR}40` }}
                  title={v.conflict}
                >
                  CONFLICT
                </span>
              )}
              <button onClick={() => removeRule(rule.id)} className="text-text-muted hover:text-red-400 flex-shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      <button onClick={addRule} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium" style={{ backgroundColor: `${STATUS_ERROR}15`, color: STATUS_ERROR, border: `1px solid ${STATUS_ERROR}30` }}>
        <Plus className="w-3 h-3" /> Add Rule
      </button>
    </div>
  );
}

/* ── Loadout Hotbar Editor ─────────────────────────────────────────────── */

function LoadoutEditor({
  loadout, onChange,
}: {
  loadout: LoadoutSlot[];
  onChange: (slots: LoadoutSlot[]) => void;
}) {
  const addSlot = useCallback(() => {
    const newSlot: LoadoutSlot = {
      id: `ls-${Date.now()}`,
      slot: loadout.length + 1,
      abilityName: 'NewAbility',
      iconColor: ['#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'][loadout.length % 5],
      cooldownTag: '',
    };
    onChange([...loadout, newSlot]);
  }, [loadout, onChange]);

  const removeSlot = useCallback((id: string) => {
    onChange(loadout.filter(s => s.id !== id));
  }, [loadout, onChange]);

  const updateSlot = useCallback((id: string, updates: Partial<LoadoutSlot>) => {
    onChange(loadout.map(s => s.id === id ? { ...s, ...updates } : s));
  }, [loadout, onChange]);

  return (
    <div className="space-y-2">
      {/* Visual hotbar */}
      <div className="flex items-center gap-2 justify-center py-3">
        {loadout.map((slot) => (
          <motion.button
            key={slot.id}
            layout
            className="relative w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 group"
            style={{ borderColor: `${slot.iconColor}60`, backgroundColor: `${slot.iconColor}10` }}
            onClick={() => {/* select for editing */ }}
          >
            <Zap className="w-5 h-5" style={{ color: slot.iconColor }} />
            <span className="text-[8px] font-mono font-bold truncate w-full text-center px-0.5" style={{ color: slot.iconColor }}>
              {slot.abilityName}
            </span>
            <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center bg-surface border border-border/60 text-text-muted">
              {slot.slot}
            </span>
          </motion.button>
        ))}
        <button
          onClick={addSlot}
          className="w-14 h-14 rounded-lg border-2 border-dashed border-border/40 flex items-center justify-center hover:border-border transition-colors"
        >
          <Plus className="w-5 h-5 text-text-muted" />
        </button>
      </div>

      {/* Editable slot list */}
      <div className="space-y-1">
        {loadout.map((slot) => (
          <div key={slot.id} className="flex items-center gap-1.5 text-2xs font-mono">
            <span className="w-5 h-5 rounded text-center leading-5 font-bold" style={{ backgroundColor: `${slot.iconColor}20`, color: slot.iconColor }}>
              {slot.slot}
            </span>
            <input
              value={slot.abilityName}
              onChange={(e) => updateSlot(slot.id, { abilityName: e.target.value })}
              className="bg-surface-deep border border-border/30 rounded px-1.5 py-0.5 text-text w-28 focus:outline-none"
            />
            <input
              value={slot.cooldownTag}
              onChange={(e) => updateSlot(slot.id, { cooldownTag: e.target.value })}
              placeholder="Cooldown.Tag"
              className="bg-surface-deep border border-border/30 rounded px-1.5 py-0.5 text-text-muted w-36 focus:outline-none"
            />
            <button onClick={() => removeSlot(slot.id)} className="text-text-muted hover:text-red-400 flex-shrink-0">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Code Preview & Diff ───────────────────────────────────────────────── */

function CodePreview({ code, prevCode }: { code: string; prevCode: string | null }) {
  const [showDiff, setShowDiff] = useState(false);

  const diffLines = useMemo(() => {
    if (!prevCode || !showDiff) return null;
    const oldLines = prevCode.split('\n');
    const newLines = code.split('\n');
    const result: { line: string; type: 'same' | 'added' | 'removed' }[] = [];

    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    for (const line of newLines) {
      result.push({ line, type: oldSet.has(line) ? 'same' : 'added' });
    }
    for (const line of oldLines) {
      if (!newSet.has(line)) {
        result.push({ line, type: 'removed' });
      }
    }
    return result;
  }, [code, prevCode, showDiff]);

  return (
    <div className="space-y-1.5">
      {prevCode && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-medium"
            style={{
              backgroundColor: showDiff ? `${ACCENT_CYAN}15` : 'transparent',
              color: showDiff ? ACCENT_CYAN : 'var(--text-muted)',
              border: `1px solid ${showDiff ? `${ACCENT_CYAN}40` : 'var(--border)'}`,
            }}
          >
            <GitCompare className="w-3 h-3" />
            {showDiff ? 'Hide Diff' : 'Show Diff'}
          </button>
        </div>
      )}

      <div className="max-h-[300px] overflow-auto custom-scrollbar rounded-lg border border-border/40 bg-[#0a0a15]">
        <pre className="text-2xs font-mono leading-relaxed p-2.5">
          {diffLines ? (
            diffLines.map((d, i) => (
              <div
                key={i}
                className="px-1"
                style={{
                  backgroundColor: d.type === 'added' ? `${STATUS_SUCCESS}10` : d.type === 'removed' ? `${STATUS_ERROR}10` : 'transparent',
                  color: d.type === 'added' ? STATUS_SUCCESS : d.type === 'removed' ? STATUS_ERROR : 'var(--text-muted)',
                }}
              >
                <span className="inline-block w-3 text-center opacity-60">{d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ' '}</span>
                {d.line}
              </div>
            ))
          ) : (
            code.split('\n').map((line, i) => (
              <div key={i} className="text-text-muted">{line}</div>
            ))
          )}
        </pre>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   VISUAL WIRING GRAPH — node-based view of GAS data flow
   ══════════════════════════════════════════════════════════════════════════ */

type PinKind = 'attr-out' | 'effect-in' | 'effect-out' | 'tag-in';

interface GraphNode {
  id: string;
  label: string;
  type: 'attribute' | 'effect' | 'tag-rule';
  x: number;
  y: number;
  color: string;
  pins: { id: string; kind: PinKind; label: string; side: 'left' | 'right' }[];
}

interface GraphWire {
  id: string;
  fromNode: string;
  fromPin: string;
  toNode: string;
  toPin: string;
  color: string;
  animated: boolean;
}

const NODE_W_GRAPH = 140;
const NODE_H_GRAPH = 28;
const PIN_R = 3.5;

function WiringGraphEditor({
  attributes, effects, tagRules, relationships, onSelectItem,
}: {
  attributes: EditorAttribute[];
  effects: EditorEffect[];
  tagRules: TagRule[];
  relationships: AttrRelationship[];
  onSelectItem?: (label: string | null) => void;
}) {
  const [hoveredWire, setHoveredWire] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNodeRaw, setSelectedNodeRaw] = useState<string | null>(null);
  const [dragFromPin, setDragFromPin] = useState<{ nodeId: string; pinId: string } | null>(null);

  // ── Drag-to-reposition state ──
  const [nodeOverrides, setNodeOverrides] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const dragMoved = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Alias for existing `selectedNode` references
  const selectedNode = selectedNodeRaw;

  // Build graph nodes and wires from data model
  const { nodes, wires } = useMemo(() => {
    const nodeList: GraphNode[] = [];
    const wireList: GraphWire[] = [];

    // ── Attribute nodes (left column, grouped by category) ──
    const catOrder: AttrCategory[] = ['vital', 'primary', 'combat'];
    const filteredAttrs = attributes.filter(a => catOrder.includes(a.category));
    let attrY = 30;
    let prevCat: string | null = null;

    for (const attr of filteredAttrs) {
      if (attr.category !== prevCat) {
        attrY += prevCat ? 16 : 0;
        prevCat = attr.category;
      }
      nodeList.push({
        id: `attr-${attr.id}`,
        label: attr.name,
        type: 'attribute',
        x: 20,
        y: attrY,
        color: CAT_COLORS[attr.category],
        pins: [
          { id: `${attr.id}-out`, kind: 'attr-out', label: '', side: 'right' },
        ],
      });
      attrY += NODE_H_GRAPH + 6;
    }

    // ── Effect nodes (center column) ──
    let effY = 30;
    for (const eff of effects) {
      const inPins = eff.modifiers.map((m, i) => ({
        id: `${eff.id}-in-${i}`,
        kind: 'effect-in' as PinKind,
        label: m.attribute,
        side: 'left' as const,
      }));
      const outPins = eff.grantedTags.length > 0
        ? [{ id: `${eff.id}-out-tags`, kind: 'effect-out' as PinKind, label: 'tags', side: 'right' as const }]
        : [];

      const nodeH = Math.max(NODE_H_GRAPH, (Math.max(inPins.length, outPins.length) + 1) * 14 + 10);
      nodeList.push({
        id: `eff-${eff.id}`,
        label: eff.name,
        type: 'effect',
        x: 240,
        y: effY,
        color: eff.color,
        pins: [...inPins, ...outPins],
      });
      effY += nodeH + 16;
    }

    // ── Tag rule nodes (right column) ──
    let tagY = 30;
    for (const rule of tagRules) {
      nodeList.push({
        id: `tag-${rule.id}`,
        label: `${rule.sourceTag} ${rule.type} ${rule.targetTag}`,
        type: 'tag-rule',
        x: 460,
        y: tagY,
        color: rule.type === 'blocks' ? STATUS_ERROR : rule.type === 'cancels' ? ACCENT_ORANGE : STATUS_SUCCESS,
        pins: [
          { id: `${rule.id}-in`, kind: 'tag-in', label: '', side: 'left' },
        ],
      });
      tagY += NODE_H_GRAPH + 10;
    }

    // ── Wires: attribute → effect modifiers ──
    for (const eff of effects) {
      const effNode = nodeList.find(n => n.id === `eff-${eff.id}`);
      if (!effNode) continue;
      for (let i = 0; i < eff.modifiers.length; i++) {
        const mod = eff.modifiers[i];
        const sourceAttr = filteredAttrs.find(a => a.name === mod.attribute);
        if (sourceAttr) {
          wireList.push({
            id: `w-attr-eff-${sourceAttr.id}-${eff.id}-${i}`,
            fromNode: `attr-${sourceAttr.id}`,
            fromPin: `${sourceAttr.id}-out`,
            toNode: `eff-${eff.id}`,
            toPin: `${eff.id}-in-${i}`,
            color: eff.color,
            animated: true,
          });
        }
      }
    }

    // ── Wires: effect granted tags → tag rules ──
    for (const eff of effects) {
      if (eff.grantedTags.length === 0) continue;
      for (const grantedTag of eff.grantedTags) {
        for (const rule of tagRules) {
          // Match if source tag matches (basic prefix match)
          const ruleBase = rule.sourceTag.replace('.*', '');
          if (grantedTag.startsWith(ruleBase)) {
            wireList.push({
              id: `w-eff-tag-${eff.id}-${rule.id}`,
              fromNode: `eff-${eff.id}`,
              fromPin: `${eff.id}-out-tags`,
              toNode: `tag-${rule.id}`,
              toPin: `${rule.id}-in`,
              color: rule.type === 'blocks' ? STATUS_ERROR : rule.type === 'cancels' ? ACCENT_ORANGE : STATUS_SUCCESS,
              animated: false,
            });
          }
        }
      }
    }

    // ── Wires: attribute relationships ──
    for (const rel of relationships) {
      const srcNode = nodeList.find(n => n.id === `attr-${rel.sourceId}`);
      const tgtNode = nodeList.find(n => n.id === `attr-${rel.targetId}`);
      if (srcNode && tgtNode) {
        wireList.push({
          id: `w-rel-${rel.id}`,
          fromNode: srcNode.id,
          fromPin: `${rel.sourceId}-out`,
          toNode: tgtNode.id,
          toPin: `${rel.targetId}-out`, // self-referencing within attributes
          color: rel.type === 'scale' ? ACCENT_VIOLET : rel.type === 'clamp' ? STATUS_WARNING : STATUS_SUCCESS,
          animated: rel.type === 'regen',
        });
      }
    }

    return { nodes: nodeList, wires: wireList };
  }, [attributes, effects, tagRules, relationships]);

  const setSelectedNode = useCallback((idOrFn: string | null | ((prev: string | null) => string | null)) => {
    setSelectedNodeRaw(prev => {
      const next = typeof idOrFn === 'function' ? idOrFn(prev) : idOrFn;
      const node = next ? nodes.find(n => n.id === next) : null;
      onSelectItem?.(node ? node.label : null);
      return next;
    });
  }, [nodes, onSelectItem]);

  // Resolve node position (apply override if present)
  const resolvePos = useCallback((node: GraphNode) => {
    const ov = nodeOverrides.get(node.id);
    return ov ? { x: ov.x, y: ov.y } : { x: node.x, y: node.y };
  }, [nodeOverrides]);

  // Compute pin positions (uses overrides)
  const getPinPos = useCallback((node: GraphNode, pinId: string): { x: number; y: number } => {
    const { x: nx, y: ny } = resolvePos(node);
    const pin = node.pins.find(p => p.id === pinId);
    if (!pin) return { x: nx, y: ny };
    const pinIndex = node.pins.filter(p => p.side === pin.side).indexOf(pin);
    const sideCount = node.pins.filter(p => p.side === pin.side).length;
    const nodeH = Math.max(NODE_H_GRAPH, (sideCount + 1) * 14 + 10);
    const pinY = ny + 16 + pinIndex * 14;
    const pinX = pin.side === 'left' ? nx : nx + NODE_W_GRAPH;
    return { x: pinX, y: Math.min(pinY, ny + nodeH - 6) };
  }, [resolvePos]);

  // ── Drag handlers ──
  const getSvgPoint = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: e.clientX, y: e.clientY };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: e.clientX, y: e.clientY };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handleNodeDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const { x: nx, y: ny } = nodeOverrides.get(nodeId) ?? { x: node.x, y: node.y };
    const svgPt = getSvgPoint(e);
    dragStart.current = { mx: svgPt.x, my: svgPt.y, ox: nx, oy: ny };
    dragMoved.current = false;
    setDraggingNodeId(nodeId);
  }, [nodes, nodeOverrides, getSvgPoint]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNodeId || !dragStart.current) return;
    const svgPt = getSvgPoint(e);
    const dx = svgPt.x - dragStart.current.mx;
    const dy = svgPt.y - dragStart.current.my;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved.current = true;
    setNodeOverrides(prev => {
      const next = new Map(prev);
      next.set(draggingNodeId, { x: dragStart.current!.ox + dx, y: dragStart.current!.oy + dy });
      return next;
    });
  }, [draggingNodeId, getSvgPoint]);

  const handleSvgMouseUp = useCallback(() => {
    setDraggingNodeId(null);
    dragStart.current = null;
  }, []);

  // Find connected wires for a node
  const connectedWires = useMemo(() => {
    if (!hoveredNode && !selectedNode) return new Set<string>();
    const target = selectedNode ?? hoveredNode;
    return new Set(wires.filter(w => w.fromNode === target || w.toNode === target).map(w => w.id));
  }, [hoveredNode, selectedNode, wires]);

  // SVG dimensions
  const svgW = 640;
  const maxY = Math.max(...nodes.map(n => {
    const { y } = resolvePos(n);
    const sideCount = Math.max(n.pins.filter(p => p.side === 'left').length, n.pins.filter(p => p.side === 'right').length);
    const nodeH = Math.max(NODE_H_GRAPH, (sideCount + 1) * 14 + 10);
    return y + nodeH + 20;
  }), 300);

  // Wire path (bezier curve)
  const wirePath = useCallback((fromPos: { x: number; y: number }, toPos: { x: number; y: number }) => {
    const cpOffset = Math.min(80, Math.abs(toPos.x - fromPos.x) * 0.4);
    return `M ${fromPos.x} ${fromPos.y} C ${fromPos.x + cpOffset} ${fromPos.y}, ${toPos.x - cpOffset} ${toPos.y}, ${toPos.x} ${toPos.y}`;
  }, []);

  // Detail text for selected node
  const selectedDetail = useMemo(() => {
    if (!selectedNode) return null;
    const node = nodes.find(n => n.id === selectedNode);
    if (!node) return null;
    const inWires = wires.filter(w => w.toNode === selectedNode);
    const outWires = wires.filter(w => w.fromNode === selectedNode);
    return { node, inWires, outWires };
  }, [selectedNode, nodes, wires]);

  return (
    <div className="space-y-2">
      <div className="text-2xs text-text-muted">
        Visual wiring graph of the GAS data pipeline. Drag nodes to reposition. Click to inspect connections.
      </div>

      {/* Column headers */}
      <div className="flex items-center justify-between px-2 text-2xs font-mono uppercase tracking-wider text-text-muted">
        <span style={{ width: NODE_W_GRAPH, color: ACCENT_VIOLET }}>Attributes</span>
        <span style={{ color: STATUS_WARNING }}>Effects</span>
        <span style={{ color: STATUS_ERROR }}>Tag Rules</span>
      </div>

      {/* Graph canvas */}
      <div className="relative overflow-x-auto custom-scrollbar rounded-lg border border-border/30 bg-[#060612]">
        <svg
          ref={svgRef}
          width={svgW} height={maxY} viewBox={`0 0 ${svgW} ${maxY}`}
          className="overflow-visible"
          style={draggingNodeId ? { userSelect: 'none' } : undefined}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
        >
          <defs>
            {/* Animated flow marker */}
            <marker id="gas-flow-arrow" viewBox="0 0 6 4" refX="6" refY="2" markerWidth="5" markerHeight="4" orient="auto">
              <path d="M0,0 L6,2 L0,4" fill="rgba(255,255,255,0.5)" />
            </marker>
          </defs>

          {/* Grid background */}
          <pattern id="gas-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#gas-grid)" />

          {/* Column dividers */}
          <line x1={190} y1={0} x2={190} y2={maxY} stroke="rgba(255,255,255,0.04)" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={420} y1={0} x2={420} y2={maxY} stroke="rgba(255,255,255,0.04)" strokeWidth={1} strokeDasharray="4 4" />

          {/* Wires */}
          {wires.map((wire) => {
            const fromNode = nodes.find(n => n.id === wire.fromNode);
            const toNode = nodes.find(n => n.id === wire.toNode);
            if (!fromNode || !toNode) return null;

            const fromPos = getPinPos(fromNode, wire.fromPin);
            const toPos = getPinPos(toNode, wire.toPin);
            const path = wirePath(fromPos, toPos);
            const isHighlighted = hoveredWire === wire.id || connectedWires.has(wire.id);
            const opacity = (hoveredNode || selectedNode) ? (isHighlighted ? 0.9 : 0.12) : 0.5;

            return (
              <g key={wire.id}>
                {/* Invisible hover target */}
                <path
                  d={path} fill="none" stroke="transparent" strokeWidth={10}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredWire(wire.id)}
                  onMouseLeave={() => setHoveredWire(null)}
                />
                {/* Glow */}
                {isHighlighted && (
                  <path
                    d={path} fill="none" stroke={wire.color} strokeWidth={4}
                    opacity={0.25} style={{ filter: 'blur(3px)' }}
                    className="pointer-events-none"
                  />
                )}
                {/* Wire */}
                <path
                  d={path} fill="none"
                  stroke={wire.color}
                  strokeWidth={isHighlighted ? 2 : 1.2}
                  opacity={opacity}
                  strokeDasharray={wire.animated ? '6 4' : undefined}
                  markerEnd="url(#gas-flow-arrow)"
                  className="pointer-events-none transition-opacity duration-200"
                >
                  {wire.animated && (
                    <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.8s" repeatCount="indefinite" />
                  )}
                </path>
                {/* Flow pulse dot */}
                <circle r={isHighlighted ? 3 : 2} fill={wire.color} opacity={isHighlighted ? 0.9 : 0.5} className="pointer-events-none">
                  <animateMotion
                    dur={wire.animated ? '1.5s' : '3s'}
                    repeatCount="indefinite"
                    path={path}
                  />
                </circle>
              </g>
            );
          })}

          {/* Drag-in-progress wire */}
          {dragFromPin && (
            <line
              x1={0} y1={0} x2={0} y2={0}
              stroke={ACCENT_CYAN} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6}
              className="pointer-events-none"
            />
          )}

          {/* Nodes */}
          {nodes.map((node) => {
            const { x: nx, y: ny } = resolvePos(node);
            const isDragging = draggingNodeId === node.id;
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode === node.id;
            const hasConnections = wires.some(w => w.fromNode === node.id || w.toNode === node.id);
            const sideCount = (side: 'left' | 'right') => node.pins.filter(p => p.side === side).length;
            const nodeH = Math.max(NODE_H_GRAPH, (Math.max(sideCount('left'), sideCount('right')) + 1) * 14 + 10);
            const dimmed = (hoveredNode || selectedNode) && !isHovered && !isSelected && !connectedWires.has(
              wires.find(w => w.fromNode === node.id || w.toNode === node.id)?.id ?? ''
            );

            // Check if any wire connects to this node
            const nodeIsConnected = wires.some(w =>
              (w.fromNode === node.id || w.toNode === node.id) && connectedWires.has(w.id)
            );

            const effectiveOpacity = dimmed && !nodeIsConnected ? 0.25 : 1;

            return (
              <g
                key={node.id}
                className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
                onMouseEnter={() => { if (!draggingNodeId) setHoveredNode(node.id); }}
                onMouseLeave={() => { if (!draggingNodeId) setHoveredNode(null); }}
                onClick={() => { if (!dragMoved.current) setSelectedNode(prev => prev === node.id ? null : node.id); }}
                onMouseDown={(e) => {
                  // Only start drag from node body, not pins (pins use crosshair cursor)
                  const target = e.target as SVGElement;
                  if (target.tagName === 'circle') return;
                  handleNodeDragStart(e, node.id);
                }}
                opacity={effectiveOpacity}
                style={{ transition: isDragging ? 'none' : 'opacity 0.2s' }}
              >
                {/* Node body */}
                <rect
                  x={nx} y={ny}
                  width={NODE_W_GRAPH} height={nodeH}
                  rx={6}
                  fill={isDragging ? `${node.color}28` : isSelected ? `${node.color}20` : isHovered ? `${node.color}12` : `${node.color}08`}
                  stroke={isDragging ? node.color : isSelected ? node.color : isHovered ? `${node.color}80` : `${node.color}40`}
                  strokeWidth={isDragging ? 2 : isSelected ? 1.5 : 1}
                />

                {/* Type indicator strip */}
                <rect
                  x={nx} y={ny}
                  width={4} height={nodeH}
                  rx={2}
                  fill={node.color}
                  opacity={isSelected || isDragging ? 0.8 : 0.5}
                />

                {/* Node label */}
                <text
                  x={nx + 12} y={ny + 12}
                  fill={isSelected || isHovered || isDragging ? node.color : 'rgba(255,255,255,0.8)'}
                  fontSize={node.type === 'tag-rule' ? 7 : 8.5}
                  fontFamily="monospace"
                  fontWeight="bold"
                  className="pointer-events-none"
                >
                  {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
                </text>

                {/* Type badge */}
                <text
                  x={nx + NODE_W_GRAPH - 4} y={ny + 11}
                  fill={node.color} fontSize={6} fontFamily="monospace"
                  textAnchor="end" opacity={0.5}
                  className="pointer-events-none"
                >
                  {node.type === 'attribute' ? 'ATTR' : node.type === 'effect' ? 'GE' : 'TAG'}
                </text>

                {/* Pins */}
                {node.pins.map((pin) => {
                  const pos = getPinPos(node, pin.id);
                  const isConnected = hasConnections && wires.some(
                    w => (w.fromNode === node.id && w.fromPin === pin.id) || (w.toNode === node.id && w.toPin === pin.id)
                  );
                  const wireColor = wires.find(
                    w => (w.fromNode === node.id && w.fromPin === pin.id) || (w.toNode === node.id && w.toPin === pin.id)
                  )?.color ?? node.color;

                  return (
                    <g key={pin.id}>
                      {/* Pin circle */}
                      <circle
                        cx={pos.x} cy={pos.y} r={PIN_R}
                        fill={isConnected ? wireColor : 'rgba(255,255,255,0.1)'}
                        stroke={isConnected ? wireColor : 'rgba(255,255,255,0.3)'}
                        strokeWidth={1}
                        className="pointer-events-auto"
                        style={{ cursor: 'crosshair' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDragFromPin({ nodeId: node.id, pinId: pin.id });
                        }}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          setDragFromPin(null);
                        }}
                      />
                      {/* Pin label */}
                      {pin.label && (
                        <text
                          x={pin.side === 'left' ? pos.x + 6 : pos.x - 6}
                          y={pos.y + 3}
                          fill="rgba(255,255,255,0.4)" fontSize={6} fontFamily="monospace"
                          textAnchor={pin.side === 'left' ? 'start' : 'end'}
                          className="pointer-events-none"
                        >
                          {pin.label.length > 12 ? pin.label.slice(0, 11) + '…' : pin.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Selection glow */}
                {(isSelected || isDragging) && (
                  <rect
                    x={nx - 2} y={ny - 2}
                    width={NODE_W_GRAPH + 4} height={nodeH + 4}
                    rx={8} fill="none" stroke={node.color} strokeWidth={1}
                    opacity={0.3} style={{ filter: 'blur(3px)' }}
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-2xs font-mono text-text-muted px-1">
        <span className="flex items-center gap-1">
          <Circle className="w-2.5 h-2.5" style={{ color: ACCENT_VIOLET }} />
          {nodes.filter(n => n.type === 'attribute').length} attributes
        </span>
        <span className="flex items-center gap-1">
          <Zap className="w-2.5 h-2.5" style={{ color: STATUS_WARNING }} />
          {nodes.filter(n => n.type === 'effect').length} effects
        </span>
        <span className="flex items-center gap-1">
          <Tag className="w-2.5 h-2.5" style={{ color: STATUS_ERROR }} />
          {nodes.filter(n => n.type === 'tag-rule').length} rules
        </span>
        <span className="flex items-center gap-1">
          <Cable className="w-2.5 h-2.5" style={{ color: ACCENT_EMERALD }} />
          {wires.length} wires
        </span>
        {nodeOverrides.size > 0 && (
          <button
            onClick={() => setNodeOverrides(new Map())}
            className="ml-auto text-2xs font-mono px-1.5 py-0.5 rounded border border-border/40 text-text-muted hover:text-text hover:border-border/60 transition-colors"
          >
            Reset Layout
          </button>
        )}
      </div>

      {/* Selected node detail panel */}
      <AnimatePresence>
        {selectedDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="p-2.5 rounded-lg border space-y-1.5"
              style={{
                borderColor: `${selectedDetail.node.color}30`,
                backgroundColor: `${selectedDetail.node.color}06`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedDetail.node.color }} />
                <span className="text-xs font-mono font-bold" style={{ color: selectedDetail.node.color }}>
                  {selectedDetail.node.label}
                </span>
                <span className="text-2xs font-mono uppercase tracking-wider text-text-muted">
                  {selectedDetail.node.type}
                </span>
              </div>

              {selectedDetail.inWires.length > 0 && (
                <div className="text-2xs text-text-muted">
                  <span className="font-bold">Inputs:</span>{' '}
                  {selectedDetail.inWires.map(w => {
                    const srcNode = nodes.find(n => n.id === w.fromNode);
                    return srcNode?.label;
                  }).filter(Boolean).join(', ')}
                </div>
              )}

              {selectedDetail.outWires.length > 0 && (
                <div className="text-2xs text-text-muted">
                  <span className="font-bold">Outputs:</span>{' '}
                  {selectedDetail.outWires.map(w => {
                    const tgtNode = nodes.find(n => n.id === w.toNode);
                    return tgtNode?.label;
                  }).filter(Boolean).join(', ')}
                </div>
              )}

              {selectedDetail.inWires.length === 0 && selectedDetail.outWires.length === 0 && (
                <div className="text-2xs text-text-muted italic">No connections — this node is isolated</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN EDITOR COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */

type EditorPanel = 'wiring' | 'relationships' | 'effects' | 'tags' | 'loadout' | 'codegen';

/** Breadcrumb path per panel — maps to UE5 class hierarchy */
const PANEL_BREADCRUMBS: Record<EditorPanel, string[]> = {
  wiring: ['AARPGCharacterBase', 'UAbilitySystemComponent', 'Data Pipeline'],
  relationships: ['AARPGCharacterBase', 'UARPGAttributeSet', 'Dependencies'],
  effects: ['AARPGCharacterBase', 'UAbilitySystemComponent', 'UGameplayEffect'],
  tags: ['AARPGCharacterBase', 'FGameplayTagContainer', 'Rules'],
  loadout: ['AARPGCharacterBase', 'UAbilitySystemComponent', 'Loadout Slots'],
  codegen: ['AARPGCharacterBase', 'Generated C++'],
};

export function GASBlueprintEditor() {
  // Editor state
  const [attributes] = useState<EditorAttribute[]>(SEED_ATTRIBUTES);
  const [relationships, setRelationships] = useState<AttrRelationship[]>(SEED_RELATIONSHIPS);
  const [effects, setEffects] = useState<EditorEffect[]>(SEED_EFFECTS);
  const [tagRules, setTagRules] = useState<TagRule[]>(SEED_TAG_RULES);
  const [loadout, setLoadout] = useState<LoadoutSlot[]>(SEED_LOADOUT);

  // Track previous code for diff
  const [prevCode, setPrevCode] = useState<Record<string, string | null>>({
    attrs: null, tags: null, effects: null,
  });

  const [activePanel, setActivePanelRaw] = useState<EditorPanel>('wiring');
  const [codeTab, setCodeTab] = useState<'attrs' | 'tags' | 'effects'>('attrs');
  const [breadcrumbDetail, setBreadcrumbDetail] = useState<string | null>(null);

  // Clear breadcrumb detail when switching panels
  const setActivePanel = useCallback((panel: EditorPanel) => {
    setActivePanelRaw(panel);
    setBreadcrumbDetail(null);
  }, []);

  const breadcrumbs = useMemo(() => {
    const crumbs = [...PANEL_BREADCRUMBS[activePanel]];
    if (breadcrumbDetail) crumbs.push(breadcrumbDetail);
    return crumbs;
  }, [activePanel, breadcrumbDetail]);

  // Generate code
  const generatedCode = useMemo(() => ({
    attrs: generateAttributeSetHeader(attributes),
    tags: generateTagsHeader(tagRules, loadout),
    effects: generateEffectsCode(effects),
  }), [attributes, tagRules, loadout, effects]);

  // Snapshot code for diff before changes
  const snapshotCode = useCallback(() => {
    setPrevCode({ ...generatedCode });
  }, [generatedCode]);

  // Stats
  const stats = useMemo(() => ({
    attrs: attributes.length,
    rels: relationships.length,
    effects: effects.length,
    rules: tagRules.length,
    slots: loadout.length,
  }), [attributes, relationships, effects, tagRules, loadout]);

  const panels: { id: EditorPanel; label: string; icon: typeof Swords }[] = [
    { id: 'wiring', label: 'Wiring', icon: Cable },
    { id: 'relationships', label: 'Attributes', icon: Swords },
    { id: 'effects', label: 'Effects', icon: Zap },
    { id: 'tags', label: 'Tag Rules', icon: Tag },
    { id: 'loadout', label: 'Loadout', icon: Shield },
    { id: 'codegen', label: 'Code Gen', icon: Code },
  ];

  return (
    <div className="space-y-2.5">
      {/* Editor header */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-text flex items-center gap-2">
              <Code className="w-4 h-4" style={{ color: ACCENT }} />
              GAS Blueprint Editor
              <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${ACCENT_CYAN}15`, color: ACCENT_CYAN, border: `1px solid ${ACCENT_CYAN}30` }}>
                INTERACTIVE
              </span>
            </div>
            <div className="text-2xs text-text-muted mt-0.5">
              Visual editor for Gameplay Ability System — exports C++ code
            </div>
          </div>
          <div className="flex items-center gap-3 text-2xs font-mono text-text-muted">
            <span><span className="font-bold text-text">{stats.attrs}</span> attrs</span>
            <span><span className="font-bold text-text">{stats.rels}</span> rels</span>
            <span><span className="font-bold text-text">{stats.effects}</span> effects</span>
            <span><span className="font-bold text-text">{stats.rules}</span> rules</span>
          </div>
        </div>
      </SurfaceCard>

      {/* Blueprint path breadcrumbs */}
      <div className="flex items-center gap-0.5 px-1 py-1 overflow-x-auto custom-scrollbar">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          const isDetail = i === breadcrumbs.length - 1 && breadcrumbDetail && crumb === breadcrumbDetail;
          return (
            <span key={`${crumb}-${i}`} className="flex items-center gap-0.5 whitespace-nowrap">
              {i > 0 && <ChevronRight className="w-3 h-3 text-text-muted/40 flex-shrink-0" />}
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors"
                style={{
                  color: isLast ? ACCENT : 'var(--text-muted)',
                  fontWeight: isLast ? 700 : 400,
                  backgroundColor: isDetail ? `${ACCENT}10` : 'transparent',
                  border: isDetail ? `1px solid ${ACCENT}25` : '1px solid transparent',
                }}
              >
                {crumb}
              </span>
            </span>
          );
        })}
      </div>

      {/* Panel navigation */}
      <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-0.5">
        {panels.map((panel) => {
          const isActive = activePanel === panel.id;
          const Icon = panel.icon;
          return (
            <button
              key={panel.id}
              onClick={() => { if (panel.id === 'codegen') snapshotCode(); setActivePanel(panel.id); }}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
              style={{
                backgroundColor: isActive ? `${ACCENT}15` : 'transparent',
                color: isActive ? ACCENT : 'var(--text-muted)',
                border: `1px solid ${isActive ? `${ACCENT}40` : 'transparent'}`,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {panel.label}
            </button>
          );
        })}
      </div>

      {/* Panel content */}
      <AnimatePresence mode="sync">
        {activePanel === 'wiring' && (
          <motion.div key="wiring" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <SurfaceCard level={2} className="p-3 relative overflow-hidden">
              <SectionLabel icon={Cable} label="Visual Wiring Graph" color={ACCENT_EMERALD} />
              <p className="text-2xs text-text-muted mt-1 mb-2">
                Node-based view of the GAS data pipeline — attributes feed into effects, which grant tags that trigger blocking/cancellation rules. Click nodes to trace connections.
              </p>
              <WiringGraphEditor
                attributes={attributes}
                effects={effects}
                tagRules={tagRules}
                relationships={relationships}
                onSelectItem={setBreadcrumbDetail}
              />
            </SurfaceCard>
          </motion.div>
        )}

        {activePanel === 'relationships' && (
          <motion.div key="relationships" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <SurfaceCard level={2} className="p-3 relative overflow-hidden">
              <SectionLabel icon={Swords} label="Attribute Relationship Web" color={ACCENT_VIOLET} />
              <p className="text-2xs text-text-muted mt-1 mb-2">
                Drag from one attribute node to another to create scaling/clamping dependencies. Click an edge line to remove it.
              </p>
              <RelationshipWebEditor attributes={attributes} relationships={relationships} onChange={setRelationships} />
            </SurfaceCard>
          </motion.div>
        )}

        {activePanel === 'effects' && (
          <motion.div key="effects" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <SurfaceCard level={2} className="p-3 relative overflow-hidden">
              <SectionLabel icon={Zap} label="Effect Lifecycle Timeline" color={STATUS_ERROR} />
              <p className="text-2xs text-text-muted mt-1 mb-2">
                Place GameplayEffect blocks on a timeline. Click to select and edit duration, modifiers, and granted tags.
              </p>
              <EffectTimelineEditor effects={effects} onChange={setEffects} onSelectItem={setBreadcrumbDetail} />
            </SurfaceCard>
          </motion.div>
        )}

        {activePanel === 'tags' && (
          <motion.div key="tags" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <SurfaceCard level={2} className="p-3 relative overflow-hidden">
              <SectionLabel icon={Tag} label="Tag Dependency Rules" color={STATUS_WARNING} />
              <p className="text-2xs text-text-muted mt-1 mb-2">
                Define blocking, cancellation, and requirement rules between gameplay tags. Supports wildcard patterns (e.g. Ability.*).
              </p>
              <TagRulesEditor rules={tagRules} onChange={setTagRules} effects={effects} loadout={loadout} />
            </SurfaceCard>
          </motion.div>
        )}

        {activePanel === 'loadout' && (
          <motion.div key="loadout" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <SurfaceCard level={2} className="p-3 relative overflow-hidden">
              <SectionLabel icon={Shield} label="Loadout Hotbar" color={ACCENT_VIOLET} />
              <p className="text-2xs text-text-muted mt-1 mb-2">
                Configure ability loadout slots with names and cooldown tags. Add/remove slots to match your hotbar design.
              </p>
              <LoadoutEditor loadout={loadout} onChange={setLoadout} />
            </SurfaceCard>
          </motion.div>
        )}

        {activePanel === 'codegen' && (
          <motion.div key="codegen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="space-y-2.5">
            <SurfaceCard level={2} className="p-3 relative overflow-hidden">
              <SectionLabel icon={Code} label="Generated C++ Code" color={ACCENT_CYAN} />
              <p className="text-2xs text-text-muted mt-1 mb-2">
                Auto-generated C++ from your visual design. Toggle diff mode to see what changed since last visit.
              </p>

              <div className="flex gap-1 mb-2">
                {([
                  { id: 'attrs' as const, label: 'AttributeSet.h', count: stats.attrs },
                  { id: 'tags' as const, label: 'GameplayTags.h', count: stats.rules },
                  { id: 'effects' as const, label: 'Effects.cpp', count: stats.effects },
                ]).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setCodeTab(tab.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-mono transition-all"
                    style={{
                      backgroundColor: codeTab === tab.id ? `${ACCENT_CYAN}15` : 'transparent',
                      color: codeTab === tab.id ? ACCENT_CYAN : 'var(--text-muted)',
                      border: `1px solid ${codeTab === tab.id ? `${ACCENT_CYAN}30` : 'transparent'}`,
                    }}
                  >
                    {tab.label}
                    <span className="opacity-60">({tab.count})</span>
                  </button>
                ))}
              </div>

              <CodePreview code={generatedCode[codeTab]} prevCode={prevCode[codeTab]} />
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

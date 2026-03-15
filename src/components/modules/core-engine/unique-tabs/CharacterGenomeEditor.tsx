'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Dna, Download, Upload, Copy, Plus, Trash2, ChevronRight, GitCompareArrows, AlertTriangle,
  Zap, Swords, Shield, Camera, Activity, Code2, Share2, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, ACCENT_PINK, STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, RadarChart, STAGGER_DEFAULT } from './_shared';
import type {
  CharacterGenome, MovementProfile, CombatProfile,
  DodgeProfile, CameraProfile, AttributeScaling,
} from '@/types/character-genome';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';

const ACCENT = MODULE_COLORS.core;

/* ── Default genome presets ──────────────────────────────────────────────── */

function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_MOVEMENT: MovementProfile = {
  maxWalkSpeed: 400, maxSprintSpeed: 780, acceleration: 2048, deceleration: 2048,
  turnRate: 540, airControl: 0.35, jumpZVelocity: 520, gravityScale: 1.0,
};

const DEFAULT_COMBAT: CombatProfile = {
  baseDamage: 25, attackSpeed: 1.2, comboWindowMs: 400, hitReactionDuration: 0.3,
  critChance: 0.15, critMultiplier: 2.0, attackRange: 200, cleaveAngle: 120,
};

const DEFAULT_DODGE: DodgeProfile = {
  distance: 500, duration: 0.5, iFrameStart: 0.05, iFrameDuration: 0.3,
  cooldown: 0.8, staminaCost: 25, cancelWindowStart: 0.35, cancelWindowEnd: 0.5,
};

const DEFAULT_CAMERA: CameraProfile = {
  armLength: 800, lagSpeed: 10, fovBase: 90, fovSprintOffset: 5,
  swayMaxRoll: 1.5, swayMaxPitch: 0.8, swayInterpSpeed: 4.0, socketOffsetZ: 60,
};

const DEFAULT_ATTRIBUTES: AttributeScaling = {
  baseHP: 1000, hpPerLevel: 50, baseStamina: 100, staminaPerLevel: 5,
  baseMana: 0, manaPerLevel: 0, baseArmor: 50, armorPerLevel: 3,
  staminaRegenPerSec: 15, manaRegenPerSec: 0,
};

function createGenome(name: string, color: string, overrides?: Partial<CharacterGenome>): CharacterGenome {
  return {
    id: createId(),
    name,
    description: '',
    author: 'User',
    version: '1.0.0',
    color,
    updatedAt: new Date().toISOString(),
    movement: { ...DEFAULT_MOVEMENT },
    combat: { ...DEFAULT_COMBAT },
    dodge: { ...DEFAULT_DODGE },
    camera: { ...DEFAULT_CAMERA },
    attributes: { ...DEFAULT_ATTRIBUTES },
    tags: [],
    ...overrides,
  };
}

const PRESET_GENOMES: CharacterGenome[] = [
  createGenome('Warrior', ACCENT_ORANGE, {
    description: 'Heavy melee bruiser — high HP, slow but devastating',
    movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 350, maxSprintSpeed: 650, acceleration: 1600 },
    combat: { ...DEFAULT_COMBAT, baseDamage: 40, attackSpeed: 0.8, attackRange: 250, cleaveAngle: 150, critChance: 0.1 },
    dodge: { ...DEFAULT_DODGE, distance: 350, staminaCost: 30 },
    attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 1500, hpPerLevel: 80, baseArmor: 80, armorPerLevel: 5 },
    tags: ['melee', 'tank', 'slow'],
  }),
  createGenome('Rogue', ACCENT_EMERALD, {
    description: 'Fast and agile — crit-focused glass cannon',
    movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 480, maxSprintSpeed: 900, acceleration: 2800, turnRate: 720 },
    combat: { ...DEFAULT_COMBAT, baseDamage: 18, attackSpeed: 1.8, comboWindowMs: 300, critChance: 0.35, critMultiplier: 2.5, attackRange: 150 },
    dodge: { ...DEFAULT_DODGE, distance: 600, duration: 0.4, cooldown: 0.5, staminaCost: 20 },
    attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 600, hpPerLevel: 30, baseStamina: 130, staminaPerLevel: 8, baseArmor: 20, armorPerLevel: 1 },
    tags: ['melee', 'agile', 'crit'],
  }),
  createGenome('Mage', ACCENT_VIOLET, {
    description: 'Ranged spellcaster — high mana, low defense',
    movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 380, maxSprintSpeed: 700, acceleration: 1800 },
    combat: { ...DEFAULT_COMBAT, baseDamage: 35, attackSpeed: 0.6, attackRange: 1000, cleaveAngle: 60, comboWindowMs: 600 },
    dodge: { ...DEFAULT_DODGE, distance: 450, staminaCost: 20 },
    camera: { ...DEFAULT_CAMERA, armLength: 1000, fovBase: 95 },
    attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 500, hpPerLevel: 25, baseMana: 200, manaPerLevel: 15, baseArmor: 15, armorPerLevel: 1, manaRegenPerSec: 8 },
    tags: ['ranged', 'caster', 'glass-cannon'],
  }),
  createGenome('Paladin', ACCENT_CYAN, {
    description: 'Balanced holy warrior — medium speed, self-healing',
    movement: { ...DEFAULT_MOVEMENT, maxWalkSpeed: 400, maxSprintSpeed: 740 },
    combat: { ...DEFAULT_COMBAT, baseDamage: 30, attackSpeed: 1.0, attackRange: 220, critChance: 0.12 },
    dodge: { ...DEFAULT_DODGE, distance: 400, staminaCost: 25 },
    attributes: { ...DEFAULT_ATTRIBUTES, baseHP: 1200, hpPerLevel: 60, baseMana: 80, manaPerLevel: 8, baseArmor: 65, armorPerLevel: 4, manaRegenPerSec: 4 },
    tags: ['melee', 'hybrid', 'sustain'],
  }),
];

/* ── Profile field definitions ───────────────────────────────────────────── */

interface FieldDef {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const MOVEMENT_FIELDS: FieldDef[] = [
  { key: 'maxWalkSpeed', label: 'Walk Speed', unit: 'cm/s', min: 100, max: 1200, step: 10 },
  { key: 'maxSprintSpeed', label: 'Sprint Speed', unit: 'cm/s', min: 200, max: 1500, step: 10 },
  { key: 'acceleration', label: 'Acceleration', unit: 'cm/s²', min: 500, max: 5000, step: 50 },
  { key: 'deceleration', label: 'Deceleration', unit: 'cm/s²', min: 500, max: 5000, step: 50 },
  { key: 'turnRate', label: 'Turn Rate', unit: 'deg/s', min: 90, max: 1080, step: 10 },
  { key: 'airControl', label: 'Air Control', unit: '', min: 0, max: 1, step: 0.05 },
  { key: 'jumpZVelocity', label: 'Jump Velocity', unit: 'cm/s', min: 100, max: 1200, step: 10 },
  { key: 'gravityScale', label: 'Gravity Scale', unit: 'x', min: 0.1, max: 4.0, step: 0.1 },
];

const COMBAT_FIELDS: FieldDef[] = [
  { key: 'baseDamage', label: 'Base Damage', unit: '', min: 1, max: 200, step: 1 },
  { key: 'attackSpeed', label: 'Attack Speed', unit: '/s', min: 0.1, max: 4.0, step: 0.1 },
  { key: 'comboWindowMs', label: 'Combo Window', unit: 'ms', min: 100, max: 1000, step: 25 },
  { key: 'hitReactionDuration', label: 'Hit Stun', unit: 's', min: 0, max: 2, step: 0.05 },
  { key: 'critChance', label: 'Crit Chance', unit: '%', min: 0, max: 1, step: 0.01 },
  { key: 'critMultiplier', label: 'Crit Multi', unit: 'x', min: 1, max: 5, step: 0.1 },
  { key: 'attackRange', label: 'Attack Range', unit: 'cm', min: 50, max: 1500, step: 10 },
  { key: 'cleaveAngle', label: 'Cleave Angle', unit: '°', min: 0, max: 360, step: 5 },
];

const DODGE_FIELDS: FieldDef[] = [
  { key: 'distance', label: 'Distance', unit: 'cm', min: 100, max: 1200, step: 10 },
  { key: 'duration', label: 'Duration', unit: 's', min: 0.1, max: 1.5, step: 0.05 },
  { key: 'iFrameStart', label: 'I-Frame Start', unit: 's', min: 0, max: 0.5, step: 0.01 },
  { key: 'iFrameDuration', label: 'I-Frame Dur.', unit: 's', min: 0, max: 1.0, step: 0.01 },
  { key: 'cooldown', label: 'Cooldown', unit: 's', min: 0, max: 3, step: 0.05 },
  { key: 'staminaCost', label: 'Stamina Cost', unit: '', min: 0, max: 100, step: 1 },
  { key: 'cancelWindowStart', label: 'Cancel Start', unit: 's', min: 0, max: 1, step: 0.01 },
  { key: 'cancelWindowEnd', label: 'Cancel End', unit: 's', min: 0, max: 1.5, step: 0.01 },
];

const CAMERA_FIELDS: FieldDef[] = [
  { key: 'armLength', label: 'Arm Length', unit: 'cm', min: 100, max: 2000, step: 10 },
  { key: 'lagSpeed', label: 'Lag Speed', unit: '', min: 0, max: 30, step: 0.5 },
  { key: 'fovBase', label: 'FOV', unit: '°', min: 60, max: 120, step: 1 },
  { key: 'fovSprintOffset', label: 'Sprint FOV+', unit: '°', min: 0, max: 20, step: 1 },
  { key: 'swayMaxRoll', label: 'Sway Roll', unit: '°', min: 0, max: 5, step: 0.1 },
  { key: 'swayMaxPitch', label: 'Sway Pitch', unit: '°', min: 0, max: 5, step: 0.1 },
  { key: 'swayInterpSpeed', label: 'Sway Speed', unit: '', min: 0, max: 15, step: 0.5 },
  { key: 'socketOffsetZ', label: 'Socket Z', unit: 'cm', min: -100, max: 200, step: 5 },
];

const ATTRIBUTE_FIELDS: FieldDef[] = [
  { key: 'baseHP', label: 'Base HP', unit: '', min: 100, max: 5000, step: 50 },
  { key: 'hpPerLevel', label: 'HP / Level', unit: '', min: 0, max: 200, step: 5 },
  { key: 'baseStamina', label: 'Base Stamina', unit: '', min: 10, max: 500, step: 5 },
  { key: 'staminaPerLevel', label: 'Stam / Level', unit: '', min: 0, max: 50, step: 1 },
  { key: 'baseMana', label: 'Base Mana', unit: '', min: 0, max: 500, step: 5 },
  { key: 'manaPerLevel', label: 'Mana / Level', unit: '', min: 0, max: 50, step: 1 },
  { key: 'baseArmor', label: 'Base Armor', unit: '', min: 0, max: 200, step: 1 },
  { key: 'armorPerLevel', label: 'Armor / Level', unit: '', min: 0, max: 20, step: 1 },
  { key: 'staminaRegenPerSec', label: 'Stam Regen', unit: '/s', min: 0, max: 50, step: 1 },
  { key: 'manaRegenPerSec', label: 'Mana Regen', unit: '/s', min: 0, max: 30, step: 1 },
];

/* ── Radar axes for overview comparison ──────────────────────────────────── */

interface CompactRadarAxis {
  label: string;
  getValue: (g: CharacterGenome) => number;
  max: number;
}

const OVERVIEW_AXES: CompactRadarAxis[] = [
  { label: 'Speed', getValue: (g) => g.movement.maxSprintSpeed, max: 1500 },
  { label: 'DPS', getValue: (g) => g.combat.baseDamage * g.combat.attackSpeed, max: 200 },
  { label: 'Range', getValue: (g) => g.combat.attackRange, max: 1500 },
  { label: 'Tankiness', getValue: (g) => g.attributes.baseHP + g.attributes.baseArmor * 5, max: 2500 },
  { label: 'Agility', getValue: (g) => g.dodge.distance / g.dodge.cooldown, max: 1200 },
  { label: 'Crit', getValue: (g) => g.combat.critChance * g.combat.critMultiplier * 100, max: 200 },
];

function genomeToRadar(genome: CharacterGenome): RadarDataPoint[] {
  return OVERVIEW_AXES.map((axis) => ({
    axis: axis.label,
    value: Math.min(axis.getValue(genome) / axis.max, 1),
  }));
}

/* ── UE5 Code Generation ─────────────────────────────────────────────────── */

function generateSubclassHeader(g: CharacterGenome): string {
  const className = `AARPG${g.name.replace(/\s+/g, '')}Character`;
  return `// Auto-generated by PoF Character Genome System
// Genome: ${g.name} v${g.version} — ${g.description}
// Author: ${g.author} | ${g.updatedAt}

#pragma once

#include "CoreMinimal.h"
#include "Character/ARPGCharacterBase.h"
#include "${className}.generated.h"

UCLASS()
class POF_API ${className} : public AARPGCharacterBase
{
\tGENERATED_BODY()

public:
\t${className}();

protected:
\tvirtual void BeginPlay() override;
\tvirtual void InitializeAttributes() override;
};`;
}

function generateSubclassCpp(g: CharacterGenome): string {
  const className = `AARPG${g.name.replace(/\s+/g, '')}Character`;
  return `// Auto-generated by PoF Character Genome System
#include "${className}.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"

${className}::${className}()
{
\t// ── Movement Profile ──
\tGetCharacterMovement()->MaxWalkSpeed = ${g.movement.maxWalkSpeed}.f;
\tMaxSprintSpeed = ${g.movement.maxSprintSpeed}.f;
\tGetCharacterMovement()->MaxAcceleration = ${g.movement.acceleration}.f;
\tGetCharacterMovement()->BrakingDecelerationWalking = ${g.movement.deceleration}.f;
\tGetCharacterMovement()->RotationRate = FRotator(0.f, ${g.movement.turnRate}.f, 0.f);
\tGetCharacterMovement()->AirControl = ${g.movement.airControl}f;
\tGetCharacterMovement()->JumpZVelocity = ${g.movement.jumpZVelocity}.f;
\tGetCharacterMovement()->GravityScale = ${g.movement.gravityScale}f;

\t// ── Combat Profile ──
\tBaseDamage = ${g.combat.baseDamage}.f;
\tAttackSpeed = ${g.combat.attackSpeed}f;
\tComboWindowMs = ${g.combat.comboWindowMs}.f;
\tHitReactionDuration = ${g.combat.hitReactionDuration}f;
\tCritChance = ${g.combat.critChance}f;
\tCritMultiplier = ${g.combat.critMultiplier}f;
\tAttackRange = ${g.combat.attackRange}.f;
\tCleaveAngle = ${g.combat.cleaveAngle}.f;

\t// ── Dodge Profile ──
\tDodgeDistance = ${g.dodge.distance}.f;
\tDodgeDuration = ${g.dodge.duration}f;
\tIFrameStart = ${g.dodge.iFrameStart}f;
\tIFrameDuration = ${g.dodge.iFrameDuration}f;
\tDodgeCooldown = ${g.dodge.cooldown}f;
\tDodgeStaminaCost = ${g.dodge.staminaCost}.f;

\t// ── Camera Profile ──
\tif (CameraBoom)
\t{
\t\tCameraBoom->TargetArmLength = ${g.camera.armLength}.f;
\t\tCameraBoom->CameraLagSpeed = ${g.camera.lagSpeed}f;
\t\tCameraBoom->SocketOffset = FVector(0.f, 0.f, ${g.camera.socketOffsetZ}.f);
\t}
\tBaseFOV = ${g.camera.fovBase}.f;
\tSprintFOVOffset = ${g.camera.fovSprintOffset}.f;
}

void ${className}::BeginPlay()
{
\tSuper::BeginPlay();
}

void ${className}::InitializeAttributes()
{
\tSuper::InitializeAttributes();
\t// Attribute init values set via DataTable — see generated AttributeInitTable
}`;
}

function generateAttributeInitTable(g: CharacterGenome): string {
  const rows = [
    `${g.name}.HP,${g.attributes.baseHP},${g.attributes.hpPerLevel}`,
    `${g.name}.Stamina,${g.attributes.baseStamina},${g.attributes.staminaPerLevel}`,
    `${g.name}.Mana,${g.attributes.baseMana},${g.attributes.manaPerLevel}`,
    `${g.name}.Armor,${g.attributes.baseArmor},${g.attributes.armorPerLevel}`,
    `${g.name}.StaminaRegen,${g.attributes.staminaRegenPerSec},0`,
    `${g.name}.ManaRegen,${g.attributes.manaRegenPerSec},0`,
  ];
  return `RowName,BaseValue,ScalingPerLevel\n${rows.join('\n')}`;
}

/* ── Balance Constraint Validation ────────────────────────────────────────── */

type WarningSeverity = 'warning' | 'error';

interface FieldWarning {
  /** profile.field key, e.g. 'dodge.iFrameDuration' */
  fieldKey: string;
  severity: WarningSeverity;
  message: string;
}

function validateGenome(g: CharacterGenome): FieldWarning[] {
  const warnings: FieldWarning[] = [];

  // Dodge constraints
  if (g.dodge.iFrameDuration > g.dodge.duration) {
    warnings.push({ fieldKey: 'dodge.iFrameDuration', severity: 'error', message: 'I-frame longer than dodge duration — permanently invulnerable during dodge' });
  }
  if (g.dodge.iFrameStart + g.dodge.iFrameDuration > g.dodge.duration) {
    warnings.push({ fieldKey: 'dodge.iFrameStart', severity: 'warning', message: 'I-frame window extends past dodge end' });
  }
  if (g.dodge.cancelWindowStart > g.dodge.duration) {
    warnings.push({ fieldKey: 'dodge.cancelWindowStart', severity: 'error', message: 'Cancel window starts after dodge ends — unreachable' });
  }
  if (g.dodge.cancelWindowEnd > g.dodge.duration) {
    warnings.push({ fieldKey: 'dodge.cancelWindowEnd', severity: 'warning', message: 'Cancel window extends past dodge end' });
  }
  if (g.dodge.cancelWindowStart > g.dodge.cancelWindowEnd) {
    warnings.push({ fieldKey: 'dodge.cancelWindowStart', severity: 'error', message: 'Cancel start > cancel end — empty window' });
  }
  if (g.dodge.staminaCost > g.attributes.baseStamina) {
    warnings.push({ fieldKey: 'dodge.staminaCost', severity: 'error', message: `Cannot dodge even once (cost ${g.dodge.staminaCost} > base stamina ${g.attributes.baseStamina})` });
  }
  if (g.dodge.cooldown === 0) {
    warnings.push({ fieldKey: 'dodge.cooldown', severity: 'warning', message: 'Zero cooldown — unlimited dodge spam' });
  }

  // Combat constraints
  if (g.combat.critChance > 0.8) {
    warnings.push({ fieldKey: 'combat.critChance', severity: 'warning', message: `Crit ${(g.combat.critChance * 100).toFixed(0)}% — diminishing design returns, crits feel unremarkable` });
  }
  if (g.combat.critMultiplier > 4) {
    warnings.push({ fieldKey: 'combat.critMultiplier', severity: 'warning', message: 'Extreme crit multiplier — spiky damage makes balancing difficult' });
  }
  if (g.combat.attackRange > 0 && g.combat.cleaveAngle === 0) {
    warnings.push({ fieldKey: 'combat.cleaveAngle', severity: 'warning', message: 'Zero cleave angle — melee hits nothing' });
  }
  if (g.combat.comboWindowMs < 100) {
    warnings.push({ fieldKey: 'combat.comboWindowMs', severity: 'warning', message: 'Combo window < 100ms — near-impossible for human input' });
  }

  // Movement constraints
  if (g.movement.maxSprintSpeed < g.movement.maxWalkSpeed) {
    warnings.push({ fieldKey: 'movement.maxSprintSpeed', severity: 'error', message: 'Sprint slower than walk' });
  }
  if (g.movement.airControl > 0.8) {
    warnings.push({ fieldKey: 'movement.airControl', severity: 'warning', message: 'Very high air control — may feel floaty or exploitable' });
  }

  // Attribute constraints
  if (g.attributes.baseHP <= 0) {
    warnings.push({ fieldKey: 'attributes.baseHP', severity: 'error', message: 'Zero or negative HP — instant death' });
  }
  if (g.attributes.staminaRegenPerSec > 0 && g.attributes.baseStamina === 0) {
    warnings.push({ fieldKey: 'attributes.baseStamina', severity: 'warning', message: 'Stamina regen with zero base stamina — wasted stat' });
  }
  if (g.attributes.manaRegenPerSec > 0 && g.attributes.baseMana === 0) {
    warnings.push({ fieldKey: 'attributes.baseMana', severity: 'warning', message: 'Mana regen with zero base mana — wasted stat' });
  }

  return warnings;
}

/* ── Profile Section Component ───────────────────────────────────────────── */

interface ProfileSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  fields: FieldDef[];
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
  compareValues?: Record<string, number>;
  compareColor?: string;
  /** Map from field key to warnings for that field */
  fieldWarnings?: Map<string, FieldWarning>;
}

function ProfileSection({ title, icon, color, fields, values, onChange, compareValues, compareColor, fieldWarnings }: ProfileSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const warningCount = fieldWarnings ? Array.from(fieldWarnings.values()).length : 0;

  return (
    <SurfaceCard level={2} className="overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface/30 transition-colors"
      >
        <motion.div animate={{ rotate: collapsed ? 0 : 90 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
          <ChevronRight className="w-3 h-3 text-text-muted" />
        </motion.div>
        <SectionLabel icon={icon} label={title} color={color} />
        <span className="ml-auto flex items-center gap-1.5">
          {warningCount > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
              style={{ backgroundColor: `${STATUS_WARNING}15`, color: STATUS_WARNING, border: `1px solid ${STATUS_WARNING}30` }}>
              <AlertTriangle className="w-2.5 h-2.5" />
              {warningCount}
            </span>
          )}
          <span className="text-xs font-mono text-text-muted">{fields.length} fields</span>
        </span>
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5">
              {fields.map((f, index) => {
                const val = values[f.key] ?? 0;
                const pct = ((val - f.min) / (f.max - f.min)) * 100;
                const cmpVal = compareValues?.[f.key];
                const cmpPct = cmpVal != null ? ((cmpVal - f.min) / (f.max - f.min)) * 100 : undefined;
                return (
                  <motion.div
                    key={`${f.key}`}
                    initial={{ opacity: 0.5, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'tween', duration: 0.35, delay: index * 0.02 }}
                    className="group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-text-muted w-24 truncate flex-shrink-0">{f.label}</span>
                      <div className="flex-1 relative h-4 flex items-center">
                        {/* Background track */}
                        <div className="absolute inset-x-0 h-1.5 bg-surface-deep rounded-full" />
                        {/* Compare bar */}
                        {cmpPct != null && (
                          <div
                            className="absolute h-1.5 rounded-full opacity-30"
                            style={{ width: `${Math.min(cmpPct, 100)}%`, backgroundColor: compareColor }}
                          />
                        )}
                        {/* Value bar */}
                        <div
                          className="absolute h-1.5 rounded-full transition-all duration-150"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}40` }}
                        />
                        {/* Input range */}
                        <input
                          type="range"
                          min={f.min}
                          max={f.max}
                          step={f.step}
                          value={val}
                          onChange={(e) => onChange(f.key, parseFloat(e.target.value))}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        />
                        {/* Thumb indicator */}
                        <div
                          className="absolute w-2.5 h-2.5 rounded-full border-2 border-surface shadow-md pointer-events-none transition-all duration-150"
                          style={{ left: `calc(${Math.min(pct, 100)}% - 5px)`, backgroundColor: color }}
                        />
                      </div>
                      <input
                        type="number"
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={val}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) onChange(f.key, Math.max(f.min, Math.min(f.max, v)));
                        }}
                        className="w-16 text-xs font-mono font-bold text-right px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                      />
                      <span className="text-xs font-mono text-text-muted/60 w-8 flex-shrink-0">{f.unit}</span>
                    </div>
                    {fieldWarnings?.get(f.key) && (() => {
                      const w = fieldWarnings.get(f.key)!;
                      const wColor = w.severity === 'error' ? STATUS_ERROR : STATUS_WARNING;
                      return (
                        <div className="flex items-center gap-1.5 ml-[104px] mt-0.5">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: wColor }} />
                          <span className="text-[10px] font-mono leading-tight" style={{ color: wColor }}>{w.message}</span>
                        </div>
                      );
                    })()}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

/* ── Genome Pill (selector) ──────────────────────────────────────────────── */

function GenomePill({ genome, isActive, onSelect }: { genome: CharacterGenome; isActive: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 focus:outline-none whitespace-nowrap"
      style={{
        backgroundColor: isActive ? `${genome.color}20` : 'transparent',
        color: isActive ? genome.color : 'var(--text-muted)',
        border: `1px solid ${isActive ? `${genome.color}50` : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isActive ? `0 0 10px ${genome.color}15` : 'none',
      }}
    >
      <span className="relative w-2 h-2 flex-shrink-0">
        <span className="absolute inset-0 rounded-full" style={{ backgroundColor: genome.color }} />
        {isActive && (
          <motion.span
            layoutId="genome-active-pill"
            className="absolute -inset-0.5 rounded-full border-2"
            style={{ borderColor: genome.color }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          />
        )}
      </span>
      {genome.name}
    </button>
  );
}

/* ── Code Preview Modal ──────────────────────────────────────────────────── */

function CodePreview({ code, title, onClose }: { code: string; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="bg-surface-deep border border-border/60 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-sm font-bold text-text">{title}</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors"
            style={{
              borderColor: copied ? `${STATUS_SUCCESS}50` : `${ACCENT}40`,
              backgroundColor: copied ? `${STATUS_SUCCESS}15` : `${ACCENT}10`,
              color: copied ? STATUS_SUCCESS : ACCENT,
            }}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-muted leading-relaxed custom-scrollbar whitespace-pre">
          {code}
        </pre>
      </motion.div>
    </motion.div>
  );
}

/* ── Archetype Comparison Panel ─────────────────────────────────────────── */

interface ComparisonAxis {
  label: string;
  getValue: (g: CharacterGenome) => number;
  max: number;
  unit: string;
  higherIsBetter: boolean;
}

const COMPARISON_AXES: ComparisonAxis[] = [
  { label: 'Speed', getValue: (g) => g.movement.maxSprintSpeed, max: 1500, unit: 'cm/s', higherIsBetter: true },
  { label: 'DPS', getValue: (g) => g.combat.baseDamage * g.combat.attackSpeed, max: 200, unit: '', higherIsBetter: true },
  { label: 'Range', getValue: (g) => g.combat.attackRange, max: 1500, unit: 'cm', higherIsBetter: true },
  { label: 'Tankiness', getValue: (g) => g.attributes.baseHP + g.attributes.baseArmor * 5, max: 2500, unit: 'eHP', higherIsBetter: true },
  { label: 'Agility', getValue: (g) => g.dodge.distance / Math.max(g.dodge.cooldown, 0.01), max: 1200, unit: '', higherIsBetter: true },
  { label: 'Crit', getValue: (g) => g.combat.critChance * g.combat.critMultiplier * 100, max: 200, unit: '%', higherIsBetter: true },
  { label: 'Sustain', getValue: (g) => g.attributes.staminaRegenPerSec + g.attributes.manaRegenPerSec, max: 50, unit: '/s', higherIsBetter: true },
  { label: 'Armor', getValue: (g) => g.attributes.baseArmor, max: 200, unit: '', higherIsBetter: true },
];

function ArchetypeComparisonPanel({ genomes, activeGenome }: { genomes: CharacterGenome[]; activeGenome: CharacterGenome }) {
  const [leftId, setLeftId] = useState(genomes[0]?.id ?? '');
  const [rightId, setRightId] = useState(genomes[1]?.id ?? genomes[0]?.id ?? '');

  const leftGenome = genomes.find((g) => g.id === leftId) ?? genomes[0];
  const rightGenome = genomes.find((g) => g.id === rightId) ?? (genomes[1] ?? genomes[0]);

  if (genomes.length < 2) return null;

  const leftRadar: RadarDataPoint[] = COMPARISON_AXES.map((a) => ({
    axis: a.label,
    value: Math.min(a.getValue(leftGenome) / a.max, 1),
  }));
  const rightRadar: RadarDataPoint[] = COMPARISON_AXES.map((a) => ({
    axis: a.label,
    value: Math.min(a.getValue(rightGenome) / a.max, 1),
  }));

  const deltas = COMPARISON_AXES.map((axis) => {
    const lv = axis.getValue(leftGenome);
    const rv = axis.getValue(rightGenome);
    const diff = rv - lv;
    const pct = lv !== 0 ? ((diff / Math.abs(lv)) * 100) : (diff !== 0 ? 100 : 0);
    return { label: axis.label, unit: axis.unit, left: lv, right: rv, diff, pct, higherIsBetter: axis.higherIsBetter };
  });

  return (
    <SurfaceCard level={2} className="p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <SectionLabel icon={GitCompareArrows} label="Archetype Comparison" color={ACCENT} />
      </div>

      {/* Archetype Selectors */}
      <div className="flex items-center gap-2">
        <select
          value={leftId}
          onChange={(e) => setLeftId(e.target.value)}
          className="flex-1 text-xs font-mono font-bold bg-surface-deep border border-border/40 rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-blue-500/50"
          style={{ color: leftGenome.color }}
        >
          {genomes.map((g) => <option key={g.id} value={g.id} style={{ color: 'var(--text)' }}>{g.name}</option>)}
        </select>
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">vs</span>
        <select
          value={rightId}
          onChange={(e) => setRightId(e.target.value)}
          className="flex-1 text-xs font-mono font-bold bg-surface-deep border border-border/40 rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-blue-500/50"
          style={{ color: rightGenome.color }}
        >
          {genomes.map((g) => <option key={g.id} value={g.id} style={{ color: 'var(--text)' }}>{g.name}</option>)}
        </select>
      </div>

      {/* Overlaid Radar + Delta Badges */}
      <div className="flex flex-col xl:flex-row items-start gap-3">
        {/* Radar */}
        <div className="flex flex-col items-center flex-shrink-0">
          <RadarChart
            data={leftRadar}
            accent={leftGenome.color}
            overlays={[{ data: rightRadar, color: rightGenome.color, label: rightGenome.name }]}
            size={220}
          />
          <div className="flex gap-3 mt-2">
            <span className="flex items-center gap-1.5 text-xs font-mono font-bold" style={{ color: leftGenome.color }}>
              <span className="w-3 h-1 rounded-full" style={{ backgroundColor: leftGenome.color }} />
              {leftGenome.name}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-mono font-bold" style={{ color: rightGenome.color }}>
              <span className="w-3 h-1 rounded-full opacity-70" style={{ backgroundColor: rightGenome.color }} />
              {rightGenome.name}
            </span>
          </div>
        </div>

        {/* Delta Badges */}
        <div className="flex-1 w-full">
          <div className="grid grid-cols-2 gap-1.5">
            {deltas.map((d) => {
              const isPositive = d.diff > 0;
              const isBetter = d.higherIsBetter ? isPositive : !isPositive;
              const badgeColor = d.diff === 0 ? 'var(--text-muted)' : isBetter ? STATUS_SUCCESS : STATUS_ERROR;
              const sign = d.diff > 0 ? '+' : '';
              return (
                <div key={d.label} className="flex items-center justify-between p-1.5 rounded-lg border border-border/20 bg-surface-deep/30">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">{d.label}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono font-bold" style={{ color: leftGenome.color }}>
                        {d.left % 1 !== 0 ? d.left.toFixed(1) : d.left}
                      </span>
                      <span className="text-[10px] text-text-muted">vs</span>
                      <span className="text-xs font-mono font-bold" style={{ color: rightGenome.color }}>
                        {d.right % 1 !== 0 ? d.right.toFixed(1) : d.right}
                      </span>
                    </div>
                  </div>
                  {d.diff !== 0 && (
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                      style={{ backgroundColor: `${badgeColor}15`, color: badgeColor, border: `1px solid ${badgeColor}30` }}
                    >
                      {sign}{Math.abs(d.pct) >= 1 ? `${d.pct.toFixed(0)}%` : `${d.pct.toFixed(1)}%`}
                    </span>
                  )}
                  {d.diff === 0 && (
                    <span className="text-[10px] font-mono text-text-muted/50 px-1.5 py-0.5">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

/* ── Main Editor Component ───────────────────────────────────────────────── */

export function CharacterGenomeEditor() {
  const [genomes, setGenomes] = useState<CharacterGenome[]>(() => PRESET_GENOMES.map((g) => ({ ...g, id: createId() })));
  const [activeId, setActiveId] = useState(genomes[0].id);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [codePreview, setCodePreview] = useState<{ code: string; title: string } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeGenome = useMemo(() => genomes.find((g) => g.id === activeId)!, [genomes, activeId]);
  const compareGenomes = useMemo(() => genomes.filter((g) => compareIds.has(g.id)), [genomes, compareIds]);

  const updateGenome = useCallback((id: string, updater: (g: CharacterGenome) => CharacterGenome) => {
    setGenomes((prev) => prev.map((g) => (g.id === id ? updater(g) : g)));
  }, []);

  type ProfileKey = 'movement' | 'combat' | 'dodge' | 'camera' | 'attributes';

  const updateProfile = useCallback((
    profile: ProfileKey,
    key: string,
    value: number,
  ) => {
    updateGenome(activeId, (g) => ({
      ...g,
      updatedAt: new Date().toISOString(),
      [profile]: { ...g[profile], [key]: value },
    }));
  }, [activeId, updateGenome]);

  const addGenome = useCallback(() => {
    const colors = [ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_CYAN, ACCENT_PINK, STATUS_WARNING];
    const color = colors[genomes.length % colors.length];
    const newGenome = createGenome(`Archetype ${genomes.length + 1}`, color);
    setGenomes((prev) => [...prev, newGenome]);
    setActiveId(newGenome.id);
  }, [genomes.length]);

  const deleteGenome = useCallback((id: string) => {
    if (genomes.length <= 1) return;
    setGenomes((prev) => prev.filter((g) => g.id !== id));
    if (activeId === id) setActiveId(genomes[0].id === id ? genomes[1].id : genomes[0].id);
    setCompareIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  }, [genomes, activeId]);

  const exportGenome = useCallback((genome: CharacterGenome) => {
    const json = JSON.stringify(genome, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genome-${genome.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importGenome = useCallback((text: string) => {
    try {
      const parsed = JSON.parse(text) as CharacterGenome;
      if (!parsed.name || !parsed.movement || !parsed.combat) {
        setImportError('Invalid genome: missing required fields (name, movement, combat)');
        return;
      }
      const imported: CharacterGenome = {
        ...createGenome(parsed.name, parsed.color || ACCENT_CYAN),
        ...parsed,
        id: createId(),
        updatedAt: new Date().toISOString(),
      };
      setGenomes((prev) => [...prev, imported]);
      setActiveId(imported.id);
      setShowImport(false);
      setImportText('');
      setImportError('');
    } catch {
      setImportError('Invalid JSON format');
    }
  }, []);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') importGenome(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importGenome]);

  const copyToClipboard = useCallback((genome: CharacterGenome) => {
    navigator.clipboard.writeText(JSON.stringify(genome, null, 2));
  }, []);

  // Radar overlays: selected compare genomes, or all others if none selected
  const radarOverlays = useMemo(() => {
    const targets = compareGenomes.length > 0
      ? compareGenomes
      : genomes.filter((g) => g.id !== activeId);
    return targets.map((g) => ({
      data: genomeToRadar(g),
      color: g.color,
      label: g.name,
    }));
  }, [genomes, activeId, compareGenomes]);

  // Compute balance constraint warnings grouped by profile
  const warningsByProfile = useMemo(() => {
    const all = validateGenome(activeGenome);
    const grouped: Record<string, Map<string, FieldWarning>> = {};
    for (const w of all) {
      const [profile, field] = w.fieldKey.split('.');
      if (!grouped[profile]) grouped[profile] = new Map();
      // Only keep the most severe warning per field
      const existing = grouped[profile].get(field);
      if (!existing || (w.severity === 'error' && existing.severity === 'warning')) {
        grouped[profile].set(field, w);
      }
    }
    return grouped;
  }, [activeGenome]);

  return (
    <div className="space-y-2.5">
      {/* ── Genome Selector Bar ──────────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <SectionLabel icon={Dna} label="Character Genomes" color={ACCENT} />
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={addGenome}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors hover:brightness-110"
              style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}10`, color: ACCENT }}
            >
              <Plus className="w-3 h-3" /> New
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors hover:brightness-110"
              style={{ borderColor: `${ACCENT_CYAN}40`, backgroundColor: `${ACCENT_CYAN}10`, color: ACCENT_CYAN }}
            >
              <Upload className="w-3 h-3" /> Import
            </button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileImport} />
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {genomes.map((g) => (
            <GenomePill key={g.id} genome={g} isActive={g.id === activeId} onSelect={() => setActiveId(g.id)} />
          ))}
        </div>
      </SurfaceCard>

      {/* ── Import Dialog ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showImport && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <SurfaceCard level={2} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <SectionLabel icon={Upload} label="Import Genome" color={ACCENT_CYAN} />
                <button onClick={() => { setShowImport(false); setImportError(''); }} className="text-xs text-text-muted hover:text-text">Cancel</button>
              </div>
              <textarea
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
                placeholder="Paste genome JSON here..."
                className="w-full h-28 text-xs font-mono bg-surface-deep border border-border/40 rounded-lg p-2.5 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50 resize-none custom-scrollbar"
              />
              {importError && <p className="text-xs font-mono" style={{ color: STATUS_ERROR }}>{importError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => importGenome(importText)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors"
                  style={{ borderColor: `${ACCENT_CYAN}40`, backgroundColor: `${ACCENT_CYAN}15`, color: ACCENT_CYAN }}
                >
                  Import from JSON
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-border/40 text-text-muted hover:text-text transition-colors"
                >
                  Import from File
                </button>
              </div>
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active Genome Header + Radar ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-2.5">
        <SurfaceCard level={2} className="p-3">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeGenome.color, boxShadow: `0 0 8px ${activeGenome.color}60` }} />
                <input
                  type="text"
                  value={activeGenome.name}
                  onChange={(e) => updateGenome(activeId, (g) => ({ ...g, name: e.target.value }))}
                  className="text-sm font-bold bg-transparent border-none text-text focus:outline-none px-0"
                />
              </div>
              <input
                type="text"
                value={activeGenome.description}
                onChange={(e) => updateGenome(activeId, (g) => ({ ...g, description: e.target.value }))}
                placeholder="Describe this archetype..."
                className="w-full text-xs font-mono bg-transparent border-none text-text-muted focus:outline-none placeholder:text-text-muted/40 px-0"
              />
              <div className="flex items-center gap-3 text-xs font-mono text-text-muted">
                <span>v{activeGenome.version}</span>
                <span>by {activeGenome.author}</span>
                {activeGenome.tags && activeGenome.tags.length > 0 && (
                  <div className="flex gap-1">
                    {activeGenome.tags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: `${activeGenome.color}15`, color: activeGenome.color }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => exportGenome(activeGenome)}
                className="p-1.5 rounded-lg border transition-colors hover:brightness-110"
                style={{ borderColor: `${ACCENT_EMERALD}40`, backgroundColor: `${ACCENT_EMERALD}10`, color: ACCENT_EMERALD }}
                title="Export JSON"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => copyToClipboard(activeGenome)}
                className="p-1.5 rounded-lg border transition-colors hover:brightness-110"
                style={{ borderColor: `${ACCENT_CYAN}40`, backgroundColor: `${ACCENT_CYAN}10`, color: ACCENT_CYAN }}
                title="Copy JSON to clipboard"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteGenome(activeId)}
                disabled={genomes.length <= 1}
                className="p-1.5 rounded-lg border transition-colors hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ borderColor: `${STATUS_ERROR}40`, backgroundColor: `${STATUS_ERROR}10`, color: STATUS_ERROR }}
                title="Delete genome"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Compare selector (multi-select, up to 4) */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/30">
            <span className="text-xs font-mono font-bold text-text-muted uppercase tracking-wider">Compare:</span>
            <button
              onClick={() => setCompareIds(new Set())}
              className="px-2 py-0.5 rounded text-xs font-mono font-bold transition-colors"
              style={{
                backgroundColor: compareIds.size === 0 ? `${ACCENT}15` : 'transparent',
                color: compareIds.size === 0 ? ACCENT : 'var(--text-muted)',
                border: `1px solid ${compareIds.size === 0 ? `${ACCENT}40` : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              All
            </button>
            {genomes.filter((g) => g.id !== activeId).map((g) => {
              const isSelected = compareIds.has(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => setCompareIds(prev => {
                    const next = new Set(prev);
                    if (next.has(g.id)) { next.delete(g.id); }
                    else if (next.size < 4) { next.add(g.id); }
                    return next;
                  })}
                  className="px-2 py-0.5 rounded text-xs font-mono font-bold transition-colors"
                  style={{
                    backgroundColor: isSelected ? `${g.color}15` : 'transparent',
                    color: isSelected ? g.color : 'var(--text-muted)',
                    border: `1px solid ${isSelected ? `${g.color}40` : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {g.name}
                </button>
              );
            })}
            {compareIds.size > 0 && (
              <span className="text-[9px] font-mono text-text-muted/50 ml-1">{compareIds.size}/4</span>
            )}
          </div>
        </SurfaceCard>

        {/* Radar overview */}
        <SurfaceCard level={2} className="p-3 flex flex-col items-center justify-center">
          <div className="text-xs font-mono font-bold text-text-muted uppercase tracking-wider mb-1">Archetype Radar</div>
          <RadarChart
            data={genomeToRadar(activeGenome)}
            accent={activeGenome.color}
            overlays={radarOverlays}
            size={160}
          />
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            <span className="flex items-center gap-1 text-xs font-mono font-bold" style={{ color: activeGenome.color }}>
              <span className="w-2.5 h-2.5 rounded-full border-2" style={{ backgroundColor: activeGenome.color, borderColor: activeGenome.color }} />
              {activeGenome.name}
            </span>
            {radarOverlays.map((overlay) => (
              <span key={overlay.label} className="flex items-center gap-1 text-xs font-mono" style={{ color: overlay.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: overlay.color, opacity: 0.6 }} />
                {overlay.label}
              </span>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* ── Archetype Comparison (2-genome overlay) ──────────────────────── */}
      <ArchetypeComparisonPanel genomes={genomes} activeGenome={activeGenome} />

      {/* ── Profile Editors ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
        <motion.div
          key={`section-movement-${activeId}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'tween', duration: 0.3, delay: 0 * STAGGER_DEFAULT }}
        >
          <ProfileSection
            title="Movement"
            icon={Zap}
            color={ACCENT_EMERALD}
            fields={MOVEMENT_FIELDS}
            values={activeGenome.movement as unknown as Record<string, number>}
            onChange={(k, v) => updateProfile('movement', k, v)}
            compareValues={compareGenomes[0]?.movement as unknown as Record<string, number>}
            compareColor={compareGenomes[0]?.color}
            fieldWarnings={warningsByProfile['movement']}
          />
        </motion.div>
        <motion.div
          key={`section-combat-${activeId}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'tween', duration: 0.3, delay: 1 * STAGGER_DEFAULT }}
        >
          <ProfileSection
            title="Combat"
            icon={Swords}
            color={STATUS_ERROR}
            fields={COMBAT_FIELDS}
            values={activeGenome.combat as unknown as Record<string, number>}
            onChange={(k, v) => updateProfile('combat', k, v)}
            compareValues={compareGenomes[0]?.combat as unknown as Record<string, number>}
            compareColor={compareGenomes[0]?.color}
            fieldWarnings={warningsByProfile['combat']}
          />
        </motion.div>
        <motion.div
          key={`section-dodge-${activeId}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'tween', duration: 0.3, delay: 2 * STAGGER_DEFAULT }}
        >
          <ProfileSection
            title="Dodge"
            icon={Activity}
            color={ACCENT_ORANGE}
            fields={DODGE_FIELDS}
            values={activeGenome.dodge as unknown as Record<string, number>}
            onChange={(k, v) => updateProfile('dodge', k, v)}
            compareValues={compareGenomes[0]?.dodge as unknown as Record<string, number>}
            compareColor={compareGenomes[0]?.color}
            fieldWarnings={warningsByProfile['dodge']}
          />
        </motion.div>
        <motion.div
          key={`section-camera-${activeId}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'tween', duration: 0.3, delay: 3 * STAGGER_DEFAULT }}
        >
          <ProfileSection
            title="Camera"
            icon={Camera}
            color={ACCENT_CYAN}
            fields={CAMERA_FIELDS}
            values={activeGenome.camera as unknown as Record<string, number>}
            onChange={(k, v) => updateProfile('camera', k, v)}
            compareValues={compareGenomes[0]?.camera as unknown as Record<string, number>}
            compareColor={compareGenomes[0]?.color}
          />
        </motion.div>
        <motion.div
          key={`section-attributes-${activeId}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'tween', duration: 0.3, delay: 4 * STAGGER_DEFAULT }}
        >
          <ProfileSection
            title="Attributes"
            icon={Shield}
            color={ACCENT_VIOLET}
            fields={ATTRIBUTE_FIELDS}
            values={activeGenome.attributes as unknown as Record<string, number>}
            onChange={(k, v) => updateProfile('attributes', k, v)}
            compareValues={compareGenomes[0]?.attributes as unknown as Record<string, number>}
            compareColor={compareGenomes[0]?.color}
            fieldWarnings={warningsByProfile['attributes']}
          />
        </motion.div>

        {/* ── UE5 Code Generation Card ────────────────────────────────────── */}
        <SurfaceCard level={2} className="p-3 space-y-2.5">
          <SectionLabel icon={Code2} label="UE5 Code Generation" color={ACCENT} />
          <p className="text-xs text-text-muted">
            Auto-generate ARPGCharacterBase subclass constructor and AttributeInitTable rows from this genome.
          </p>
          <div className="space-y-1.5">
            <button
              onClick={() => setCodePreview({ code: generateSubclassHeader(activeGenome), title: `${activeGenome.name} — Header (.h)` })}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-colors hover:brightness-110 text-left"
              style={{ borderColor: `${ACCENT}30`, backgroundColor: `${ACCENT}08`, color: ACCENT }}
            >
              <Code2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1">Generate .h Header</span>
              <ChevronRight className="w-3 h-3 opacity-50" />
            </button>
            <button
              onClick={() => setCodePreview({ code: generateSubclassCpp(activeGenome), title: `${activeGenome.name} — Implementation (.cpp)` })}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-colors hover:brightness-110 text-left"
              style={{ borderColor: `${ACCENT_EMERALD}30`, backgroundColor: `${ACCENT_EMERALD}08`, color: ACCENT_EMERALD }}
            >
              <Code2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1">Generate .cpp Implementation</span>
              <ChevronRight className="w-3 h-3 opacity-50" />
            </button>
            <button
              onClick={() => setCodePreview({ code: generateAttributeInitTable(activeGenome), title: `${activeGenome.name} — AttributeInitTable (CSV)` })}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-colors hover:brightness-110 text-left"
              style={{ borderColor: `${ACCENT_VIOLET}30`, backgroundColor: `${ACCENT_VIOLET}08`, color: ACCENT_VIOLET }}
            >
              <Code2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1">Generate AttributeInitTable (CSV)</span>
              <ChevronRight className="w-3 h-3 opacity-50" />
            </button>
          </div>
        </SurfaceCard>
      </div>

      {/* ── Derived Stats Dashboard ────────────────────────────────────── */}
      <DerivedStatsDashboard genome={activeGenome} compareGenome={compareGenomes[0]} />

      {/* ── Stat Comparison Table (all genomes) ──────────────────────────── */}
      <SurfaceCard level={2} className="p-3">
        <div className="mb-2.5"><SectionLabel icon={Activity} label="Genome Comparison Matrix" color={ACCENT_VIOLET} /></div>
        <div className="overflow-x-auto custom-scrollbar">
          <GenomeComparisonTable genomes={genomes} activeId={activeId} />
        </div>
      </SurfaceCard>

      {/* ── Code preview modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {codePreview && (
          <CodePreview code={codePreview.code} title={codePreview.title} onClose={() => setCodePreview(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Derived Stats Dashboard ──────────────────────────────────────────────── */

const STANDARD_ENEMY_HP = 1000;

interface DerivedStatDef {
  label: string;
  unit: string;
  category: 'offense' | 'defense' | 'sustain' | 'mobility';
  compute: (g: CharacterGenome) => number;
  format: (v: number) => string;
  max: number;
  higherIsBetter: boolean;
  formula: string;
}

const DERIVED_STATS: DerivedStatDef[] = [
  {
    label: 'Effective DPS', unit: 'dmg/s', category: 'offense',
    compute: (g) => g.combat.baseDamage * g.combat.attackSpeed * (1 + g.combat.critChance * (g.combat.critMultiplier - 1)),
    format: (v) => v.toFixed(1), max: 200, higherIsBetter: true,
    formula: 'baseDmg × atkSpd × (1 + crit% × (critMult − 1))',
  },
  {
    label: 'Burst (3s)', unit: 'dmg', category: 'offense',
    compute: (g) => g.combat.baseDamage * g.combat.attackSpeed * (1 + g.combat.critChance * (g.combat.critMultiplier - 1)) * 3,
    format: (v) => v.toFixed(0), max: 600, higherIsBetter: true,
    formula: 'effectiveDPS × 3s window',
  },
  {
    label: 'Time to Kill', unit: 's', category: 'offense',
    compute: (g) => {
      const dps = g.combat.baseDamage * g.combat.attackSpeed * (1 + g.combat.critChance * (g.combat.critMultiplier - 1));
      return dps > 0 ? STANDARD_ENEMY_HP / dps : 999;
    },
    format: (v) => v >= 999 ? '∞' : v.toFixed(1), max: 60, higherIsBetter: false,
    formula: `${STANDARD_ENEMY_HP}HP enemy ÷ effectiveDPS`,
  },
  {
    label: 'Cleave Area', unit: 'cm²', category: 'offense',
    compute: (g) => Math.PI * g.combat.attackRange ** 2 * (g.combat.cleaveAngle / 360),
    format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0),
    max: 500000, higherIsBetter: true,
    formula: 'π × range² × cleaveAngle/360',
  },
  {
    label: 'Effective HP', unit: 'eHP', category: 'defense',
    compute: (g) => g.attributes.baseHP + g.attributes.baseArmor * 5,
    format: (v) => v.toFixed(0), max: 2500, higherIsBetter: true,
    formula: 'baseHP + armor × 5',
  },
  {
    label: 'I-Frame Uptime', unit: '%', category: 'defense',
    compute: (g) => {
      const cycle = g.dodge.cooldown + g.dodge.duration;
      return cycle > 0 ? (g.dodge.iFrameDuration / cycle) * 100 : 0;
    },
    format: (v) => v.toFixed(1), max: 50, higherIsBetter: true,
    formula: 'iFrameDur ÷ (cooldown + dodgeDur) × 100',
  },
  {
    label: 'Dodges/min', unit: '/min', category: 'defense',
    compute: (g) => {
      const cycle = g.dodge.cooldown + g.dodge.duration;
      return cycle > 0 ? 60 / cycle : 0;
    },
    format: (v) => v.toFixed(1), max: 100, higherIsBetter: true,
    formula: '60 ÷ (cooldown + dodgeDuration)',
  },
  {
    label: 'Stamina Budget', unit: 'dodges', category: 'sustain',
    compute: (g) => g.dodge.staminaCost > 0 ? Math.floor(g.attributes.baseStamina / g.dodge.staminaCost) : 99,
    format: (v) => v >= 99 ? '∞' : String(v), max: 20, higherIsBetter: true,
    formula: 'baseStamina ÷ dodgeCost',
  },
  {
    label: 'Stamina Recovery', unit: 's', category: 'sustain',
    compute: (g) => g.attributes.staminaRegenPerSec > 0 ? g.attributes.baseStamina / g.attributes.staminaRegenPerSec : 999,
    format: (v) => v >= 999 ? '∞' : v.toFixed(1), max: 30, higherIsBetter: false,
    formula: 'baseStamina ÷ staminaRegen/s',
  },
  {
    label: 'Mana Pool Time', unit: 's', category: 'sustain',
    compute: (g) => g.attributes.manaRegenPerSec > 0 ? g.attributes.baseMana / g.attributes.manaRegenPerSec : 999,
    format: (v) => v >= 999 ? '∞' : v.toFixed(1), max: 60, higherIsBetter: true,
    formula: 'baseMana ÷ manaRegen/s',
  },
  {
    label: 'Sprint Ratio', unit: '×', category: 'mobility',
    compute: (g) => g.movement.maxWalkSpeed > 0 ? g.movement.maxSprintSpeed / g.movement.maxWalkSpeed : 0,
    format: (v) => v.toFixed(2), max: 3, higherIsBetter: true,
    formula: 'sprintSpeed ÷ walkSpeed',
  },
  {
    label: 'Dodge Velocity', unit: 'cm/s', category: 'mobility',
    compute: (g) => g.dodge.duration > 0 ? g.dodge.distance / g.dodge.duration : 0,
    format: (v) => v.toFixed(0), max: 2000, higherIsBetter: true,
    formula: 'dodgeDist ÷ dodgeDur',
  },
  {
    label: 'Jump Height', unit: 'cm', category: 'mobility',
    compute: (g) => {
      const gravity = 980 * g.movement.gravityScale;
      return gravity > 0 ? (g.movement.jumpZVelocity ** 2) / (2 * gravity) : 0;
    },
    format: (v) => v.toFixed(0), max: 300, higherIsBetter: true,
    formula: 'v² ÷ (2 × 980 × gravScale)',
  },
];

const CATEGORY_META: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  offense: { label: 'Offense', icon: Swords, color: STATUS_ERROR },
  defense: { label: 'Defense', icon: Shield, color: ACCENT_EMERALD },
  sustain: { label: 'Sustain', icon: Zap, color: ACCENT_CYAN },
  mobility: { label: 'Mobility', icon: Activity, color: ACCENT_VIOLET },
};

const DERIVED_CATEGORIES = ['offense', 'defense', 'sustain', 'mobility'] as const;

function DerivedStatsDashboard({ genome, compareGenome }: { genome: CharacterGenome; compareGenome?: CharacterGenome }) {
  const categories = useMemo(() =>
    DERIVED_CATEGORIES.map((cat) => ({
      category: cat,
      ...CATEGORY_META[cat],
      stats: DERIVED_STATS.filter((s) => s.category === cat).map((def) => ({
        ...def,
        value: def.compute(genome),
        compareValue: compareGenome ? def.compute(compareGenome) : undefined,
      })),
    })),
  [genome, compareGenome]);

  return (
    <SurfaceCard level={2} className="p-3 space-y-3">
      <SectionLabel icon={Activity} label="Derived Stats Dashboard" color={ACCENT_ORANGE} />
      <p className="text-xs text-text-muted">
        Live gameplay metrics calculated from raw genome values. Hover a stat for the formula.
        {compareGenome && <span className="ml-1 font-bold" style={{ color: compareGenome.color }}>vs {compareGenome.name}</span>}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categories.map(({ category, label, icon: CatIcon, color, stats }) => (
          <div key={category} className="space-y-1.5">
            <div className="flex items-center gap-1.5 pb-1 border-b border-border/30">
              <CatIcon className="w-3 h-3" style={{ color, filter: `drop-shadow(0 0 3px ${color}80)` }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
            </div>
            <div className="space-y-0.5">
              {stats.map((stat) => {
                const pct = Math.min(Math.abs(stat.value) / stat.max, 1);
                const comparePct = stat.compareValue != null ? Math.min(Math.abs(stat.compareValue) / stat.max, 1) : undefined;
                const delta = stat.compareValue != null ? stat.value - stat.compareValue : undefined;
                const deltaGood = delta != null && delta !== 0
                  ? (stat.higherIsBetter ? delta > 0 : delta < 0)
                  : undefined;

                return (
                  <div
                    key={stat.label}
                    className="px-2 py-1 rounded-md hover:bg-surface/40 transition-colors"
                    title={stat.formula}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-mono text-text-muted">{stat.label}</span>
                      <div className="flex items-center gap-1.5">
                        {delta != null && delta !== 0 && (
                          <span
                            className="text-[10px] font-mono font-bold"
                            style={{ color: deltaGood ? STATUS_SUCCESS : STATUS_ERROR }}
                          >
                            {delta > 0 ? '+' : ''}{stat.format(delta)}
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-text">
                          {stat.format(stat.value)}
                          <span className="text-text-muted text-[10px] ml-0.5">{stat.unit}</span>
                        </span>
                      </div>
                    </div>
                    <div className="relative h-1.5 bg-surface-deep rounded-full overflow-hidden">
                      {comparePct != null && (
                        <div
                          className="absolute inset-y-0 left-0 rounded-full opacity-30"
                          style={{ width: `${comparePct * 100}%`, backgroundColor: compareGenome?.color ?? '#64748b' }}
                        />
                      )}
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

/* ── Genome Comparison Table ─────────────────────────────────────────────── */

interface CompStatRow {
  label: string;
  unit: string;
  getValue: (g: CharacterGenome) => number;
  higherIsBetter: boolean;
}

const COMP_STATS: CompStatRow[] = [
  { label: 'Walk Speed', unit: 'cm/s', getValue: (g) => g.movement.maxWalkSpeed, higherIsBetter: true },
  { label: 'Sprint Speed', unit: 'cm/s', getValue: (g) => g.movement.maxSprintSpeed, higherIsBetter: true },
  { label: 'Base Damage', unit: '', getValue: (g) => g.combat.baseDamage, higherIsBetter: true },
  { label: 'Attack Speed', unit: '/s', getValue: (g) => g.combat.attackSpeed, higherIsBetter: true },
  { label: 'DPS', unit: '', getValue: (g) => Math.round(g.combat.baseDamage * g.combat.attackSpeed * 10) / 10, higherIsBetter: true },
  { label: 'Crit Chance', unit: '%', getValue: (g) => Math.round(g.combat.critChance * 100), higherIsBetter: true },
  { label: 'Attack Range', unit: 'cm', getValue: (g) => g.combat.attackRange, higherIsBetter: true },
  { label: 'Dodge Distance', unit: 'cm', getValue: (g) => g.dodge.distance, higherIsBetter: true },
  { label: 'Dodge Cooldown', unit: 's', getValue: (g) => g.dodge.cooldown, higherIsBetter: false },
  { label: 'I-Frame Duration', unit: 's', getValue: (g) => g.dodge.iFrameDuration, higherIsBetter: true },
  { label: 'Base HP', unit: '', getValue: (g) => g.attributes.baseHP, higherIsBetter: true },
  { label: 'Base Armor', unit: '', getValue: (g) => g.attributes.baseArmor, higherIsBetter: true },
  { label: 'Base Stamina', unit: '', getValue: (g) => g.attributes.baseStamina, higherIsBetter: true },
  { label: 'Base Mana', unit: '', getValue: (g) => g.attributes.baseMana, higherIsBetter: true },
];

function GenomeComparisonTable({ genomes, activeId }: { genomes: CharacterGenome[]; activeId: string }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-border/40">
          <th className="text-left py-2 pr-4 text-xs font-bold uppercase tracking-wider text-text-muted w-32">Stat</th>
          {genomes.map((g) => (
            <th key={g.id} className="py-2 px-2 text-xs font-bold uppercase tracking-wider text-center" style={{ color: g.color }}>
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                {g.name}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border/20">
        {COMP_STATS.map((stat) => {
          const values = genomes.map((g) => stat.getValue(g));
          const bestVal = stat.higherIsBetter ? Math.max(...values) : Math.min(...values);
          const maxVal = Math.max(...values);

          return (
            <tr key={stat.label} className="hover:bg-surface/30 transition-colors">
              <td className="py-2 pr-4 font-mono font-bold text-text-muted">
                {stat.label} {stat.unit && <span className="text-xs opacity-60">({stat.unit})</span>}
              </td>
              {genomes.map((g, i) => {
                const val = values[i];
                const barPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                const isBest = val === bestVal;
                const isActive = g.id === activeId;
                return (
                  <td key={g.id} className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-2 bg-surface-deep rounded-full overflow-hidden flex-shrink-0">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${barPct}%`,
                            backgroundColor: g.color,
                            boxShadow: isBest ? `0 0 6px ${g.color}60` : 'none',
                            opacity: isActive ? 1 : 0.7,
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs w-10" style={{
                        color: isBest ? STATUS_SUCCESS : 'var(--text-muted)',
                        fontWeight: isBest ? 700 : 400,
                      }}>
                        {val}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

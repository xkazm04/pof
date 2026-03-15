'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Sparkles, Wand2, ArrowLeftRight, Play, ChevronDown, ChevronRight,
  Zap, Swords, Shield, Camera, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, RadarChart } from './_shared';
import {
  FEEL_PRESETS, FEEL_FIELD_META,
  compareProfiles, profileToRadar, getNestedValue,
  buildFeelOptimizerPrompt,
  type FeelPreset, type FeelProfile, type FeelComparison,
} from '@/lib/character-feel-optimizer';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import type { SubModuleId } from '@/types/modules';

const ACCENT = MODULE_COLORS.core;

const CATEGORY_ICONS: Record<string, typeof Zap> = {
  Movement: Zap,
  Combat: Swords,
  Dodge: Shield,
  Camera: Camera,
  Stamina: Activity,
};

const CATEGORY_COLORS: Record<string, string> = {
  Movement: ACCENT_EMERALD,
  Combat: STATUS_ERROR,
  Dodge: ACCENT_CYAN,
  Camera: ACCENT_ORANGE,
  Stamina: ACCENT_VIOLET,
};

/* ── Preset Card ──────────────────────────────────────────────────────────── */

function PresetCard({
  preset,
  isSelected,
  isCompareTarget,
  onSelect,
  onCompare,
}: {
  preset: FeelPreset;
  isSelected: boolean;
  isCompareTarget: boolean;
  onSelect: () => void;
  onCompare: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="relative overflow-hidden rounded-lg border cursor-pointer transition-all"
      style={{
        borderColor: isSelected ? `${preset.color}80` : isCompareTarget ? `${preset.color}40` : 'rgba(255,255,255,0.08)',
        backgroundColor: isSelected ? `${preset.color}15` : 'transparent',
        boxShadow: isSelected ? `0 0 12px ${preset.color}30, inset 0 0 12px ${preset.color}08` : 'none',
      }}
      onClick={onSelect}
    >
      <div className="p-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold" style={{ color: preset.color }}>{preset.name}</span>
          <span className="text-[9px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface-deep border border-border/30">
            {preset.genre}
          </span>
        </div>
        <p className="text-[10px] text-text-muted leading-relaxed mb-1.5">{preset.description}</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {preset.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${preset.color}15`, color: preset.color, border: `1px solid ${preset.color}25` }}>
              {tag}
            </span>
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onCompare(); }}
          className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded transition-colors"
          style={{
            backgroundColor: isCompareTarget ? `${preset.color}25` : 'var(--surface-deep)',
            color: isCompareTarget ? preset.color : 'var(--text-muted)',
            border: `1px solid ${isCompareTarget ? preset.color + '50' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <ArrowLeftRight className="w-3 h-3" />
          {isCompareTarget ? 'Comparing' : 'Compare'}
        </button>
      </div>
    </motion.div>
  );
}

/* ── Comparison Row ───────────────────────────────────────────────────────── */

function ComparisonRow({ item, colorA, colorB }: { item: FeelComparison; colorA: string; colorB: string }) {
  const meta = FEEL_FIELD_META.find((f) => f.key === item.field);
  const range = meta ? meta.max - meta.min : 1;
  const barA = meta ? Math.min(((item.valueA - meta.min) / range) * 100, 100) : 50;
  const barB = meta ? Math.min(((item.valueB - meta.min) / range) * 100, 100) : 50;

  const fmt = (v: number) => {
    if (item.unit === '%') return `${(v * 100).toFixed(0)}%`;
    if (item.unit === 'x' || item.unit === 's') return v.toFixed(2);
    if (v % 1 !== 0) return v.toFixed(1);
    return String(v);
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface/20 transition-colors text-[10px] font-mono">
      <span className="text-text-muted w-28 truncate flex-shrink-0">{item.label}</span>
      <div className="flex-1 flex items-center gap-1">
        <span className="w-12 text-right font-bold" style={{ color: colorA }}>{fmt(item.valueA)}</span>
        <div className="flex-1 relative h-3">
          <div className="absolute inset-0 bg-surface-deep rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full rounded-full opacity-60"
              style={{ width: `${barA}%`, backgroundColor: colorA }} />
          </div>
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full rounded-full opacity-30 border-r-2"
              style={{ width: `${barB}%`, borderColor: colorB, backgroundColor: `${colorB}30` }} />
          </div>
        </div>
        <span className="w-12 font-bold" style={{ color: colorB }}>{fmt(item.valueB)}</span>
      </div>
      <span className="w-14 text-right flex-shrink-0" style={{
        color: item.delta > 0 ? STATUS_SUCCESS : item.delta < 0 ? STATUS_ERROR : 'var(--text-muted)',
      }}>
        {item.delta > 0 ? '+' : ''}{fmt(item.delta)}
      </span>
    </div>
  );
}

/* ── Parameter Details Panel ──────────────────────────────────────────────── */

function ParameterDetails({ preset }: { preset: FeelPreset }) {
  const [expandedCat, setExpandedCat] = useState<string | null>('Movement');

  const categories = useMemo(() => {
    const cats = new Map<string, typeof FEEL_FIELD_META>();
    for (const field of FEEL_FIELD_META) {
      const arr = cats.get(field.category) ?? [];
      arr.push(field);
      cats.set(field.category, arr);
    }
    return cats;
  }, []);

  return (
    <div className="space-y-1">
      {Array.from(categories.entries()).map(([cat, fields]) => {
        const isExpanded = expandedCat === cat;
        const catColor = CATEGORY_COLORS[cat];
        const CatIcon = CATEGORY_ICONS[cat];
        return (
          <div key={cat}>
            <button
              onClick={() => setExpandedCat(isExpanded ? null : cat)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface/30 transition-colors"
            >
              <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <ChevronRight className="w-3 h-3 text-text-muted" />
              </motion.div>
              {CatIcon && <CatIcon className="w-3.5 h-3.5" style={{ color: catColor }} />}
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: catColor }}>{cat}</span>
              <span className="text-[9px] font-mono text-text-muted ml-auto">{fields.length} params</span>
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pl-6 space-y-0.5 pb-1">
                    {fields.map((field) => {
                      const value = getNestedValue(preset.profile, field.key);
                      const ratKey = field.key.split('.').pop() ?? field.key;
                      const rationale = preset.rationale[ratKey] ?? preset.rationale[field.key];
                      const pct = ((value - field.min) / (field.max - field.min)) * 100;
                      const fmt = field.unit === '%' ? `${(value * 100).toFixed(0)}%`
                        : (field.unit === 'x' || field.unit === 's') ? value.toFixed(2)
                        : value % 1 !== 0 ? value.toFixed(1) : String(value);

                      return (
                        <div key={field.key} className="px-2 py-1 rounded hover:bg-surface/20 transition-colors group">
                          <div className="flex items-center gap-2 text-[10px] font-mono">
                            <span className="text-text-muted w-28 truncate flex-shrink-0">{field.label}</span>
                            <div className="flex-1 h-1.5 bg-surface-deep rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{
                                width: `${Math.min(Math.max(pct, 2), 100)}%`,
                                backgroundColor: preset.color,
                                boxShadow: `0 0 4px ${preset.color}60`,
                              }} />
                            </div>
                            <span className="font-bold w-14 text-right" style={{ color: preset.color }}>
                              {fmt}{field.unit && field.unit !== '%' ? ` ${field.unit}` : ''}
                            </span>
                          </div>
                          {rationale && (
                            <div className="text-[9px] text-text-muted mt-0.5 pl-0 opacity-0 group-hover:opacity-100 transition-opacity leading-relaxed">
                              {rationale}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */

interface CharacterFeelOptimizerProps {
  moduleId: SubModuleId;
}

export function CharacterFeelOptimizer({ moduleId }: CharacterFeelOptimizerProps) {
  const [selectedPreset, setSelectedPreset] = useState<FeelPreset>(FEEL_PRESETS[0]);
  const [comparePreset, setComparePreset] = useState<FeelPreset | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showComparison, setShowComparison] = useState(false);

  const { execute, isRunning } = useModuleCLI({
    moduleId,
    sessionKey: `feel-optimizer-${moduleId}`,
    label: 'Feel Optimizer',
    accentColor: ACCENT,
  });

  // Radar data
  const selectedRadar = useMemo(() => profileToRadar(selectedPreset.profile), [selectedPreset]);
  const compareRadar = useMemo(
    () => comparePreset ? profileToRadar(comparePreset.profile) : null,
    [comparePreset],
  );

  // A/B comparison
  const comparison = useMemo(
    () => comparePreset ? compareProfiles(selectedPreset.profile, comparePreset.profile) : null,
    [selectedPreset, comparePreset],
  );

  const comparisonByCategory = useMemo(() => {
    if (!comparison) return null;
    const map = new Map<string, FeelComparison[]>();
    for (const item of comparison) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return map;
  }, [comparison]);

  // Handle custom AI feel request
  const handleCustomGenerate = useCallback(() => {
    if (!customPrompt.trim() || isRunning) return;
    const prompt = buildFeelOptimizerPrompt(customPrompt.trim());
    const task = TaskFactory.askClaude(moduleId, prompt, `Feel: ${customPrompt.slice(0, 30)}`);
    execute(task);
  }, [customPrompt, isRunning, moduleId, execute]);

  // Handle applying a preset via CLI
  const handleApplyPreset = useCallback(() => {
    if (isRunning) return;
    const { profile } = selectedPreset;
    const prompt = `## Task: Apply Character Feel Preset — "${selectedPreset.name}"

Apply the following UPROPERTY values to ARPGCharacterBase to achieve a "${selectedPreset.name}" feel (${selectedPreset.genre}).

### Description
${selectedPreset.description}

### Parameter Values to Set

**Movement (UCharacterMovementComponent)**
- MaxWalkSpeed: ${profile.movement.maxWalkSpeed}
- MaxSprintSpeed: ${profile.movement.maxSprintSpeed} (custom UPROPERTY)
- MaxAcceleration: ${profile.movement.acceleration}
- BrakingDecelerationWalking: ${profile.movement.deceleration}
- RotationRate.Yaw: ${profile.movement.turnRate}
- AirControl: ${profile.movement.airControl}
- JumpZVelocity: ${profile.movement.jumpZVelocity}
- GravityScale: ${profile.movement.gravityScale}

**Combat (ARPGCharacterBase / AbilitySystem)**
- BaseDamage: ${profile.combat.baseDamage}
- AttackSpeed: ${profile.combat.attackSpeed}
- ComboWindowMs: ${profile.combat.comboWindowMs}
- HitReactionDuration: ${profile.combat.hitReactionDuration}
- CritChance: ${profile.combat.critChance}
- CritMultiplier: ${profile.combat.critMultiplier}
- AttackRange: ${profile.combat.attackRange}
- CleaveAngle: ${profile.combat.cleaveAngle}

**Dodge (GA_Dodge / ARPGCharacterBase)**
- DodgeDistance: ${profile.dodge.distance}
- DodgeDuration: ${profile.dodge.duration}
- IFrameStart: ${profile.dodge.iFrameStart}
- IFrameDuration: ${profile.dodge.iFrameDuration}
- DodgeCooldown: ${profile.dodge.cooldown}
- DodgeStaminaCost: ${profile.dodge.staminaCost}
- DodgeCancelWindowStart: ${profile.dodge.cancelWindowStart}
- DodgeCancelWindowEnd: ${profile.dodge.cancelWindowEnd}

**Camera (USpringArmComponent / CameraComponent)**
- TargetArmLength: ${profile.camera.armLength}
- CameraLagSpeed: ${profile.camera.lagSpeed}
- FieldOfView: ${profile.camera.fovBase}
- SprintFOVOffset: ${profile.camera.fovSprintOffset}
- SwayMaxRoll: ${profile.camera.swayMaxRoll}
- SwayMaxPitch: ${profile.camera.swayMaxPitch}
- SwayInterpSpeed: ${profile.camera.swayInterpSpeed}
- SocketOffset.Z: ${profile.camera.socketOffsetZ}

**Stamina**
- StaminaDrainPerSec: ${profile.staminaDrainPerSec}
- StaminaRegenPerSec: ${profile.staminaRegenPerSec}

### Instructions
1. Read ARPGCharacterBase.h and ARPGCharacterBase.cpp
2. Find or create each UPROPERTY listed above
3. Set the default values in the constructor
4. Ensure properties are in the correct UPROPERTY category for Blueprint exposure
5. Verify the code compiles`;

    const task = TaskFactory.askClaude(moduleId, prompt, `Apply: ${selectedPreset.name}`);
    execute(task);
  }, [isRunning, selectedPreset, moduleId, execute]);

  const handleSelectCompare = useCallback((preset: FeelPreset) => {
    setComparePreset((prev) => prev?.id === preset.id ? null : preset);
    setShowComparison(true);
  }, []);

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg relative overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT }} />
              <Sparkles className="w-4 h-4 relative z-10" style={{ color: ACCENT, filter: `drop-shadow(0 0 4px ${ACCENT}80)` }} />
            </div>
            <div>
              <span className="text-sm font-bold text-text tracking-wide">AI Feel Optimizer</span>
              <div className="text-[10px] text-text-muted">
                Genre-tuned UPROPERTY presets for ARPGCharacterBase
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-text-muted px-2 py-1 rounded bg-surface-deep border border-border/30">
              {FEEL_PRESETS.length} presets
            </span>
            <span className="text-[10px] font-mono text-text-muted px-2 py-1 rounded bg-surface-deep border border-border/30">
              {FEEL_FIELD_META.length} params
            </span>
          </div>
        </div>
      </SurfaceCard>

      {/* Custom Feel Input */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="mb-2">
          <SectionLabel icon={Wand2} label="Describe Your Feel" color={ACCENT_VIOLET} />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomGenerate()}
            placeholder="e.g., 'Dark Souls heavy but with faster dodges' or 'Hades snappy with more weight'"
            className="flex-1 text-xs font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-violet-500/50"
          />
          <button
            onClick={handleCustomGenerate}
            disabled={!customPrompt.trim() || isRunning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
            style={{
              backgroundColor: `${ACCENT_VIOLET}20`,
              color: ACCENT_VIOLET,
              border: `1px solid ${ACCENT_VIOLET}40`,
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isRunning ? 'Generating...' : 'Generate'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {['Dark Souls heavy', 'Hades snappy', 'Diablo 4 weighty', 'DMC5 stylish', 'Monster Hunter deliberate'].map((hint) => (
            <button
              key={hint}
              onClick={() => setCustomPrompt(hint)}
              className="text-[9px] font-mono px-2 py-1 rounded-full transition-colors hover:bg-surface/50"
              style={{
                backgroundColor: 'var(--surface-deep)',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {hint}
            </button>
          ))}
        </div>
      </SurfaceCard>

      {/* Presets Grid + Selected Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Preset Selector */}
        <SurfaceCard level={2} className="p-3">
          <div className="mb-2"><SectionLabel icon={Zap} label="Genre Presets" color={ACCENT_EMERALD} /></div>
          <div className="grid grid-cols-2 gap-2">
            {FEEL_PRESETS.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isSelected={selectedPreset.id === preset.id}
                isCompareTarget={comparePreset?.id === preset.id}
                onSelect={() => setSelectedPreset(preset)}
                onCompare={() => handleSelectCompare(preset)}
              />
            ))}
          </div>
        </SurfaceCard>

        {/* Selected Preset Radar + Apply */}
        <SurfaceCard level={2} className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel icon={Activity} label={`${selectedPreset.name} Profile`} color={selectedPreset.color} />
            <button
              onClick={handleApplyPreset}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
              style={{
                backgroundColor: `${STATUS_SUCCESS}20`,
                color: STATUS_SUCCESS,
                border: `1px solid ${STATUS_SUCCESS}40`,
              }}
            >
              <Play className="w-3 h-3" />
              {isRunning ? 'Applying...' : 'Apply via CLI'}
            </button>
          </div>

          {/* Radar chart */}
          <div className="flex justify-center mb-3">
            <RadarChart
              data={selectedRadar}
              size={200}
              accent={selectedPreset.color}
              overlays={compareRadar ? [{ data: compareRadar, color: comparePreset!.color, label: comparePreset!.name }] : undefined}
              showLabels
            />
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: selectedPreset.color }} />
              <span style={{ color: selectedPreset.color }}>{selectedPreset.name}</span>
            </div>
            {comparePreset && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: comparePreset.color }} />
                <span style={{ color: comparePreset.color }}>{comparePreset.name}</span>
              </div>
            )}
          </div>

          {/* Parameter details */}
          <ParameterDetails preset={selectedPreset} />
        </SurfaceCard>
      </div>

      {/* A/B Comparison Panel */}
      {comparePreset && (
        <SurfaceCard level={2} className="p-3 relative overflow-hidden">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="w-full flex items-center gap-2 mb-2"
          >
            <SectionLabel icon={ArrowLeftRight} label="A/B Comparison" color={ACCENT_CYAN} />
            <motion.div animate={{ rotate: showComparison ? 180 : 0 }} className="ml-auto">
              <ChevronDown className="w-4 h-4 text-text-muted" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showComparison && comparisonByCategory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center gap-2 px-2 py-1.5 mb-1 text-[10px] font-mono font-bold">
                  <span className="w-28 flex-shrink-0 text-text-muted">Parameter</span>
                  <div className="flex-1 flex items-center gap-1">
                    <span className="w-12 text-right" style={{ color: selectedPreset.color }}>{selectedPreset.name.split(' ')[0]}</span>
                    <span className="flex-1 text-center text-text-muted">Range</span>
                    <span className="w-12" style={{ color: comparePreset.color }}>{comparePreset.name.split(' ')[0]}</span>
                  </div>
                  <span className="w-14 text-right text-text-muted flex-shrink-0">Delta</span>
                </div>

                {/* Category groups */}
                {Array.from(comparisonByCategory.entries()).map(([cat, items]) => {
                  const catColor = CATEGORY_COLORS[cat];
                  return (
                    <div key={cat} className="mb-2">
                      <div className="text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1" style={{ color: catColor }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5" style={{ backgroundColor: catColor }} />
                        {cat}
                      </div>
                      {items.map((item) => (
                        <ComparisonRow
                          key={item.field}
                          item={item}
                          colorA={selectedPreset.color}
                          colorB={comparePreset.color}
                        />
                      ))}
                    </div>
                  );
                })}

                {/* Summary stats */}
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/30 px-2 text-[10px] font-mono text-text-muted">
                  <span>
                    Faster: <span className="font-bold" style={{ color: STATUS_SUCCESS }}>
                      {comparison!.filter((c) => c.category === 'Movement' && c.delta > 0).length}
                    </span> params
                  </span>
                  <span>
                    Slower: <span className="font-bold" style={{ color: STATUS_ERROR }}>
                      {comparison!.filter((c) => c.category === 'Movement' && c.delta < 0).length}
                    </span> params
                  </span>
                  <span>
                    Total changes: <span className="font-bold" style={{ color: STATUS_WARNING }}>
                      {comparison!.filter((c) => c.delta !== 0).length}
                    </span>/{comparison!.length}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SurfaceCard>
      )}
    </div>
  );
}

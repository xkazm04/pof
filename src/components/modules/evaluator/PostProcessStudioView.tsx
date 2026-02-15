'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Palette, Play, RefreshCw, Sun, Eye, Wind, Circle, Move,
  Aperture, ChevronDown, ChevronUp, GripVertical, Zap,
  Gauge, Layers, SplitSquareHorizontal, Camera, Cpu, Sparkles,
  AlertTriangle, Monitor, Film,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { usePostProcessStudioStore } from '@/stores/postProcessStudioStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import type {
  PPStudioEffect,
  PPStudioParam,
  PPPreset,
  PPResolution,
  GPUBudgetReport,
  GPUCostEstimate,
  ABSlot,
  PPStackSnapshot,
  PPEffectCategory,
} from '@/types/post-process-studio';

// ── Constants ───────────────────────────────────────────────────────────────

const ACCENT = '#a78bfa'; // Violet for PP studio

const CATEGORY_COLORS: Record<PPEffectCategory, string> = {
  lighting: '#fbbf24',
  color: '#a78bfa',
  blur: '#38bdf8',
  atmosphere: '#34d399',
  special: '#f472b6',
};

const EFFECT_ICONS: Record<string, typeof Sun> = {
  'bloom': Sun,
  'color-grading': Aperture,
  'depth-of-field': Eye,
  'ambient-occlusion': Circle,
  'motion-blur': Move,
  'vignette': Wind,
  'exposure': Gauge,
  'chromatic-aberration': Sparkles,
  'film-grain': Film,
  'fog': Layers,
};

const RESOLUTIONS: PPResolution[] = ['720p', '1080p', '1440p', '4K'];

// ── Main Component ──────────────────────────────────────────────────────────

export function PostProcessStudioView() {
  const effects = usePostProcessStudioStore((s) => s.effects);
  const presets = usePostProcessStudioStore((s) => s.presets);
  const activePresetId = usePostProcessStudioStore((s) => s.activePresetId);
  const resolution = usePostProcessStudioStore((s) => s.resolution);
  const budget = usePostProcessStudioStore((s) => s.budget);
  const compareMode = usePostProcessStudioStore((s) => s.compareMode);
  const snapshotA = usePostProcessStudioStore((s) => s.snapshotA);
  const snapshotB = usePostProcessStudioStore((s) => s.snapshotB);
  const activeSlot = usePostProcessStudioStore((s) => s.activeSlot);
  const isGenerating = usePostProcessStudioStore((s) => s.isGenerating);
  const error = usePostProcessStudioStore((s) => s.error);

  const init = usePostProcessStudioStore((s) => s.init);
  const setEffectEnabled = usePostProcessStudioStore((s) => s.setEffectEnabled);
  const setEffectParam = usePostProcessStudioStore((s) => s.setEffectParam);
  const moveEffect = usePostProcessStudioStore((s) => s.moveEffect);
  const applyPreset = usePostProcessStudioStore((s) => s.applyPreset);
  const resetToDefaults = usePostProcessStudioStore((s) => s.resetToDefaults);
  const setResolution = usePostProcessStudioStore((s) => s.setResolution);
  const toggleCompareMode = usePostProcessStudioStore((s) => s.toggleCompareMode);
  const captureSnapshot = usePostProcessStudioStore((s) => s.captureSnapshot);
  const setActiveSlot = usePostProcessStudioStore((s) => s.setActiveSlot);
  const loadSnapshot = usePostProcessStudioStore((s) => s.loadSnapshot);
  const generateCode = usePostProcessStudioStore((s) => s.generateCode);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (effects.length === 0) init();
  }, [effects.length, init]);

  const { execute, isRunning } = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'pp-studio-gen',
    label: 'PP Studio',
    accentColor: ACCENT,
  });

  const sortedEffects = useMemo(
    () => [...effects].sort((a, b) => a.priority - b.priority),
    [effects],
  );

  const enabledCount = useMemo(
    () => effects.filter((e) => e.enabled).length,
    [effects],
  );

  const handleGenerate = useCallback(async () => {
    const prompt = await generateCode();
    if (prompt) {
      execute({
        type: 'quick-action',
        moduleId: 'materials',
        prompt,
        label: 'Generate PP Volume',
      });
    }
  }, [generateCode, execute]);

  const budgetPct = budget ? Math.min((budget.totalCostMs / budget.budgetMs) * 100, 100) : 0;
  const budgetColor = budget
    ? budget.overBudget ? '#ef4444' : budget.totalCostMs > budget.budgetMs * 0.75 ? '#f59e0b' : '#10b981'
    : '#666';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}20, ${ACCENT}08)`,
              border: `1px solid ${ACCENT}30`,
            }}
          >
            <Palette className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-text">Post-Process Recipe Studio</h1>
            <p className="text-xs text-text-muted">
              Visual post-process stack with live parameter tuning and GPU budget
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Resolution selector */}
            <div className="flex items-center gap-1 bg-surface border border-border rounded-lg px-1 py-0.5">
              <Monitor className="w-3 h-3 text-text-muted ml-1" />
              {RESOLUTIONS.map((res) => (
                <button
                  key={res}
                  onClick={() => setResolution(res)}
                  className={`px-2 py-0.5 rounded text-2xs font-medium transition-colors ${
                    resolution === res
                      ? 'bg-violet-500/15 text-violet-400'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>

            {/* A/B Compare toggle */}
            <button
              onClick={toggleCompareMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                compareMode
                  ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400'
                  : 'bg-surface border-border text-text-muted hover:text-text'
              }`}
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5" />
              A/B
            </button>

            {/* Generate */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isRunning || enabledCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: `${ACCENT}15`,
                color: ACCENT,
                border: `1px solid ${ACCENT}40`,
              }}
            >
              {isGenerating || isRunning
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <Play className="w-3.5 h-3.5" />
              }
              {isGenerating ? 'Building...' : isRunning ? 'Generating...' : `Generate C++ (${enabledCount})`}
            </button>
          </div>
        </div>

        {/* GPU Budget Bar + Stats */}
        {budget && (
          <div className="flex gap-3 mb-1">
            <SurfaceCard className="flex items-center gap-2.5 px-3 py-2 flex-1" level={2}>
              <ProgressRing
                value={Math.round(budgetPct)}
                size={36}
                strokeWidth={3}
                color={budgetColor}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold" style={{ color: budgetColor }}>
                    {budget.totalCostMs.toFixed(2)}ms
                  </span>
                  <span className="text-2xs text-text-muted">
                    / {budget.budgetMs}ms PP budget
                  </span>
                  {budget.overBudget && (
                    <Badge variant="error">Over Budget</Badge>
                  )}
                </div>
                <div className="w-full h-1.5 bg-surface-deep rounded-full mt-1 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: budgetColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${budgetPct}%` }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            </SurfaceCard>

            <StatCard
              icon={<Cpu className="w-4 h-4 text-violet-400" />}
              value={`${enabledCount}/${effects.length}`}
              label="Active Effects"
              color="text-violet-400"
            />
            <StatCard
              icon={<Gauge className="w-4 h-4 text-cyan-400" />}
              value={resolution}
              label="Target Res"
              color="text-cyan-400"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="px-6 mb-2">
          <SurfaceCard className="p-3 border-status-red-strong">
            <p className="text-xs text-red-400">{error}</p>
          </SurfaceCard>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-5">
          {/* Presets */}
          <PresetGallery
            presets={presets}
            activePresetId={activePresetId}
            onApply={applyPreset}
            onReset={resetToDefaults}
          />

          {/* A/B Compare bar */}
          {compareMode && (
            <CompareBar
              snapshotA={snapshotA}
              snapshotB={snapshotB}
              activeSlot={activeSlot}
              onCapture={captureSnapshot}
              onSetSlot={setActiveSlot}
              onLoad={loadSnapshot}
            />
          )}

          {/* Main two-column: Effect stack + GPU breakdown */}
          <div className="grid grid-cols-3 gap-4">
            {/* Effect Stack — 2 cols */}
            <div className="col-span-2 space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4" style={{ color: ACCENT }} />
                <h2 className="text-sm font-medium text-text">Effect Stack</h2>
                <span className="text-2xs text-text-muted">
                  {enabledCount} enabled — ordered by priority
                </span>
              </div>

              <AnimatePresence initial={false}>
                {sortedEffects.map((effect, idx) => (
                  <motion.div
                    key={effect.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.12 }}
                  >
                    <EffectCard
                      effect={effect}
                      isFirst={idx === 0}
                      isLast={idx === sortedEffects.length - 1}
                      isExpanded={expandedId === effect.id}
                      onToggle={() => setEffectEnabled(effect.id, !effect.enabled)}
                      onMoveUp={() => moveEffect(effect.id, 'up')}
                      onMoveDown={() => moveEffect(effect.id, 'down')}
                      onExpand={() => setExpandedId(expandedId === effect.id ? null : effect.id)}
                      onParamChange={(name, val) => setEffectParam(effect.id, name, val)}
                      gpuCost={budget?.effects.find((e) => e.effectId === effect.id)?.costMs}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* GPU Breakdown — 1 col */}
            <div className="space-y-4">
              {budget && <GPUBreakdown budget={budget} />}
              {budget && <CostByCategory budget={budget} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Preset Gallery ──────────────────────────────────────────────────────────

function PresetGallery({
  presets,
  activePresetId,
  onApply,
  onReset,
}: {
  presets: PPPreset[];
  activePresetId: string | null;
  onApply: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Camera className="w-4 h-4" style={{ color: ACCENT }} />
        <h2 className="text-sm font-medium text-text">Cinematic Presets</h2>
        {activePresetId && (
          <button
            onClick={onReset}
            className="ml-auto text-2xs text-text-muted hover:text-text transition-colors"
          >
            Reset to defaults
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {presets.map((p) => {
          const isActive = p.id === activePresetId;
          return (
            <button
              key={p.id}
              onClick={() => onApply(p.id)}
              className={`group relative rounded-xl overflow-hidden border transition-all duration-base ${
                isActive
                  ? 'border-violet-500/50 ring-1 ring-violet-500/20'
                  : 'border-border hover:border-border-bright'
              }`}
            >
              {/* Gradient thumbnail */}
              <div
                className="h-14 w-full"
                style={{
                  background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})`,
                }}
              />
              <div className="px-2 py-1.5 bg-surface">
                <div className="text-2xs font-medium text-text truncate">{p.name}</div>
                <div className="text-2xs text-text-muted/60 truncate">{p.description}</div>
              </div>
              {isActive && (
                <div
                  className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Zap className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

// ── Effect Card ─────────────────────────────────────────────────────────────

function EffectCard({
  effect,
  isFirst,
  isLast,
  isExpanded,
  onToggle,
  onMoveUp,
  onMoveDown,
  onExpand,
  onParamChange,
  gpuCost,
}: {
  effect: PPStudioEffect;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onExpand: () => void;
  onParamChange: (paramName: string, value: number) => void;
  gpuCost?: number;
}) {
  const catColor = CATEGORY_COLORS[effect.category];
  const Icon = EFFECT_ICONS[effect.id] ?? Layers;

  return (
    <div
      className="rounded-xl border transition-all duration-base"
      style={{
        borderColor: isExpanded ? `${catColor}40` : effect.enabled ? `${catColor}20` : 'var(--border)',
        backgroundColor: isExpanded ? `${catColor}06` : effect.enabled ? `${catColor}04` : 'var(--surface-deep)',
        opacity: effect.enabled ? 1 : 0.55,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Reorder */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-0 text-text-muted hover:text-text transition-colors disabled:opacity-30"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <GripVertical className="w-3 h-3 text-border-bright" />
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-0 text-text-muted hover:text-text transition-colors disabled:opacity-30"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Toggle switch */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 w-8 h-4 rounded-full relative transition-colors"
          style={{ backgroundColor: effect.enabled ? `${catColor}40` : 'var(--border)' }}
        >
          <span
            className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
            style={{
              left: effect.enabled ? '17px' : '2px',
              backgroundColor: effect.enabled ? catColor : 'var(--text-muted)',
            }}
          />
        </button>

        {/* Icon */}
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${catColor}18, ${catColor}08)`,
            border: `1px solid ${catColor}20`,
          }}
        >
          <Icon className="w-3 h-3" style={{ color: catColor }} />
        </div>

        {/* Name + description */}
        <button onClick={onExpand} className="flex-1 min-w-0 text-left group">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-text">{effect.name}</span>
            <span className="text-2xs text-text-muted font-mono">{effect.priority + 1}</span>
            <span
              className="text-2xs px-1 py-0 rounded font-medium"
              style={{ backgroundColor: `${catColor}15`, color: `${catColor}cc` }}
            >
              {effect.category}
            </span>
          </div>
          <p className="text-2xs text-text-muted line-clamp-1">{effect.description}</p>
        </button>

        {/* GPU cost chip */}
        {effect.enabled && gpuCost !== undefined && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-deep text-2xs text-text-muted flex-shrink-0">
            <Cpu className="w-2.5 h-2.5" />
            {gpuCost.toFixed(2)}ms
          </div>
        )}

        {/* Expand arrow */}
        <button onClick={onExpand} className="flex-shrink-0 p-0.5">
          {isExpanded
            ? <ChevronUp className="w-3 h-3 text-text-muted" />
            : <ChevronDown className="w-3 h-3 text-text-muted" />
          }
        </button>
      </div>

      {/* Expanded params */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0">
              <div className="ml-[72px] space-y-2.5">
                <div className="text-2xs font-semibold text-text-muted uppercase tracking-widest mb-1">
                  UE: {effect.ueClass}
                </div>
                {effect.params.map((param) => (
                  <ParamSlider
                    key={param.name}
                    param={param}
                    color={catColor}
                    onChange={(val) => onParamChange(param.name, val)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Parameter Slider ────────────────────────────────────────────────────────

function ParamSlider({
  param,
  color,
  onChange,
}: {
  param: PPStudioParam;
  color: string;
  onChange: (value: number) => void;
}) {
  const isModified = param.value !== param.defaultValue;
  const pct = ((param.value - param.min) / (param.max - param.min)) * 100;

  return (
    <div className="px-2.5 py-2 rounded-lg bg-[#0a0a1e] border border-border">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs font-mono font-medium text-[#c0c4e0]">{param.name}</span>
          <span
            className="text-2xs px-1 py-0 rounded font-medium uppercase"
            style={{ backgroundColor: `${color}15`, color: `${color}cc` }}
          >
            {param.ueProperty}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isModified && (
            <button
              onClick={() => onChange(param.defaultValue)}
              className="text-2xs text-text-muted hover:text-text transition-colors"
            >
              Reset
            </button>
          )}
          <span className={`text-2xs font-mono ${isModified ? 'text-amber-400' : 'text-text-muted'}`}>
            {formatValue(param.value, param.step)}
          </span>
        </div>
      </div>
      <p className="text-2xs text-text-muted/60 mb-2">{param.description}</p>
      <div className="flex items-center gap-2">
        <span className="text-2xs text-text-muted w-10 text-right flex-shrink-0 font-mono">
          {formatValue(param.min, param.step)}
        </span>
        <div className="flex-1 relative h-4 flex items-center">
          {/* Track background */}
          <div className="absolute inset-x-0 h-1 bg-surface-deep rounded-full" />
          {/* Filled track */}
          <div
            className="absolute left-0 h-1 rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: `${color}60` }}
          />
          {/* Input */}
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={param.step}
            value={param.value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {/* Thumb indicator */}
          <div
            className="absolute w-3 h-3 rounded-full border-2 pointer-events-none transition-all"
            style={{
              left: `calc(${pct}% - 6px)`,
              backgroundColor: 'var(--surface)',
              borderColor: color,
            }}
          />
        </div>
        <span className="text-2xs text-text-muted w-10 flex-shrink-0 font-mono">
          {formatValue(param.max, param.step)}
        </span>
      </div>
    </div>
  );
}

// ── GPU Breakdown ───────────────────────────────────────────────────────────

function GPUBreakdown({ budget }: { budget: GPUBudgetReport }) {
  const sortedEffects = [...budget.effects].sort((a, b) => b.costMs - a.costMs);
  const maxCost = Math.max(...sortedEffects.map((e) => e.costMs), 0.01);

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-medium text-text">GPU Cost</h2>
        <span className="text-2xs text-text-muted">@ {budget.resolution}</span>
      </div>

      {sortedEffects.length === 0 ? (
        <p className="text-2xs text-text-muted">No effects enabled</p>
      ) : (
        <div className="space-y-1.5">
          {sortedEffects.map((e) => {
            const w = (e.costMs / maxCost) * 100;
            const catColor = CATEGORY_COLORS[e.category] ?? ACCENT;
            const isExpensive = e.costMs > budget.budgetMs * 0.3;
            return (
              <div key={e.effectId} className="flex items-center gap-2">
                <span className={`text-2xs w-24 truncate flex-shrink-0 ${isExpensive ? 'text-amber-400' : 'text-text-muted'}`}>
                  {e.effectName}
                </span>
                <div className="flex-1 h-2.5 bg-surface-deep rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-base"
                    style={{ width: `${w}%`, backgroundColor: `${catColor}60` }}
                  />
                </div>
                <span className={`text-2xs font-mono w-12 text-right flex-shrink-0 ${isExpensive ? 'text-amber-400' : 'text-text-muted'}`}>
                  {e.costMs.toFixed(2)}ms
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-1.5 border-t border-border">
            <span className="text-2xs font-medium text-text w-24 flex-shrink-0">Total</span>
            <div className="flex-1" />
            <span className={`text-xs font-mono font-semibold ${budget.overBudget ? 'text-red-400' : 'text-emerald-400'}`}>
              {budget.totalCostMs.toFixed(2)}ms
            </span>
          </div>
        </div>
      )}

      {budget.overBudget && (
        <div className="mt-3 flex items-start gap-2 px-2.5 py-2 rounded-lg bg-red-400/10 border border-red-400/20">
          <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-2xs text-red-300">
            PP stack exceeds {budget.budgetMs}ms budget for {budget.resolution}. Consider disabling expensive effects or reducing quality.
          </span>
        </div>
      )}
    </SurfaceCard>
  );
}

// ── Cost By Category ────────────────────────────────────────────────────────

function CostByCategory({ budget }: { budget: GPUBudgetReport }) {
  const categories = useMemo(() => {
    const map = new Map<PPEffectCategory, number>();
    for (const e of budget.effects) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.costMs);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, cost]) => ({ category: cat, cost }));
  }, [budget.effects]);

  if (categories.length === 0) return null;

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-medium text-text">By Category</h2>
      </div>
      <div className="space-y-2">
        {categories.map(({ category, cost }) => (
          <div key={category} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[category] }}
            />
            <span className="text-2xs text-text-muted capitalize flex-1">{category}</span>
            <span className="text-2xs font-mono text-text-muted">{cost.toFixed(2)}ms</span>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

// ── A/B Compare Bar ─────────────────────────────────────────────────────────

function CompareBar({
  snapshotA,
  snapshotB,
  activeSlot,
  onCapture,
  onSetSlot,
  onLoad,
}: {
  snapshotA: PPStackSnapshot | null;
  snapshotB: PPStackSnapshot | null;
  activeSlot: ABSlot;
  onCapture: (slot: ABSlot) => void;
  onSetSlot: (slot: ABSlot) => void;
  onLoad: (slot: ABSlot) => void;
}) {
  return (
    <SurfaceCard className="p-3">
      <div className="flex items-center gap-3">
        <SplitSquareHorizontal className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span className="text-xs font-medium text-text">A/B Compare</span>
        <div className="flex-1" />

        {/* Slot A */}
        <SlotChip
          label="A"
          snapshot={snapshotA}
          isActive={activeSlot === 'A'}
          onSelect={() => onSetSlot('A')}
          onCapture={() => onCapture('A')}
          onLoad={() => onLoad('A')}
        />

        <span className="text-2xs text-text-muted">vs</span>

        {/* Slot B */}
        <SlotChip
          label="B"
          snapshot={snapshotB}
          isActive={activeSlot === 'B'}
          onSelect={() => onSetSlot('B')}
          onCapture={() => onCapture('B')}
          onLoad={() => onLoad('B')}
        />
      </div>
    </SurfaceCard>
  );
}

function SlotChip({
  label,
  snapshot,
  isActive,
  onSelect,
  onCapture,
  onLoad,
}: {
  label: string;
  snapshot: PPStackSnapshot | null;
  isActive: boolean;
  onSelect: () => void;
  onCapture: () => void;
  onLoad: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onSelect}
        className={`px-2 py-1 rounded text-2xs font-semibold border transition-colors ${
          isActive
            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
            : 'bg-surface border-border text-text-muted hover:text-text'
        }`}
      >
        {label}
      </button>
      {snapshot ? (
        <div className="flex items-center gap-1">
          <span className="text-2xs text-text-muted truncate max-w-20">{snapshot.label}</span>
          <span className="text-2xs font-mono text-text-muted/60">{snapshot.totalGpuMs.toFixed(1)}ms</span>
          <button onClick={onLoad} className="text-2xs text-cyan-400 hover:text-cyan-300 transition-colors">
            Load
          </button>
          <button onClick={onCapture} className="text-2xs text-text-muted hover:text-text transition-colors">
            Update
          </button>
        </div>
      ) : (
        <button onClick={onCapture} className="text-2xs text-cyan-400 hover:text-cyan-300 transition-colors">
          Capture
        </button>
      )}
    </div>
  );
}

// ── Small Components ────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: {
  icon: React.ReactNode; value: string | number; label: string; color: string;
}) {
  return (
    <SurfaceCard className="flex items-center gap-2.5 px-3 py-2 flex-1" level={2}>
      {icon}
      <div>
        <div className={`text-sm font-semibold ${color}`}>{value}</div>
        <div className="text-2xs text-text-muted">{label}</div>
      </div>
    </SurfaceCard>
  );
}

function formatValue(v: number, step: number): string {
  if (step >= 1) return v.toFixed(0);
  if (step >= 0.1) return v.toFixed(1);
  if (step >= 0.01) return v.toFixed(2);
  return v.toFixed(3);
}

'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { usePostProcessStudioStore } from '@/stores/postProcessStudioStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { MODULE_COLORS, ACCENT_EMERALD_DARK, STATUS_NEUTRAL } from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import { ACCENT } from './constants';
import { StudioHeader } from './StudioHeader';
import { PresetGallery } from './PresetGallery';
import { CompareBar } from './CompareBar';
import { EffectCard } from './EffectCard';
import { GPUBreakdown } from './GPUBreakdown';
import { CostByCategory } from './CostByCategory';

export { EffectCard } from './EffectCard';
export { ParamSlider } from './ParamSlider';

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
  const explainMode = usePostProcessStudioStore((s) => s.explainMode);

  const init = usePostProcessStudioStore((s) => s.init);
  const toggleExplainMode = usePostProcessStudioStore((s) => s.toggleExplainMode);
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
    ? budget.overBudget ? MODULE_COLORS.evaluator : budget.totalCostMs > budget.budgetMs * 0.75 ? MODULE_COLORS.content : ACCENT_EMERALD_DARK
    : STATUS_NEUTRAL;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <StudioHeader
        effects={effects}
        resolution={resolution}
        setResolution={setResolution}
        explainMode={explainMode}
        toggleExplainMode={toggleExplainMode}
        compareMode={compareMode}
        toggleCompareMode={toggleCompareMode}
        handleGenerate={handleGenerate}
        isGenerating={isGenerating}
        isRunning={isRunning}
        enabledCount={enabledCount}
        budget={budget}
        budgetPct={budgetPct}
        budgetColor={budgetColor}
      />

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
                    transition={{ duration: MOTION.fast }}
                  >
                    <EffectCard
                      effect={effect}
                      isFirst={idx === 0}
                      isLast={idx === sortedEffects.length - 1}
                      isExpanded={expandedId === effect.id}
                      explainMode={explainMode}
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

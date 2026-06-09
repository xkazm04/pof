'use client';

import { useState, useMemo, useCallback } from 'react';
import { Zap, Activity, Play } from 'lucide-react';
import {
  ACCENT_EMERALD, STATUS_SUCCESS, STATUS_SUBDUED,
  withOpacity, OPACITY_12, OPACITY_25,
} from '@/lib/chart-colors';
import {
  FEEL_PRESETS,
  compareProfiles, profileToRadar,
  buildFeelOptimizerPrompt,
  type FeelPreset, type FeelComparison,
} from '@/lib/character-feel-optimizer';
import { resolveStack, countActiveLayers } from '@/lib/feel-adjustment-layers';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import type { SubModuleId } from '@/types/modules';
import { RadarChart } from '../../unique-tabs/_shared';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { PresetCard } from './PresetCard';
import { ParameterDetails } from './ParameterDetails';
import { ComparisonPanel } from './ComparisonPanel';
import { FeelInputPanel } from './FeelInputPanel';
import { FeelLayerStack } from './FeelLayerStack';
import { buildStackApplyPrompt } from './build-apply-prompt';
import { ACCENT } from './constants';

/* ── Main Component ──────────────────────────────────────────────────────── */

interface CharacterFeelOptimizerProps { moduleId: SubModuleId }

export function CharacterFeelOptimizer({ moduleId }: CharacterFeelOptimizerProps) {
  const baseFeelPresetId = useCharacterBlueprintStore((s) => s.baseFeelPresetId);
  const feelLayers = useCharacterBlueprintStore((s) => s.feelLayers);
  const setBaseFeelPreset = useCharacterBlueprintStore((s) => s.setBaseFeelPreset);

  const [comparePreset, setComparePreset] = useState<FeelPreset | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showComparison, setShowComparison] = useState(false);

  const { execute, isRunning } = useModuleCLI({
    moduleId,
    sessionKey: `feel-optimizer-${moduleId}`,
    label: 'Feel Optimizer',
    accentColor: ACCENT,
  });

  const basePreset = useMemo(
    () => FEEL_PRESETS.find((p) => p.id === baseFeelPresetId) ?? FEEL_PRESETS[0],
    [baseFeelPresetId],
  );
  const resolvedProfile = useMemo(
    () => resolveStack(basePreset.profile, feelLayers),
    [basePreset, feelLayers],
  );
  const activeLayerCount = useMemo(() => countActiveLayers(feelLayers), [feelLayers]);
  const hasLayers = activeLayerCount > 0;

  /** A FeelPreset whose profile is the resolved stack — feeds preset-shaped consumers. */
  const resolvedPreset = useMemo<FeelPreset>(() => ({
    ...basePreset,
    name: hasLayers ? `${basePreset.name} (resolved)` : basePreset.name,
    profile: resolvedProfile,
  }), [basePreset, resolvedProfile, hasLayers]);

  const resolvedRadar = useMemo(() => profileToRadar(resolvedProfile), [resolvedProfile]);
  const baseRadar = useMemo(() => profileToRadar(basePreset.profile), [basePreset]);
  const compareRadar = useMemo(
    () => comparePreset ? profileToRadar(comparePreset.profile) : null,
    [comparePreset],
  );

  const radarOverlays = useMemo(() => {
    const overlays: { data: { axis: string; value: number }[]; color: string; label: string }[] = [];
    // Show the unmodified base as a faint overlay so the stack's effect is visible.
    if (hasLayers) overlays.push({ data: baseRadar, color: STATUS_SUBDUED, label: 'Base' });
    if (compareRadar && comparePreset) overlays.push({ data: compareRadar, color: comparePreset.color, label: comparePreset.name });
    return overlays.length ? overlays : undefined;
  }, [hasLayers, baseRadar, compareRadar, comparePreset]);

  const comparison = useMemo(
    () => comparePreset ? compareProfiles(resolvedProfile, comparePreset.profile) : null,
    [resolvedProfile, comparePreset],
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

  const handleCustomGenerate = useCallback(() => {
    if (!customPrompt.trim() || isRunning) return;
    const prompt = buildFeelOptimizerPrompt(customPrompt.trim());
    const task = TaskFactory.askClaude(moduleId, prompt, `Feel: ${customPrompt.slice(0, 30)}`);
    execute(task);
  }, [customPrompt, isRunning, moduleId, execute]);

  const handleApplyResolved = useCallback(() => {
    if (isRunning) return;
    const prompt = buildStackApplyPrompt(basePreset, feelLayers, resolvedProfile);
    const label = `Apply: ${basePreset.name}${activeLayerCount ? ` +${activeLayerCount}` : ''}`;
    const task = TaskFactory.askClaude(moduleId, prompt, label);
    execute(task);
  }, [isRunning, basePreset, feelLayers, resolvedProfile, activeLayerCount, moduleId, execute]);

  const handleSelectCompare = useCallback((preset: FeelPreset) => {
    setComparePreset((prev) => prev?.id === preset.id ? null : preset);
    setShowComparison(true);
  }, []);

  return (
    <div className="space-y-4">
      <FeelInputPanel
        customPrompt={customPrompt}
        isRunning={isRunning}
        onPromptChange={setCustomPrompt}
        onGenerate={handleCustomGenerate}
      />

      {/* Presets + Stack (left) | Resolved Preview (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <BlueprintPanel color={ACCENT_EMERALD} className="p-3">
            <SectionHeader icon={Zap} label="Genre Presets" color={ACCENT_EMERALD} />
            <div className="grid grid-cols-2 gap-2">
              {FEEL_PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isSelected={basePreset.id === preset.id}
                  isCompareTarget={comparePreset?.id === preset.id}
                  onSelect={() => setBaseFeelPreset(preset.id)}
                  onCompare={() => handleSelectCompare(preset)}
                />
              ))}
            </div>
          </BlueprintPanel>

          <FeelLayerStack basePreset={basePreset} />
        </div>

        <BlueprintPanel color={basePreset.color} className="p-3">
          <div className="flex items-center justify-between mb-2">
            <SectionHeader
              icon={Activity}
              label={hasLayers ? `${basePreset.name} + ${activeLayerCount} — Resolved` : `${basePreset.name} Profile`}
              color={basePreset.color}
            />
            <button
              onClick={handleApplyResolved}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
              style={{
                backgroundColor: `${withOpacity(STATUS_SUCCESS, OPACITY_12)}`,
                color: STATUS_SUCCESS,
                border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_25)}`,
              }}
            >
              <Play className="w-3 h-3" />
              {isRunning ? 'Applying...' : 'Apply via CLI'}
            </button>
          </div>

          <div className="flex justify-center mb-3">
            <RadarChart
              data={resolvedRadar}
              size={200}
              accent={basePreset.color}
              overlays={radarOverlays}
              showLabels
            />
          </div>

          <div className="flex items-center justify-center gap-4 mb-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: basePreset.color }} />
              <span style={{ color: basePreset.color }}>{hasLayers ? 'Resolved' : basePreset.name}</span>
            </div>
            {hasLayers && (
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: STATUS_SUBDUED }} />
                <span style={{ color: STATUS_SUBDUED }}>Base</span>
              </div>
            )}
            {comparePreset && (
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: comparePreset.color }} />
                <span style={{ color: comparePreset.color }}>{comparePreset.name}</span>
              </div>
            )}
          </div>

          <ParameterDetails preset={resolvedPreset} />
        </BlueprintPanel>
      </div>

      {/* A/B Comparison Panel — resolved vs compare target */}
      {comparePreset && comparison && comparisonByCategory && (
        <ComparisonPanel
          selectedPreset={resolvedPreset}
          comparePreset={comparePreset}
          comparison={comparison}
          comparisonByCategory={comparisonByCategory}
          showComparison={showComparison}
          onToggle={() => setShowComparison(!showComparison)}
        />
      )}
    </div>
  );
}

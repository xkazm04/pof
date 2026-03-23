'use client';

import { useState, useMemo, useCallback } from 'react';
import { Zap, Activity, Play } from 'lucide-react';
import {
  ACCENT_EMERALD, STATUS_SUCCESS,
} from '@/lib/chart-colors';
import {
  FEEL_PRESETS,
  compareProfiles, profileToRadar,
  buildFeelOptimizerPrompt,
  type FeelPreset, type FeelComparison,
} from '@/lib/character-feel-optimizer';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import type { SubModuleId } from '@/types/modules';
import { RadarChart } from '../_shared';
import { BlueprintPanel, SectionHeader } from '../_design';
import { PresetCard } from './PresetCard';
import { ParameterDetails } from './ParameterDetails';
import { ComparisonPanel } from './ComparisonPanel';
import { FeelInputPanel } from './FeelInputPanel';
import { buildApplyPrompt } from './build-apply-prompt';
import { ACCENT } from './constants';

/* ── Main Component ──────────────────────────────────────────────────────── */

interface CharacterFeelOptimizerProps { moduleId: SubModuleId }

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

  const selectedRadar = useMemo(() => profileToRadar(selectedPreset.profile), [selectedPreset]);
  const compareRadar = useMemo(
    () => comparePreset ? profileToRadar(comparePreset.profile) : null,
    [comparePreset],
  );

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

  const handleCustomGenerate = useCallback(() => {
    if (!customPrompt.trim() || isRunning) return;
    const prompt = buildFeelOptimizerPrompt(customPrompt.trim());
    const task = TaskFactory.askClaude(moduleId, prompt, `Feel: ${customPrompt.slice(0, 30)}`);
    execute(task);
  }, [customPrompt, isRunning, moduleId, execute]);

  const handleApplyPreset = useCallback(() => {
    if (isRunning) return;
    const task = TaskFactory.askClaude(moduleId, buildApplyPrompt(selectedPreset), `Apply: ${selectedPreset.name}`);
    execute(task);
  }, [isRunning, selectedPreset, moduleId, execute]);

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

      {/* Presets Grid + Selected Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BlueprintPanel color={ACCENT_EMERALD} className="p-3">
          <SectionHeader icon={Zap} label="Genre Presets" color={ACCENT_EMERALD} />
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
        </BlueprintPanel>

        <BlueprintPanel color={selectedPreset.color} className="p-3">
          <div className="flex items-center justify-between mb-2">
            <SectionHeader icon={Activity} label={`${selectedPreset.name} Profile`} color={selectedPreset.color} />
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

          <div className="flex justify-center mb-3">
            <RadarChart
              data={selectedRadar}
              size={200}
              accent={selectedPreset.color}
              overlays={compareRadar ? [{ data: compareRadar, color: comparePreset!.color, label: comparePreset!.name }] : undefined}
              showLabels
            />
          </div>

          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: selectedPreset.color }} />
              <span style={{ color: selectedPreset.color }}>{selectedPreset.name}</span>
            </div>
            {comparePreset && (
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: comparePreset.color }} />
                <span style={{ color: comparePreset.color }}>{comparePreset.name}</span>
              </div>
            )}
          </div>

          <ParameterDetails preset={selectedPreset} />
        </BlueprintPanel>
      </div>

      {/* A/B Comparison Panel */}
      {comparePreset && comparison && comparisonByCategory && (
        <ComparisonPanel
          selectedPreset={selectedPreset}
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

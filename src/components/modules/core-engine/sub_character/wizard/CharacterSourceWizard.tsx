'use client';

import { useState, useCallback, useMemo } from 'react';
import { User, ArrowRight, Wand2, Eye } from 'lucide-react';
import {
  MODULE_COLORS, OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_50, withOpacity,
} from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory, type CharacterSource } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import {
  SOURCES, SOURCE_DEFAULTS, ENABLE_PROMPT, ASSET_LABELS, type SetupAssets,
} from './wizard-data';
import { Step, DispatchButton } from './WizardChrome';

const ACCENT = MODULE_COLORS.core;

/**
 * Character-source wizard (folder-02 §1).
 *
 * A 3-step, single-dispatch-per-step flow: choose+prepare a rigged character
 * source → wire mesh/skeleton/AnimBP via setup_characters_ue.py → verify the
 * character locomotes (the §6 agentic screenshot + Gemini humanoid check).
 */
export function CharacterSourceWizard({ moduleId }: { moduleId: SubModuleId }) {
  const [source, setSource] = useState<CharacterSource>('mannequin');
  const [assets, setAssets] = useState<SetupAssets>(SOURCE_DEFAULTS.mannequin);

  const { execute, isRunning } = useModuleCLI({
    moduleId,
    sessionKey: 'character-wizard',
    label: 'Character Wizard',
    accentColor: ACCENT,
  });

  const appOrigin = useMemo(() => getAppOrigin(), []);

  const pickSource = useCallback((s: CharacterSource) => {
    setSource(s);
    setAssets(SOURCE_DEFAULTS[s]);
  }, []);

  const setAsset = useCallback((key: keyof SetupAssets, value: string) => {
    setAssets((prev) => ({ ...prev, [key]: value }));
  }, []);

  const dispatchEnable = useCallback(() => {
    if (isRunning) return;
    execute(TaskFactory.quickAction(moduleId, ENABLE_PROMPT[source], 'Prepare Source'));
  }, [isRunning, execute, moduleId, source]);

  const dispatchWire = useCallback(() => {
    if (isRunning) return;
    execute(TaskFactory.characterSetup(moduleId, { source, ...assets }, appOrigin, 'Wire Character'));
  }, [isRunning, execute, moduleId, source, assets, appOrigin]);

  const dispatchVerify = useCallback(() => {
    if (isRunning) return;
    execute(TaskFactory.checklist(moduleId, 'ac-6', '', 'Verify Locomotes', appOrigin));
  }, [isRunning, execute, moduleId, appOrigin]);

  return (
    <div
      className="flex flex-col gap-4 p-4 rounded-xl"
      data-testid="pof-module-arpg-character-source-wizard"
      style={{ backgroundColor: withOpacity(ACCENT, OPACITY_8), border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
    >
      <div className="flex items-center gap-2">
        <User className="w-4 h-4" style={{ color: ACCENT }} />
        <h3 className="text-sm font-bold text-text">Character Source Wizard</h3>
      </div>

      {/* Step 1 — choose + prepare source */}
      <Step n={1} title="Choose & prepare a rigged source">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {SOURCES.map((s) => {
            const Icon = s.icon;
            const active = source === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSource(s.id)}
                className="flex flex-col gap-1 p-2.5 rounded-lg text-left transition-all hover:brightness-110"
                style={{
                  backgroundColor: withOpacity(ACCENT, active ? OPACITY_20 : OPACITY_8),
                  border: `1px solid ${withOpacity(ACCENT, active ? OPACITY_50 : OPACITY_12)}`,
                }}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-text">
                  <Icon className="w-3.5 h-3.5" style={{ color: ACCENT }} /> {s.label}
                </span>
                <span className="text-[11px] text-text-muted leading-snug">{s.blurb}</span>
              </button>
            );
          })}
        </div>
        <DispatchButton onClick={dispatchEnable} isRunning={isRunning} icon={Wand2} label="Prepare Source" />
      </Step>

      {/* Step 2 — wire mesh + skeleton + AnimBP */}
      <Step n={2} title="Wire mesh + skeleton + AnimBP">
        {(['playerMesh', 'enemyMesh', 'animBlueprint', 'enemyMaterial'] as const).map((key) => (
          <label key={key} className="flex flex-col gap-1 text-xs text-text-muted">
            <span>{ASSET_LABELS[key]}</span>
            <input
              aria-label={ASSET_LABELS[key]}
              value={assets[key]}
              onChange={(e) => setAsset(key, e.target.value)}
              spellCheck={false}
              className="px-2 py-1.5 rounded-lg font-mono text-xs bg-surface-deep/50 text-text outline-none"
              style={{ border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
            />
          </label>
        ))}
        <DispatchButton onClick={dispatchWire} isRunning={isRunning} icon={ArrowRight} label="Wire Characters" />
      </Step>

      {/* Step 3 — verify locomotes (§6 Gemini gate) */}
      <Step n={3} title="Verify the character locomotes">
        <p className="text-[11px] text-text-muted leading-relaxed">
          Launches the slice, screenshots it, and asks Gemini whether the character is a humanoid in a
          natural pose (not T-posed) and the enemy is visually distinct.
        </p>
        <DispatchButton onClick={dispatchVerify} isRunning={isRunning} icon={Eye} label="Verify Locomotes" />
      </Step>
    </div>
  );
}

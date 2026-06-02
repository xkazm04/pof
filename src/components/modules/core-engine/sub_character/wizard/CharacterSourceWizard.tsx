'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
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
import { Step, DispatchButton, StepRail, type WizardStepStatus } from './WizardChrome';

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

  // Per-step lifecycle. The three steps share one CLI session, so only one runs
  // at a time; activeStepRef records which step's dispatch is in flight so the
  // shared onComplete can attribute success/failure to the right step.
  const [steps, setSteps] = useState<WizardStepStatus[]>(['idle', 'idle', 'idle']);
  const activeStepRef = useRef<1 | 2 | 3 | null>(null);

  const markStep = useCallback((step: 1 | 2 | 3, status: WizardStepStatus) => {
    setSteps((prev) => prev.map((s, i) => (i === step - 1 ? status : s)));
  }, []);

  const handleComplete = useCallback((success: boolean) => {
    const step = activeStepRef.current;
    if (!step) return;
    markStep(step, success ? 'done' : 'error');
    activeStepRef.current = null;
  }, [markStep]);

  const { execute, isRunning } = useModuleCLI({
    moduleId,
    sessionKey: 'character-wizard',
    label: 'Character Wizard',
    accentColor: ACCENT,
    onComplete: handleComplete,
  });

  // A step is reachable once the prior step has completed, or once it has
  // already been started (so re-running an earlier step doesn't re-lock later
  // ones the user has already moved past). Step 1 is always reachable.
  const reachable = useCallback(
    (step: 1 | 2 | 3) => step === 1 || steps[step - 2] === 'done' || steps[step - 1] !== 'idle',
    [steps],
  );

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
    activeStepRef.current = 1;
    markStep(1, 'running');
    execute(TaskFactory.quickAction(moduleId, ENABLE_PROMPT[source], 'Prepare Source'));
  }, [isRunning, execute, moduleId, source, markStep]);

  const dispatchWire = useCallback(() => {
    if (isRunning) return;
    activeStepRef.current = 2;
    markStep(2, 'running');
    execute(TaskFactory.characterSetup(moduleId, { source, ...assets }, appOrigin, 'Wire Character'));
  }, [isRunning, execute, moduleId, source, assets, appOrigin, markStep]);

  const dispatchVerify = useCallback(() => {
    if (isRunning) return;
    activeStepRef.current = 3;
    markStep(3, 'running');
    execute(TaskFactory.checklist(moduleId, 'ac-6', '', 'Verify Locomotes', appOrigin));
  }, [isRunning, execute, moduleId, appOrigin, markStep]);

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

      <StepRail steps={steps} />

      {/* Step 1 — choose + prepare source */}
      <Step n={1} title="Choose & prepare a rigged source" status={steps[0]}>
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
      <Step n={2} title="Wire mesh + skeleton + AnimBP" status={steps[1]} locked={!reachable(2)}>
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
        <DispatchButton onClick={dispatchWire} isRunning={isRunning} disabled={!reachable(2)} icon={ArrowRight} label="Wire Characters" />
      </Step>

      {/* Step 3 — verify locomotes (§6 Gemini gate) */}
      <Step n={3} title="Verify the character locomotes" status={steps[2]} locked={!reachable(3)}>
        <p className="text-[11px] text-text-muted leading-relaxed">
          Launches the slice, screenshots it, and asks Gemini whether the character is a humanoid in a
          natural pose (not T-posed) and the enemy is visually distinct.
        </p>
        <DispatchButton onClick={dispatchVerify} isRunning={isRunning} disabled={!reachable(3)} icon={Eye} label="Verify Locomotes" />
      </Step>
    </div>
  );
}

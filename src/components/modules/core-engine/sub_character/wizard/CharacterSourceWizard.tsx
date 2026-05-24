'use client';

import { useState, useCallback, useMemo } from 'react';
import { User, Download, Boxes, Loader2, ArrowRight, Wand2, Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  MODULE_COLORS, OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_30, OPACITY_50, withOpacity,
} from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory, type CharacterSource } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import { UE_KNOWN_ASSETS, ENEMY_CONTRAST_MATERIALS } from '@/lib/knowledge/ue-known-assets';

const ACCENT = MODULE_COLORS.core;

const knownPath = (id: string) => UE_KNOWN_ASSETS.find((a) => a.id === id)?.path ?? '';
const ENEMY_RED = ENEMY_CONTRAST_MATERIALS.find((m) => m.isDefault)?.path ?? '/Game/VerticalSlice/M_EnemyRed';

interface SourceOption {
  id: CharacterSource;
  label: string;
  icon: LucideIcon;
  blurb: string;
}

const SOURCES: SourceOption[] = [
  { id: 'mannequin', label: 'UE Mannequin', icon: User, blurb: 'Free, no download — the MoverTests engine plugin. Fastest path.' },
  { id: 'mixamo', label: 'Mixamo', icon: Download, blurb: 'Manual FBX download + retarget. Library of attack/locomotion anims.' },
  { id: 'blender', label: 'Custom (Blender)', icon: Boxes, blurb: 'Procedural / authored mesh. Hardest — author at unit scale 1.0.' },
];

interface SetupAssets {
  playerMesh: string;
  enemyMesh: string;
  animBlueprint: string;
  enemyMaterial: string;
}

const SOURCE_DEFAULTS: Record<CharacterSource, SetupAssets> = {
  mannequin: {
    playerMesh: knownPath('skm-manny'),
    enemyMesh: knownPath('skm-manny-simple'),
    animBlueprint: knownPath('abp-manny'),
    enemyMaterial: ENEMY_RED,
  },
  mixamo: {
    playerMesh: '/Game/Characters/Mixamo/SK_Player',
    enemyMesh: '/Game/Characters/Mixamo/SK_Enemy',
    animBlueprint: '/Game/Characters/ABP_ARPGCharacter',
    enemyMaterial: ENEMY_RED,
  },
  blender: {
    playerMesh: '/Game/Characters/Custom/SK_Player',
    enemyMesh: '/Game/Characters/Custom/SK_Enemy',
    animBlueprint: '/Game/Characters/ABP_ARPGCharacter',
    enemyMaterial: ENEMY_RED,
  },
};

const ENABLE_PROMPT: Record<CharacterSource, string> = {
  mannequin: 'Prepare the UE Mannequin character source: enable the experimental MoverTests engine plugin in the .uproject if it is not already enabled, regenerate project files, and trigger an asset-registry rescan of the /MoverTests mount so SKM_Manny, SKM_Manny_Simple and ABP_Manny become referenceable (newly-enabled plugin content is invisible until rescanned). Confirm the asset paths resolve.',
  mixamo: 'Prepare the Mixamo character source: confirm the target skeleton (SK_Mannequin) exists, then use the Mixamo Import workflow (Animations module / mixamo_pipeline.py) to import + retarget the downloaded FBX animations. Report the resulting skeletal mesh + skeleton content paths.',
  blender: 'Prepare the Custom (Blender) character source: author/export the character mesh from Blender at unit scale 1.0 and import it into UE under /Game/Characters/Custom (import_uniform_scale = 1.0). Report the imported skeletal mesh + skeleton content paths.',
};

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
            <span>{LABELS[key]}</span>
            <input
              aria-label={LABELS[key]}
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

const LABELS: Record<keyof SetupAssets, string> = {
  playerMesh: 'Player skeletal mesh',
  enemyMesh: 'Enemy skeletal mesh',
  animBlueprint: 'Animation Blueprint',
  enemyMaterial: 'Enemy material (strong contrast)',
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="flex-shrink-0 w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold font-mono"
          style={{ backgroundColor: withOpacity(ACCENT, OPACITY_20), color: ACCENT }}
        >
          {n}
        </span>
        <span className="text-xs font-semibold text-text">{title}</span>
      </div>
      <div className="flex flex-col gap-2 pl-7">{children}</div>
    </div>
  );
}

function DispatchButton({ onClick, isRunning, icon: Icon, label }: { onClick: () => void; isRunning: boolean; icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isRunning}
      className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono cursor-pointer transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed w-fit"
      style={{ backgroundColor: withOpacity(ACCENT, OPACITY_12), border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}`, color: ACCENT }}
    >
      {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      <span>{label}</span>
    </button>
  );
}

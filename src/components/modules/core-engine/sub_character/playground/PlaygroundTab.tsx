'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_EMERALD, STATUS_SUCCESS,
  withOpacity, OPACITY_12, OPACITY_15, OPACITY_25,
} from '@/lib/chart-colors';
import { FEEL_PRESETS, type FeelPreset } from '@/lib/character-feel-optimizer';
import { resolveStack, countActiveLayers } from '@/lib/feel-adjustment-layers';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import type { SubModuleId } from '@/types/modules';
import { Tooltip } from '@/components/ui/Tooltip';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import {
  TrendingUp, Crosshair, Camera, Play, Pause, RotateCcw,
  Zap, ChevronDown, Layers, Upload,
} from 'lucide-react';

import type { CurvePoint, DerivedGenomeValues } from './types';
import { CURVE_COLORS, VALUE_RANGES } from './types';
import { derivedFromCurves } from './curve-math';
import { seedSignature, seedCurves, readCurves, writeCurves, type CurveSet } from './curve-session';
import { CurveEditor } from './CurveEditor';
import { StickFigurePreview } from './StickFigurePreview';
import { ValueRow } from './ValueRow';

const ACCENT = MODULE_COLORS.core;

/* ── CLI apply prompt ──────────────────────────────────────────────────────────
 * The playground derives eleven UPROPERTY values from the hand-tuned curves.
 * Only those eleven are stated — the rest of the feel profile is untouched here,
 * so the prompt must not imply the whole character was retuned. */

function buildCurveApplyPrompt(
  values: DerivedGenomeValues,
  baseName: string,
  activeLayerCount: number,
): string {
  const provenance = activeLayerCount > 0
    ? `"${baseName}" with ${activeLayerCount} adjustment layer${activeLayerCount === 1 ? '' : 's'} resolved on top, then hand-tuned in the Feel Playground curve editors.`
    : `"${baseName}", hand-tuned in the Feel Playground curve editors.`;

  return `## Task: Apply Hand-Tuned Character Feel Curves

Apply the UPROPERTY values below to ARPGCharacterBase. They were derived from ${provenance}

Only these eleven properties were tuned — leave every other feel property at its current value.

**Movement (UCharacterMovementComponent)**
- MaxWalkSpeed: ${values.maxWalkSpeed}
- MaxSprintSpeed: ${values.maxSprintSpeed} (custom UPROPERTY)
- MaxAcceleration: ${values.acceleration}
- BrakingDecelerationWalking: ${values.deceleration}

**Dodge (GA_Dodge / ARPGCharacterBase)**
- DodgeDistance: ${values.dodgeDistance}
- DodgeDuration: ${values.dodgeDuration}
- IFrameStart: ${values.iFrameStart}
- IFrameDuration: ${values.iFrameDuration}

**Camera (USpringArmComponent / CameraComponent)**
- TargetArmLength: ${values.armLength}
- CameraLagSpeed: ${values.lagSpeed}
- FieldOfView: ${values.fovBase}

### Instructions
1. Read ARPGCharacterBase.h and ARPGCharacterBase.cpp
2. Find or create each UPROPERTY listed above
3. Set the default values in the constructor
4. Ensure properties are in the correct UPROPERTY category for Blueprint exposure
5. Verify the code compiles`;
}

/* ── Main Playground Component ────────────────────────────────────────────── */

interface CharacterFeelPlaygroundProps { moduleId: SubModuleId }

export function CharacterFeelPlayground({ moduleId }: CharacterFeelPlaygroundProps) {
  // Base preset + adjustment-layer stack are shared with the AI Feel tab via the store.
  const activePreset = useCharacterBlueprintStore((s) => s.baseFeelPresetId);
  const feelLayers = useCharacterBlueprintStore((s) => s.feelLayers);
  const setBaseFeelPreset = useCharacterBlueprintStore((s) => s.setBaseFeelPreset);

  const [isPlaying, setIsPlaying] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);

  const { execute, isRunning } = useModuleCLI({
    moduleId,
    sessionKey: `feel-playground-${moduleId}`,
    label: 'Feel Playground',
    accentColor: ACCENT,
  });

  const preset = FEEL_PRESETS.find(p => p.id === activePreset) ?? FEEL_PRESETS[0];
  const activeLayerCount = countActiveLayers(feelLayers);

  // Curves seed from the RESOLVED feel (base preset + enabled layers), not the raw preset.
  const resolvedPreset = useMemo<FeelPreset>(
    () => ({ ...preset, profile: resolveStack(preset.profile, feelLayers) }),
    [preset, feelLayers],
  );

  /* Curve state, restored from the session cache when the seed is unchanged so
   * hand-tuned curves survive sub-tab navigation (this tab unmounts on switch). */
  const signature = seedSignature(preset.id, feelLayers);
  const [curves, setCurvesState] = useState<CurveSet>(
    () => readCurves(signature) ?? seedCurves(resolvedPreset),
  );

  /** Single write path — every curve edit is mirrored into the session cache. */
  const commitCurves = useCallback((next: CurveSet, sig: string) => {
    writeCurves(sig, next);
    setCurvesState(next);
  }, []);

  const setAccelPts = useCallback((accel: CurvePoint[]) => {
    commitCurves({ ...curves, accel }, signature);
  }, [commitCurves, curves, signature]);
  const setDodgePts = useCallback((dodge: CurvePoint[]) => {
    commitCurves({ ...curves, dodge }, signature);
  }, [commitCurves, curves, signature]);
  const setCameraPts = useCallback((camera: CurvePoint[]) => {
    commitCurves({ ...curves, camera }, signature);
  }, [commitCurves, curves, signature]);

  const handlePresetChange = useCallback((id: string) => {
    const p = FEEL_PRESETS.find(fp => fp.id === id);
    if (!p) return;
    setBaseFeelPreset(id);
    const rp: FeelPreset = { ...p, profile: resolveStack(p.profile, feelLayers) };
    commitCurves(seedCurves(rp), seedSignature(id, feelLayers));
    setPresetOpen(false);
  }, [feelLayers, setBaseFeelPreset, commitCurves]);

  const handleReset = useCallback(() => {
    commitCurves(seedCurves(resolvedPreset), signature);
  }, [resolvedPreset, commitCurves, signature]);

  const derived = useMemo(
    () => derivedFromCurves(curves.accel, curves.dodge, curves.camera),
    [curves],
  );

  const handleApply = useCallback(() => {
    if (isRunning) return;
    const prompt = buildCurveApplyPrompt(derived, preset.name, activeLayerCount);
    const task = TaskFactory.askClaude(
      moduleId,
      prompt,
      `Apply curves: ${preset.name}${activeLayerCount ? ` +${activeLayerCount}` : ''}`,
    );
    execute(task);
  }, [isRunning, derived, preset.name, activeLayerCount, moduleId, execute]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Toolbar: Preset selector + controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Preset dropdown */}
        <div className="relative">
          <button
            onClick={() => setPresetOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/40 bg-surface-deep/50 text-sm font-bold hover:border-border-bright transition-colors"
            style={{ color: preset.color }}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
            {preset.name}
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </button>
          {presetOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 mt-1 z-20 w-64 rounded-xl border border-border/60 bg-surface shadow-xl p-1.5 space-y-0.5"
            >
              {FEEL_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm font-bold transition-colors ${
                    p.id === activePreset ? 'bg-surface-deep border border-border/60' : 'hover:bg-surface-deep/50 border border-transparent'
                  }`}
                  style={{ color: p.id === activePreset ? p.color : 'var(--text)' }}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{p.name}</div>
                    <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{p.genre}</div>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Active adjustment-layer indicator (curves seed from the resolved stack) */}
        {activeLayerCount > 0 && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
            style={{ color: ACCENT_EMERALD, backgroundColor: withOpacity(ACCENT_EMERALD, OPACITY_15) }}
            title="Curves include the AI Feel adjustment-layer stack. Reset reseeds from the resolved feel."
          >
            <Layers className="w-3.5 h-3.5" />
            +{activeLayerCount} layer{activeLayerCount === 1 ? '' : 's'}
          </span>
        )}

        {/* Playback controls */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setIsPlaying(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 bg-surface-deep/50 text-sm font-bold text-text hover:border-border-bright transition-colors"
          >
            {isPlaying
              ? <><Pause className="w-3.5 h-3.5" /> Pause</>
              : <><Play className="w-3.5 h-3.5" /> Preview</>
            }
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 bg-surface-deep/50 text-sm font-bold text-text-muted hover:text-text hover:border-border-bright transition-colors"
            title="Reset curves to preset defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <Tooltip content="Sends the 11 derived UPROPERTY values below to the CLI to apply to ARPGCharacterBase">
            <button
              onClick={handleApply}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40 focus-ring"
              style={{
                backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_12),
                color: STATUS_SUCCESS,
                border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_25)}`,
              }}
            >
              <Upload className="w-3.5 h-3.5" />
              {isRunning ? 'Applying...' : 'Apply via CLI'}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Stick figure preview */}
      <BlueprintPanel className="p-3">
        <SectionHeader label="Movement Preview" color={ACCENT} icon={Zap} />
        <StickFigurePreview values={derived} isPlaying={isPlaying} />
      </BlueprintPanel>

      {/* Curve editors row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CurveEditor
          label="Acceleration Curve" icon={TrendingUp} color={CURVE_COLORS.accel}
          points={curves.accel} onChange={setAccelPts}
          xLabel="Time (normalized)" yLabel="Speed"
        />
        <CurveEditor
          label="Dodge Trajectory" icon={Crosshair} color={CURVE_COLORS.dodge}
          points={curves.dodge} onChange={setDodgePts}
          xLabel="Dodge Phase" yLabel="Velocity"
        />
        <CurveEditor
          label="Camera Lag Response" icon={Camera} color={CURVE_COLORS.camera}
          points={curves.camera} onChange={setCameraPts}
          xLabel="Input Delta" yLabel="Camera Response"
        />
      </div>

      {/* Live derived values panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BlueprintPanel className="p-3 space-y-2">
          <SectionHeader label="Movement Values" color={CURVE_COLORS.accel} icon={TrendingUp} />
          <ValueRow label="Max Walk Speed" value={derived.maxWalkSpeed} unit=" cm/s"
            color={CURVE_COLORS.accel} min={VALUE_RANGES.maxWalkSpeed[0]} max={VALUE_RANGES.maxWalkSpeed[1]} />
          <ValueRow label="Max Sprint Speed" value={derived.maxSprintSpeed} unit=" cm/s"
            color={CURVE_COLORS.accel} min={VALUE_RANGES.maxSprintSpeed[0]} max={VALUE_RANGES.maxSprintSpeed[1]} />
          <ValueRow label="Acceleration" value={derived.acceleration} unit={' cm/s\u00B2'}
            color={CURVE_COLORS.accel} min={VALUE_RANGES.acceleration[0]} max={VALUE_RANGES.acceleration[1]} />
          <ValueRow label="Deceleration" value={derived.deceleration} unit={' cm/s\u00B2'}
            color={CURVE_COLORS.accel} min={VALUE_RANGES.deceleration[0]} max={VALUE_RANGES.deceleration[1]} />
        </BlueprintPanel>

        <BlueprintPanel className="p-3 space-y-2">
          <SectionHeader label="Dodge Values" color={CURVE_COLORS.dodge} icon={Crosshair} />
          <ValueRow label="Dodge Distance" value={derived.dodgeDistance} unit=" cm"
            color={CURVE_COLORS.dodge} min={VALUE_RANGES.dodgeDistance[0]} max={VALUE_RANGES.dodgeDistance[1]} />
          <ValueRow label="Dodge Duration" value={derived.dodgeDuration} unit="s"
            color={CURVE_COLORS.dodge} min={VALUE_RANGES.dodgeDuration[0]} max={VALUE_RANGES.dodgeDuration[1]} />
          <ValueRow label="I-Frame Start" value={derived.iFrameStart} unit="s"
            color={CURVE_COLORS.dodge} min={VALUE_RANGES.iFrameStart[0]} max={VALUE_RANGES.iFrameStart[1]} />
          <ValueRow label="I-Frame Duration" value={derived.iFrameDuration} unit="s"
            color={CURVE_COLORS.dodge} min={VALUE_RANGES.iFrameDuration[0]} max={VALUE_RANGES.iFrameDuration[1]} />
        </BlueprintPanel>

        <BlueprintPanel className="p-3 space-y-2">
          <SectionHeader label="Camera Values" color={CURVE_COLORS.camera} icon={Camera} />
          <ValueRow label="Arm Length" value={derived.armLength} unit=" cm"
            color={CURVE_COLORS.camera} min={VALUE_RANGES.armLength[0]} max={VALUE_RANGES.armLength[1]} />
          <ValueRow label="Lag Speed" value={derived.lagSpeed} unit=""
            color={CURVE_COLORS.camera} min={VALUE_RANGES.lagSpeed[0]} max={VALUE_RANGES.lagSpeed[1]} />
          <ValueRow label="FOV Base" value={derived.fovBase} unit={'\u00B0'}
            color={CURVE_COLORS.camera} min={VALUE_RANGES.fovBase[0]} max={VALUE_RANGES.fovBase[1]} />
        </BlueprintPanel>
      </div>

      {/* Hint */}
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center opacity-60">
        Drag the control points on the curves above to tune character feel. Values update live and survive sub-tab
        navigation; Apply via CLI writes them to ARPGCharacterBase. Switching preset or changing the layer stack reseeds the curves.
      </div>
    </motion.div>
  );
}

'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_EMERALD, STATUS_SUCCESS,
  withOpacity, OPACITY_12, OPACITY_15, OPACITY_25,
} from '@/lib/chart-colors';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import { resolveStack, countActiveLayers } from '@/lib/feel-adjustment-layers';
import {
  CURVE_CHANNELS, PLAYGROUND_LAYER_ID, boundIndices, decodeCurves, encodeCurves,
  type CurveId, type CurvePoint,
} from '@/lib/character/feel-curve-codec';
import { buildStackApplyPrompt } from '@/components/modules/core-engine/sub_character/ai-feel/build-apply-prompt';
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

import { CURVE_COLORS } from './types';
import { CurveEditor } from './CurveEditor';
import { StickFigurePreview } from './StickFigurePreview';
import { ValueRow } from './ValueRow';

const ACCENT = MODULE_COLORS.core;

/* One Apply path: the Playground dispatches `buildStackApplyPrompt` over the
 * resolved stack exactly like AI Feel, so curve edits (a reserved layer in that
 * stack) and every other layer reach UE through the same prompt. */

const VALUE_PANELS: ReadonlyArray<{ curve: CurveId; label: string; icon: typeof TrendingUp }> = [
  { curve: 'accel', label: 'Movement Values', icon: TrendingUp },
  { curve: 'dodge', label: 'Dodge Values', icon: Crosshair },
  { curve: 'camera', label: 'Camera Values', icon: Camera },
];

function unitSuffix(unit: string): string {
  return unit === '' || unit === 's' ? unit : ` ${unit}`;
}

/* ── Main Playground Component ────────────────────────────────────────────── */

interface CharacterFeelPlaygroundProps { moduleId: SubModuleId }

export function CharacterFeelPlayground({ moduleId }: CharacterFeelPlaygroundProps) {
  // Base preset + adjustment-layer stack are shared with the AI Feel tab via the store.
  const activePreset = useCharacterBlueprintStore((s) => s.baseFeelPresetId);
  const feelLayers = useCharacterBlueprintStore((s) => s.feelLayers);
  const setBaseFeelPreset = useCharacterBlueprintStore((s) => s.setBaseFeelPreset);
  const applyPlaygroundCurve = useCharacterBlueprintStore((s) => s.applyPlaygroundCurve);
  const clearPlaygroundCurves = useCharacterBlueprintStore((s) => s.clearPlaygroundCurves);

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
  const hasCurveEdits = feelLayers.some((l) => l.id === PLAYGROUND_LAYER_ID);

  /* Curves are not state: they are the codec's encoding of the RESOLVED stack
   * (base preset + enabled layers, incl. the reserved 'Playground curves' layer).
   * A drag writes `set` modifiers into that layer; the handle then re-derives
   * from the stack, so an unbound coordinate snaps back to its shape. */
  const resolved = useMemo(() => resolveStack(preset.profile, feelLayers), [preset, feelLayers]);
  const curves = useMemo(() => encodeCurves(resolved), [resolved]);
  const values = useMemo(() => decodeCurves(curves), [curves]);

  const setAccelPts = useCallback((pts: CurvePoint[]) => applyPlaygroundCurve('accel', pts), [applyPlaygroundCurve]);
  const setDodgePts = useCallback((pts: CurvePoint[]) => applyPlaygroundCurve('dodge', pts), [applyPlaygroundCurve]);
  const setCameraPts = useCallback((pts: CurvePoint[]) => applyPlaygroundCurve('camera', pts), [applyPlaygroundCurve]);

  const handlePresetChange = useCallback((id: string) => {
    setBaseFeelPreset(id);
    setPresetOpen(false);
  }, [setBaseFeelPreset]);

  const handleApply = useCallback(() => {
    if (isRunning) return;
    const prompt = buildStackApplyPrompt(preset, feelLayers, resolved);
    const task = TaskFactory.askClaude(
      moduleId,
      prompt,
      `Apply: ${preset.name}${activeLayerCount ? ` +${activeLayerCount}` : ''}`,
    );
    execute(task);
  }, [isRunning, preset, feelLayers, resolved, activeLayerCount, moduleId, execute]);

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
            title="Curves show the resolved feel stack (AI Feel layers plus the Playground curves layer)."
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
            onClick={clearPlaygroundCurves}
            disabled={!hasCurveEdits}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 bg-surface-deep/50 text-sm font-bold text-text-muted hover:text-text hover:border-border-bright transition-colors disabled:opacity-40"
            title={hasCurveEdits ? 'Remove the Playground curves layer from the feel stack' : 'No curve edits in the feel stack'}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <Tooltip content="Sends the resolved feel stack (the same prompt as AI Feel's Apply) to the CLI to apply to ARPGCharacterBase">
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
        <StickFigurePreview values={values} isPlaying={isPlaying} />
      </BlueprintPanel>

      {/* Curve editors row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CurveEditor
          label="Acceleration Curve" icon={TrendingUp} color={CURVE_COLORS.accel}
          points={curves.accel} onChange={setAccelPts} draggableIndices={boundIndices('accel')}
          xLabel="Time (normalized)" yLabel="Speed"
        />
        <CurveEditor
          label="Dodge Trajectory" icon={Crosshair} color={CURVE_COLORS.dodge}
          points={curves.dodge} onChange={setDodgePts} draggableIndices={boundIndices('dodge')}
          xLabel="Dodge Phase" yLabel="Velocity"
        />
        <CurveEditor
          label="Camera Lag Response" icon={Camera} color={CURVE_COLORS.camera}
          points={curves.camera} onChange={setCameraPts} draggableIndices={boundIndices('camera')}
          xLabel="Input Delta" yLabel="Camera Response"
        />
      </div>

      {/* Live values panel — one row per codec channel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {VALUE_PANELS.map(({ curve, label, icon }) => (
          <BlueprintPanel key={curve} className="p-3 space-y-2">
            <SectionHeader label={label} color={CURVE_COLORS[curve]} icon={icon} />
            {CURVE_CHANNELS.filter((ch) => ch.curve === curve).map((ch) => (
              <ValueRow key={ch.field} label={ch.label} value={values[ch.field]} unit={unitSuffix(ch.unit)}
                color={CURVE_COLORS[curve]} min={ch.min} max={ch.max} />
            ))}
          </BlueprintPanel>
        ))}
      </div>

      {/* Hint */}
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center opacity-60">
        Drag a handle to set its value in the persisted feel stack (the Playground curves layer); every tab and
        Apply via CLI read the same resolved stack. Reset removes the Playground curves layer.
      </div>
    </motion.div>
  );
}

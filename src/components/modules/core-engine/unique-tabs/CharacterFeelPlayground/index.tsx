'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import { BlueprintPanel, SectionHeader } from '../_design';
import {
  TrendingUp, Crosshair, Camera, Play, Pause, RotateCcw,
  Zap, ChevronDown,
} from 'lucide-react';

import type { CurvePoint } from './types';
import { CURVE_COLORS, VALUE_RANGES } from './types';
import { presetToAccelCurve, presetToDodgeCurve, presetToCameraCurve, derivedFromCurves } from './curve-math';
import { CurveEditor } from './CurveEditor';
import { StickFigurePreview } from './StickFigurePreview';
import { ValueRow } from './ValueRow';

const ACCENT = MODULE_COLORS.core;

/* ── Main Playground Component ────────────────────────────────────────────── */

export function CharacterFeelPlayground() {
  const [activePreset, setActivePreset] = useState<string>(FEEL_PRESETS[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);

  const preset = FEEL_PRESETS.find(p => p.id === activePreset) ?? FEEL_PRESETS[0];

  // Curve state
  const [accelPts, setAccelPts] = useState<CurvePoint[]>(() => presetToAccelCurve(preset));
  const [dodgePts, setDodgePts] = useState<CurvePoint[]>(() => presetToDodgeCurve(preset));
  const [cameraPts, setCameraPts] = useState<CurvePoint[]>(() => presetToCameraCurve(preset));

  const handlePresetChange = useCallback((id: string) => {
    const p = FEEL_PRESETS.find(fp => fp.id === id);
    if (!p) return;
    setActivePreset(id);
    setAccelPts(presetToAccelCurve(p));
    setDodgePts(presetToDodgeCurve(p));
    setCameraPts(presetToCameraCurve(p));
    setPresetOpen(false);
  }, []);

  const handleReset = useCallback(() => {
    setAccelPts(presetToAccelCurve(preset));
    setDodgePts(presetToDodgeCurve(preset));
    setCameraPts(presetToCameraCurve(preset));
  }, [preset]);

  const derived = useMemo(
    () => derivedFromCurves(accelPts, dodgePts, cameraPts),
    [accelPts, dodgePts, cameraPts],
  );

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
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">{p.genre}</div>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </div>

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
          points={accelPts} onChange={setAccelPts}
          xLabel="Time (normalized)" yLabel="Speed"
        />
        <CurveEditor
          label="Dodge Trajectory" icon={Crosshair} color={CURVE_COLORS.dodge}
          points={dodgePts} onChange={setDodgePts}
          xLabel="Dodge Phase" yLabel="Velocity"
        />
        <CurveEditor
          label="Camera Lag Response" icon={Camera} color={CURVE_COLORS.camera}
          points={cameraPts} onChange={setCameraPts}
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
          <ValueRow label="Acceleration" value={derived.acceleration} unit=" cm/s\u00B2"
            color={CURVE_COLORS.accel} min={VALUE_RANGES.acceleration[0]} max={VALUE_RANGES.acceleration[1]} />
          <ValueRow label="Deceleration" value={derived.deceleration} unit=" cm/s\u00B2"
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
          <ValueRow label="FOV Base" value={derived.fovBase} unit="\u00B0"
            color={CURVE_COLORS.camera} min={VALUE_RANGES.fovBase[0]} max={VALUE_RANGES.fovBase[1]} />
        </BlueprintPanel>
      </div>

      {/* Hint */}
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted text-center opacity-60">
        Drag the control points on the curves above to tune character feel. Values update live. Use presets as starting points.
      </div>
    </motion.div>
  );
}

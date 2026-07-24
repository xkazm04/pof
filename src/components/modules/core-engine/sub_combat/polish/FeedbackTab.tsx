'use client';

import { useState, useMemo, useCallback } from 'react';
import { Gauge, Timer, TrendingUp, Vibrate, Sparkles, Volume2, Download, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { buildCombatFeelPython } from './combat-feel-export';
import {
  STATUS_ERROR, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE,
  withOpacity, OPACITY_25, OPACITY_8, OPACITY_50, GLOW_MD,
} from '@/lib/chart-colors';
import { FOCUS_RING_CLASS, focusRingStyle } from '@/lib/ui/focus-ring';
import { TimelineStrip } from '../../unique-tabs/_shared';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import {
  ACCENT, FEEDBACK_PARAMS, FEEDBACK_PRESETS, FEEDBACK_CATEGORIES,
  HITSTOP_ABILITIES, MAX_HITSTOP,
  STAGGER_TIMELINE, STAGGER_CONFIG,
} from '../_shared/data';
import type { FeedbackPreset, FeedbackCategory } from '../_shared/data';

const CATEGORY_ICONS: Record<FeedbackCategory, typeof Gauge> = {
  Shake: Vibrate,
  Hitstop: Timer,
  Particles: Sparkles,
  Sound: Volume2,
};

/** Displayed value string for a param — also used as the slider's aria-valuetext. */
function formatParamValue(value: number, step: number, unit: string): string {
  return `${value.toFixed(step < 0.01 ? 3 : 2)}${unit}`;
}

/** Spoken value: expand the terse unit suffixes so a slider doesn't announce "0.05 s". */
function paramValueText(value: number, step: number, unit: string): string {
  const num = value.toFixed(step < 0.01 ? 3 : 2);
  if (unit === 's') return `${num} seconds`;
  if (unit === 'x') return `${num} times`;
  return num;
}

/** The preset whose values exactly match the current tuner state, if any. */
function matchingPreset(values: Record<string, number>): string | null {
  const hit = FEEDBACK_PRESETS.find(p => FEEDBACK_PARAMS.every(param => values[param.id] === p.values[param.id]));
  return hit?.name ?? null;
}

interface FeedbackTabProps {
  feedbackValues: Record<string, number>;
  juiceLevel: number;
  onPreset: (preset: FeedbackPreset) => void;
  onParam: (id: string, value: number) => void;
}

export function FeedbackTab({ feedbackValues, juiceLevel, onPreset, onParam }: FeedbackTabProps) {
  const juiceColor = juiceLevel < 0.33 ? ACCENT_CYAN : juiceLevel < 0.66 ? ACCENT_EMERALD : ACCENT_ORANGE;

  const [copied, setCopied] = useState(false);
  /* The range inputs are transparent overlays on the NeonBar, so their own
     focus ring is invisible — track focus and draw it on the bar wrapper. */
  const [focusedParam, setFocusedParam] = useState<string | null>(null);
  const activePreset = useMemo(() => matchingPreset(feedbackValues), [feedbackValues]);
  const feelScript = useMemo(() => buildCombatFeelPython(feedbackValues), [feedbackValues]);
  const copyFeel = useCallback(() => {
    void navigator.clipboard?.writeText(feelScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [feelScript]);

  return (
    <motion.div key="feedback" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Feedback Intensity Tuner */}
        <BlueprintPanel color={ACCENT} className="p-3">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader label="Feedback Intensity Tuner" color={ACCENT} icon={Gauge} />
            <div className="flex gap-1.5" role="group" aria-label="Feedback presets">
              {FEEDBACK_PRESETS.map((preset) => {
                const isActive = activePreset === preset.name;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => onPreset(preset)}
                    aria-pressed={isActive}
                    className={`text-xs font-mono uppercase tracking-[0.15em] font-bold px-2 py-0.5 rounded border transition-colors hover:brightness-125 cursor-pointer ${FOCUS_RING_CLASS} ${isActive ? '' : 'opacity-60'}`}
                    style={{
                      ...focusRingStyle(preset.color),
                      color: preset.color,
                      borderColor: withOpacity(preset.color, isActive ? OPACITY_50 : OPACITY_25),
                      backgroundColor: withOpacity(preset.color, isActive ? OPACITY_25 : OPACITY_8),
                    }}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-5">
            {FEEDBACK_CATEGORIES.map(cat => {
              const catParams = FEEDBACK_PARAMS.filter(p => p.category === cat);
              const CatIcon = CATEGORY_ICONS[cat];
              return (
                <div key={cat} role="group" aria-label={`${cat} feedback parameters`}>
                  <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-border/20">
                    <CatIcon aria-hidden className="w-3 h-3" style={{ color: ACCENT, opacity: 0.6 }} />
                    <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">{cat}</span>
                  </div>
                  <div className="space-y-3 ml-4">
                    {catParams.map((param) => {
                      const val = feedbackValues[param.id];
                      const pct = ((val - param.min) / (param.max - param.min)) * 100;
                      return (
                        <div key={param.id} className="flex items-center gap-3">
                          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-[100px] flex-shrink-0 truncate">{param.label}</span>
                          <div
                            className="flex-1 relative rounded"
                            style={focusedParam === param.id ? { outline: `2px solid ${ACCENT}`, outlineOffset: 2 } : undefined}
                          >
                            <NeonBar pct={pct} color={ACCENT} />
                            <input
                              type="range"
                              min={param.min}
                              max={param.max}
                              step={param.step}
                              value={val}
                              aria-label={`${cat} ${param.label}`}
                              aria-valuetext={paramValueText(val, param.step, param.unit)}
                              onChange={(e) => onParam(param.id, parseFloat(e.target.value))}
                              onFocus={() => setFocusedParam(param.id)}
                              onBlur={() => setFocusedParam(prev => (prev === param.id ? null : prev))}
                              className="absolute inset-0 w-full opacity-0 cursor-pointer"
                            />
                          </div>
                          <span className="text-2xs font-mono font-bold w-[50px] text-right" style={{ color: ACCENT }}>
                            {formatParamValue(val, param.step, param.unit)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Juice Level</span>
              <div className="flex-1">
                <NeonBar pct={juiceLevel * 100} color={juiceColor} height={10} glow />
              </div>
              <span className="text-xs font-mono font-bold" style={{ color: juiceColor }}>
                {(juiceLevel * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </BlueprintPanel>

        <div className="space-y-4">
          {/* Hitstop Timing */}
          <BlueprintPanel color={ACCENT} className="p-3">
            <SectionHeader label="Hitstop Timing Configurations" color={ACCENT} icon={Timer} />
            <div className="mt-3 space-y-3">
              {HITSTOP_ABILITIES.map((ability, idx) => (
                <motion.div key={ability.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }} className="flex items-center gap-3">
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-[100px] flex-shrink-0">{ability.name}</span>
                  <div className="flex-1 h-2 rounded-full border border-border/20 bg-surface-deep relative">
                    <div className="absolute top-0 bottom-0 left-0 bg-surface-hover border-r border-border/50" style={{ width: `${(ability.animDuration / 1.5) * 100}%` }} />
                    <div className="absolute top-0 bottom-0 left-0 animate-pulse" style={{ width: `${(ability.hitstop / MAX_HITSTOP) * 30}%`, left: '10%', backgroundColor: ability.color, boxShadow: `${GLOW_MD} ${withOpacity(ability.color, OPACITY_50)}` }} />
                  </div>
                  <span className="text-xs font-mono font-bold w-[45px] text-right" style={{ color: ability.color }}>{ability.hitstop}s</span>
                </motion.div>
              ))}
            </div>
          </BlueprintPanel>

          {/* Stagger Pipeline */}
          <BlueprintPanel color={STATUS_ERROR} className="p-3">
            <SectionHeader label="Stagger Pipeline" color={STATUS_ERROR} icon={TrendingUp} />
            <div className="mt-3">
              <TimelineStrip events={STAGGER_TIMELINE} accent={STATUS_ERROR} />
              <div className="flex justify-between mt-3 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
                <span>Threshold: {STAGGER_CONFIG.threshold}</span>
                <span>Decay: {STAGGER_CONFIG.decayRate}/s</span>
              </div>
            </div>
          </BlueprintPanel>
        </div>
      </div>

      {/* Export to UE — push the tuner values onto GA_MeleeAttack's feel knobs */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader label="Export to UE (apply to GA_MeleeAttack)" color={ACCENT} icon={Download} />
          <button data-testid="combat-feel-export" onClick={copyFeel} className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border border-border/50 hover:bg-surface/50 cursor-pointer">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? 'Copied' : 'Copy Python'}
          </button>
        </div>
        <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto text-text-muted">{feelScript}</pre>
      </BlueprintPanel>
    </motion.div>
  );
}

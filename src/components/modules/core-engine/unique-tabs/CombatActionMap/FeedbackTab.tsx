'use client';

import { Gauge, Timer, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_ERROR, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE,
} from '@/lib/chart-colors';
import { TimelineStrip } from '../_shared';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import {
  ACCENT, FEEDBACK_PARAMS, FEEDBACK_PRESETS,
  HITSTOP_ABILITIES, MAX_HITSTOP,
  STAGGER_TIMELINE, STAGGER_CONFIG,
} from './data';
import type { FeedbackPreset } from './data';

interface FeedbackTabProps {
  feedbackValues: Record<string, number>;
  juiceLevel: number;
  onPreset: (preset: FeedbackPreset) => void;
  onParam: (id: string, value: number) => void;
}

export function FeedbackTab({ feedbackValues, juiceLevel, onPreset, onParam }: FeedbackTabProps) {
  const juiceColor = juiceLevel < 0.33 ? ACCENT_CYAN : juiceLevel < 0.66 ? ACCENT_EMERALD : ACCENT_ORANGE;

  return (
    <motion.div key="feedback" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Feedback Intensity Tuner */}
        <BlueprintPanel color={ACCENT} className="p-3">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader label="Feedback Intensity Tuner" color={ACCENT} icon={Gauge} />
            <div className="flex gap-1.5">
              {FEEDBACK_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => onPreset(preset)}
                  className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold px-2 py-0.5 rounded border transition-colors hover:brightness-125"
                  style={{ color: preset.color, borderColor: `${preset.color}40`, backgroundColor: `${preset.color}10` }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {FEEDBACK_PARAMS.map((param) => {
              const val = feedbackValues[param.id];
              const pct = ((val - param.min) / (param.max - param.min)) * 100;
              return (
                <div key={param.id} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted w-[120px] flex-shrink-0 truncate">{param.label}</span>
                  <div className="flex-1 relative">
                    <NeonBar pct={pct} color={ACCENT} />
                    <input type="range" min={param.min} max={param.max} step={param.step} value={val} onChange={(e) => onParam(param.id, parseFloat(e.target.value))} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                  </div>
                  <span className="text-2xs font-mono font-bold w-[50px] text-right" style={{ color: ACCENT }}>
                    {val.toFixed(param.step < 0.01 ? 3 : 2)}{param.unit}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted">Juice Level</span>
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
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted w-[100px] flex-shrink-0">{ability.name}</span>
                  <div className="flex-1 h-2 rounded-full border border-border/20 bg-surface-deep relative">
                    <div className="absolute top-0 bottom-0 left-0 bg-surface-hover border-r border-border/50" style={{ width: `${(ability.animDuration / 1.5) * 100}%` }} />
                    <div className="absolute top-0 bottom-0 left-0 animate-pulse" style={{ width: `${(ability.hitstop / MAX_HITSTOP) * 30}%`, left: '10%', backgroundColor: ability.color, boxShadow: `0 0 8px ${ability.color}80` }} />
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
              <div className="flex justify-between mt-3 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
                <span>Threshold: {STAGGER_CONFIG.threshold}</span>
                <span>Decay: {STAGGER_CONFIG.decayRate}/s</span>
              </div>
            </div>
          </BlueprintPanel>
        </div>
      </div>
    </motion.div>
  );
}

'use client';

import { Sparkles, Wand2 } from 'lucide-react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { FEEL_PRESETS, FEEL_FIELD_META } from '@/lib/character-feel-optimizer';
import { BlueprintPanel, SectionHeader, GlowStat } from '../_design';
import { ACCENT, FEEL_HINTS } from './constants';

/* ── Header + Custom Feel Input ──────────────────────────────────────────── */

interface FeelInputPanelProps {
  customPrompt: string;
  isRunning: boolean;
  onPromptChange: (v: string) => void;
  onGenerate: () => void;
}

export function FeelInputPanel({ customPrompt, isRunning, onPromptChange, onGenerate }: FeelInputPanelProps) {
  return (
    <>
      {/* Header */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg relative overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT }} />
              <Sparkles className="w-4 h-4 relative z-10" style={{ color: ACCENT, filter: `drop-shadow(0 0 4px ${ACCENT}80)` }} />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold text-text">
                AI Feel Optimizer
              </span>
              <div className="text-xs text-text-muted">
                Genre-tuned UPROPERTY presets for ARPGCharacterBase
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GlowStat label="Presets" value={FEEL_PRESETS.length} color={ACCENT} />
            <GlowStat label="Params" value={FEEL_FIELD_META.length} color={ACCENT} delay={0.05} />
          </div>
        </div>
      </BlueprintPanel>

      {/* Custom Feel Input */}
      <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
        <SectionHeader icon={Wand2} label="Describe Your Feel" color={ACCENT_VIOLET} />
        <div className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onGenerate()}
            placeholder="e.g., 'Dark Souls heavy but with faster dodges' or 'Hades snappy with more weight'"
            className="flex-1 text-xs font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-violet-500/50"
          />
          <button
            onClick={onGenerate}
            disabled={!customPrompt.trim() || isRunning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
            style={{
              backgroundColor: `${ACCENT_VIOLET}20`,
              color: ACCENT_VIOLET,
              border: `1px solid ${ACCENT_VIOLET}40`,
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isRunning ? 'Generating...' : 'Generate'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {FEEL_HINTS.map((hint) => (
            <button
              key={hint}
              onClick={() => onPromptChange(hint)}
              className="text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded-full transition-colors hover:bg-surface/50"
              style={{
                backgroundColor: 'var(--surface-deep)',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {hint}
            </button>
          ))}
        </div>
      </BlueprintPanel>
    </>
  );
}

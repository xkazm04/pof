'use client';

import { useState, useCallback } from 'react';
import { Wand2, MessageSquarePlus, RefreshCw, CornerDownLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { OVERLAY_WHITE, OPACITY_3, OPACITY_5, OPACITY_12, OPACITY_20, withOpacity } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT, QUICK_REFINEMENTS } from './constants';

/* ── Conversational refine bar ───────────────────────────────────────── *
 * Sits under a forged ability so the designer can iterate with follow-ups
 * ("make it AoE", "cut mana cost 30%") instead of rewriting the whole
 * prompt. Free-text submits on Enter; the chips are one-click refinements.
 * ────────────────────────────────────────────────────────────────────── */

export function RefineBar({ isRefining, onRefine }: {
  isRefining: boolean;
  onRefine: (instruction: string) => void;
}) {
  const [instruction, setInstruction] = useState('');

  const submit = useCallback((text: string) => {
    const t = text.trim();
    if (!t || isRefining) return;
    onRefine(t);
    setInstruction('');
  }, [isRefining, onRefine]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(instruction);
    }
  }, [instruction, submit]);

  return (
    <BlueprintPanel color={ACCENT} className="p-4 space-y-3">
      <SectionHeader icon={MessageSquarePlus} label="Refine This Ability" color={ACCENT} />

      <p className="text-xs text-zinc-500 leading-relaxed">
        Iterate with a follow-up — the forge keeps the current ability as context and shows you
        exactly what changed.
      </p>

      <div className="relative">
        <input
          type="text"
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRefining}
          placeholder='e.g. "make it AoE and cut mana cost 30%"'
          className="w-full p-3 pr-28 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-60"
        />
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => submit(instruction)}
          disabled={!instruction.trim() || isRefining}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: isRefining ? withOpacity(OVERLAY_WHITE, OPACITY_5) : withOpacity(ACCENT, OPACITY_12),
            color: isRefining ? 'var(--text-muted)' : ACCENT,
            border: `1px solid ${isRefining ? 'transparent' : withOpacity(ACCENT, OPACITY_20)}`,
          }}
        >
          {isRefining ? (
            <><RefreshCw size={12} className="animate-spin" /> Refining…</>
          ) : (
            <><Wand2 size={12} /> Refine</>
          )}
        </motion.button>
      </div>

      <div className="text-xs font-mono text-zinc-600 flex items-center gap-1">
        <CornerDownLeft size={11} />
        <span>Enter to refine · builds on the ability above</span>
      </div>

      {/* Quick refinement chips */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_REFINEMENTS.map(chip => (
          <motion.button
            key={chip}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => submit(chip)}
            disabled={isRefining}
            className="text-xs px-2 py-1 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: withOpacity(OVERLAY_WHITE, OPACITY_3) }}
          >
            {chip}
          </motion.button>
        ))}
      </div>
    </BlueprintPanel>
  );
}

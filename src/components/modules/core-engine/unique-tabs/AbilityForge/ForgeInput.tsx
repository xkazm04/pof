'use client';

import { useCallback, useRef } from 'react';
import { Wand2, Sparkles, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT, EXAMPLE_PROMPTS } from './constants';

/* ── Forge input panel ───────────────────────────────────────────────── */

export function ForgeInput({ description, setDescription, isGenerating, onGenerate }: {
  description: string;
  setDescription: (v: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleExample = useCallback((example: string) => {
    setDescription(example);
    textareaRef.current?.focus();
  }, [setDescription]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onGenerate();
    }
  }, [onGenerate]);

  return (
    <BlueprintPanel color={ACCENT} className="p-4 space-y-3">
      <SectionHeader icon={Wand2} label="Ability Forge" color={ACCENT} />

      <p className="text-xs text-zinc-500 leading-relaxed">
        Describe an ability in plain English and the forge will generate a complete GAS
        GameplayAbility class with tags, effects, montage refs, and combo timing.
      </p>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='e.g. "A dashing slash that chains into three spinning attacks with increasing fire damage"'
          className="w-full min-h-[80px] p-3 pr-24 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[12px] text-zinc-200 placeholder:text-zinc-600 resize-y focus:outline-none focus:border-zinc-600 transition-colors"
        />
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onGenerate}
          disabled={!description.trim() || isGenerating}
          className="absolute right-2 bottom-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: isGenerating ? 'rgba(255,255,255,0.05)' : `${ACCENT}20`,
            color: isGenerating ? '#a1a1aa' : ACCENT,
            border: `1px solid ${isGenerating ? 'transparent' : `${ACCENT}30`}`,
          }}
        >
          {isGenerating ? (
            <><RefreshCw size={12} className="animate-spin" /> Forging...</>
          ) : (
            <><Sparkles size={12} /> Forge</>
          )}
        </motion.button>
      </div>

      <div className="text-xs font-mono text-zinc-600 flex items-center gap-1">
        <span className="bg-zinc-800 px-1 rounded text-zinc-500">Ctrl+Enter</span>
        <span>to generate</span>
      </div>

      {/* Example prompts */}
      <div className="space-y-1.5">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-zinc-600">
          Try an example
        </span>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_PROMPTS.map((ex, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleExample(ex)}
              className="text-xs px-2 py-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors truncate max-w-[240px]"
              style={{ background: 'rgba(255,255,255,0.03)' }}
              title={ex}
            >
              {ex.length > 45 ? `${ex.slice(0, 45)}...` : ex}
            </motion.button>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}

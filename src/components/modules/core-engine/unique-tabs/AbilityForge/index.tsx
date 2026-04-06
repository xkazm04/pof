'use client';

/**
 * AbilityForge — AI-powered natural-language ability designer.
 *
 * Designers describe abilities in plain English and the forge generates:
 * - Complete GA_* class skeleton (.h + .cpp)
 * - Tag grants/blocks, cooldown GE, montage refs
 * - Combo timing entry for the chain builder
 * - Radar profile for comparison with existing abilities
 */

import { useState, useCallback } from 'react';
import { Sword } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_RED, OVERLAY_WHITE, OPACITY_2, OPACITY_5, OPACITY_8, OPACITY_20, OPACITY_25, withOpacity } from '@/lib/chart-colors';
import { apiFetch } from '@/lib/api-utils';
import { BlueprintPanel, SectionHeader } from '../_design';
import {
  COMBO_ABILITIES,
  ABILITY_RADAR_DATA as STATIC_RADAR_DATA,
} from '../AbilitySpellbook.data';
import {
  buildAbilityForgePrompt,
  type ForgedAbility,
} from '@/lib/prompts/ability-forge';
import { ACCENT, DAMAGE_TYPE_COLORS } from './constants';
import { ForgeInput } from './ForgeInput';
import { ForgeResult } from './ForgeResult';

/* ── Main component ──────────────────────────────────────────────────── */

export function AbilityForge() {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ForgedAbility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ForgedAbility[]>([]);

  const radarData = STATIC_RADAR_DATA;

  const handleGenerate = useCallback(async () => {
    const desc = description.trim();
    if (!desc || isGenerating) return;
    setError(null);
    setIsGenerating(true);

    try {
      const prompt = buildAbilityForgePrompt({
        description: desc,
        comboAbilities: COMBO_ABILITIES,
        radarData,
      });

      const forged = await apiFetch<ForgedAbility>('/api/agents/forge-ability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      setResult(forged);
      setHistory(prev => [forged, ...prev.slice(0, 9)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  }, [description, isGenerating, radarData]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Input section */}
      <ForgeInput
        description={description}
        setDescription={setDescription}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
      />

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: withOpacity(ACCENT_RED, OPACITY_25),
              color: ACCENT_RED,
              background: withOpacity(ACCENT_RED, OPACITY_5),
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      {result && (
        <BlueprintPanel color={ACCENT} className="p-4">
          <ForgeResult ability={result} existingRadar={radarData} />
        </BlueprintPanel>
      )}

      {/* History */}
      {history.length > 1 && (
        <BlueprintPanel color={ACCENT} className="p-3 space-y-2">
          <SectionHeader icon={Sword} label="Recent Forges" color={ACCENT} />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {history.map((h, i) => (
              <motion.button
                key={`${h.className}-${i}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setResult(h)}
                className="flex items-center gap-2 p-2 rounded-md text-left transition-colors hover:bg-zinc-800/50"
                style={{
                  background: result === h ? withOpacity(ACCENT, OPACITY_8) : withOpacity(OVERLAY_WHITE, OPACITY_2),
                  border: result === h ? `1px solid ${withOpacity(ACCENT, OPACITY_20)}` : '1px solid transparent',
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: DAMAGE_TYPE_COLORS[h.stats.damageType] ?? DAMAGE_TYPE_COLORS.None,
                  }}
                />
                <div className="min-w-0">
                  <div className="text-xs text-zinc-300 truncate">{h.displayName}</div>
                  <div className="text-[9px] font-mono text-zinc-600 truncate">{h.className}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </BlueprintPanel>
      )}
    </motion.div>
  );
}

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
import { motion, AnimatePresence } from 'framer-motion';
import { ACCENT_RED, OPACITY_5, OPACITY_25, withOpacity } from '@/lib/chart-colors';
import { apiFetch } from '@/lib/api-utils';
import { BlueprintPanel } from '../../unique-tabs/_design';
import {
  COMBO_ABILITIES,
  ABILITY_RADAR_DATA as STATIC_RADAR_DATA,
} from '../_shared/AbilitySpellbook.data';
import {
  buildAbilityForgePrompt,
  type ForgedAbility,
} from '@/lib/prompts/ability-forge';
import { ACCENT } from './constants';
import { ForgeInput } from './ForgeInput';
import { ForgeResult } from './ForgeResult';
import { RefineBar } from './RefineBar';
import { AbilityDiff } from './AbilityDiff';
import { ForgeHistoryPanel } from './ForgeHistoryPanel';

/* ── Main component ──────────────────────────────────────────────────── */

export function AbilityForge() {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ForgedAbility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ForgedAbility[]>([]);
  // The ability the current `result` was refined FROM, plus the instruction
  // that produced it — together they drive the "what changed" diff. Both are
  // null for a fresh, one-shot forge.
  const [baseline, setBaseline] = useState<ForgedAbility | null>(null);
  const [lastInstruction, setLastInstruction] = useState<string | null>(null);

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
      // A fresh forge has no prior — clear any refinement diff.
      setBaseline(null);
      setLastInstruction(null);
      setHistory(prev => [forged, ...prev.slice(0, 9)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  }, [description, isGenerating, radarData]);

  const handleRefine = useCallback(async (instruction: string) => {
    const instr = instruction.trim();
    if (!instr || !result || isGenerating) return;
    const prior = result;
    setError(null);
    setIsGenerating(true);

    try {
      const prompt = buildAbilityForgePrompt({
        description: description.trim() || prior.description,
        comboAbilities: COMBO_ABILITIES,
        radarData,
        refine: { prior, instruction: instr },
      });

      const forged = await apiFetch<ForgedAbility>('/api/agents/forge-ability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      setResult(forged);
      setBaseline(prior);
      setLastInstruction(instr);
      setHistory(prev => [forged, ...prev.slice(0, 9)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  }, [result, isGenerating, description, radarData]);

  // Viewing a past forge from history is a standalone snapshot — no diff.
  const handleSelectHistory = useCallback((h: ForgedAbility) => {
    setResult(h);
    setBaseline(null);
    setLastInstruction(null);
  }, []);

  // Shown after any refine — AbilityDiff itself reports "identical" when a
  // refine happened to change nothing.
  const showDiff = !!baseline && !!result && baseline !== result;

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

      {/* Refinement diff — what the latest follow-up changed */}
      <AnimatePresence>
        {showDiff && baseline && result && (
          <motion.div
            key="ability-diff"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <AbilityDiff prior={baseline} next={result} instruction={lastInstruction ?? ''} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversational refine loop */}
      {result && <RefineBar isRefining={isGenerating} onRefine={handleRefine} />}

      {/* History */}
      <ForgeHistoryPanel history={history} current={result} onSelect={handleSelectHistory} />
    </motion.div>
  );
}

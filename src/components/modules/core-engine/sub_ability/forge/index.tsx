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

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { PromptInspector } from './PromptInspector';
import { ForgeErrorCard } from './ForgeErrorCard';

/* ── Main component ──────────────────────────────────────────────────── */

export function AbilityForge() {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ForgedAbility | null>(null);
  // Preserve the raw caught value so the classifier can pattern-match more than just `.message`.
  const [error, setError] = useState<unknown>(null);
  const [history, setHistory] = useState<ForgedAbility[]>([]);
  const descriptionAnchorRef = useRef<HTMLDivElement | null>(null);
  // The ability the current `result` was refined FROM, plus the instruction
  // that produced it — together they drive the "what changed" diff. Both are
  // null for a fresh, one-shot forge.
  const [baseline, setBaseline] = useState<ForgedAbility | null>(null);
  const [lastInstruction, setLastInstruction] = useState<string | null>(null);
  // The exact prompt string just sent to the LLM — fed to the Prompt Inspector
  // so the user can see what was actually asked.
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

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
      setLastPrompt(prompt);

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
      setError(e);
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
      setLastPrompt(prompt);

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
      setError(e);
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
      <div ref={descriptionAnchorRef}>
        <ForgeInput
          description={description}
          setDescription={setDescription}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
        />
      </div>

      {/* Error — classified into a structured, actionable card. */}
      <AnimatePresence>
        {error != null && (
          <ForgeErrorCard
            error={error}
            onRetry={() => { setError(null); handleGenerate(); }}
            onEditDescription={() => {
              setError(null);
              descriptionAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const ta = descriptionAnchorRef.current?.querySelector('textarea');
              if (ta instanceof HTMLTextAreaElement) ta.focus();
            }}
          />
        )}
      </AnimatePresence>

      {/* Result */}
      {result && (
        <BlueprintPanel color={ACCENT} className="p-4">
          <ForgeResult ability={result} existingRadar={radarData} />
        </BlueprintPanel>
      )}

      {/* Prompt Inspector — exposes the audit + composed prompt that produced the result. */}
      <PromptInspector prompt={lastPrompt} />

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

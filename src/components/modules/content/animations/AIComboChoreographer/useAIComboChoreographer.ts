'use client';

import { useState, useMemo, useCallback } from 'react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { tryApiFetch } from '@/lib/api-utils';
import { comboAnimationScript } from '@/lib/blender-mcp/scripts/combo-animation';
import type { ComboHit } from '@/lib/blender-mcp/scripts/combo-animation';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import { logger } from '@/lib/logger';
import type { GeneratedCombo } from './types';
import { generateCombo } from './helpers';

export function useAIComboChoreographer() {
  const [prompt, setPrompt] = useState('');
  // Generation is synchronous & instant, so there is no "generating" state to toggle —
  // kept as a const so the button's enabled/label logic reads a stable false.
  const isGenerating = false;
  const [generatedCombo, setGeneratedCombo] = useState<GeneratedCombo | null>(null);
  const [codePreview, setCodePreview] = useState<{ code: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [blenderPreviewing, setBlenderPreviewing] = useState(false);
  const [blenderResult, setBlenderResult] = useState<{ message: string; isError: boolean } | null>(null);
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);

  // generateCombo is pure & synchronous (local keyword parse + seeded RNG, no
  // network), so produce the result immediately — no artificial delay.
  const runGenerate = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setGeneratedCombo(generateCombo(trimmed));
  }, []);

  const handleGenerate = useCallback(() => {
    runGenerate(prompt);
  }, [prompt, runGenerate]);

  const handlePreset = useCallback((presetPrompt: string) => {
    setPrompt(presetPrompt);
    runGenerate(presetPrompt);
  }, [runGenerate]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const comboStats = useMemo(() => {
    if (!generatedCombo) return null;
    return {
      hits: generatedCombo.sections.length,
      duration: generatedCombo.totalDuration,
      damage: generatedCombo.totalDamage,
      dps: generatedCombo.avgDPS,
      warpCount: generatedCombo.sections.filter(s => s.motionWarpTarget).length,
      totalRootMotion: generatedCombo.sections.reduce((s, sec) => s + sec.rootMotionDistance, 0),
    };
  }, [generatedCombo]);

  const handleBlenderPreview = useCallback(async () => {
    if (!generatedCombo) return;
    setBlenderPreviewing(true);
    setBlenderResult(null);
    try {
      let cumTime = 0;
      const hits: ComboHit[] = generatedCombo.sections.map((sec) => {
        const hit: ComboHit = {
          time: cumTime,
          type: sec.label,
          damage: sec.damage,
          rootMotion: sec.rootMotionDistance,
        };
        cumTime += sec.duration;
        return hit;
      });
      const code = comboAnimationScript({
        comboName: generatedCombo.name.replace(/[^a-zA-Z0-9_]/g, '_'),
        hits,
        totalDuration: generatedCombo.totalDuration,
      });
      const result = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (result.ok) {
        setBlenderResult({ message: result.data.output || 'Combo preview created in Blender', isError: false });
      } else {
        setBlenderResult({ message: result.error, isError: true });
      }
    } catch (e) {
      logger.warn('Blender combo preview failed', e);
      setBlenderResult({ message: e instanceof Error ? e.message : 'Preview failed', isError: true });
    } finally {
      setBlenderPreviewing(false);
    }
  }, [generatedCombo]);

  return {
    prompt, setPrompt,
    isGenerating,
    generatedCombo,
    codePreview, setCodePreview,
    copied,
    blenderPreviewing,
    blenderResult,
    blenderConnected,
    handleGenerate,
    handlePreset,
    handleCopy,
    comboStats,
    handleBlenderPreview,
  };
}

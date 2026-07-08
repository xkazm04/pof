'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Layers as LayersIcon, Zap, Monitor, Cpu, AlertTriangle,
} from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { tryApiFetch } from '@/lib/api-utils';
import { compositorStackScript } from '@/lib/blender-mcp/scripts/compositor-stack';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import { logger } from '@/lib/logger';
import { estimateGPUBudget } from '@/lib/post-process-studio/gpu-estimator';
import { reorderByPriority } from '@/stores/postProcessStudioStore';
import type { PPStudioEffect } from '@/types/post-process-studio';
import { TARGET_RESOLUTION } from './constants';
import { cloneDefaultEffects } from './helpers';
import { EffectRow } from './EffectRow';

// The canonical stack config — single source of truth lives in the prompt builder.
export type { PostProcessStackConfig } from '@/lib/prompts/post-process';

// ── Component ──

interface PostProcessStackBuilderProps {
  onGenerate: (config: import('@/lib/prompts/post-process').PostProcessStackConfig) => void;
  isGenerating: boolean;
}

export function PostProcessStackBuilder({ onGenerate, isGenerating }: PostProcessStackBuilderProps) {
  const [effects, setEffects] = useState<PPStudioEffect[]>(cloneDefaultEffects);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [blenderPreviewing, setBlenderPreviewing] = useState(false);
  const [blenderResult, setBlenderResult] = useState<{ message: string; isError: boolean } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);

  const sortedEffects = useMemo(
    () => [...effects].sort((a, b) => a.priority - b.priority),
    [effects],
  );

  const enabledCount = useMemo(() => effects.filter((e) => e.enabled).length, [effects]);

  // GPU budget for the enabled subset — same estimator the studio view uses.
  const budget = useMemo(
    () => estimateGPUBudget(effects, TARGET_RESOLUTION),
    [effects],
  );
  const costById = useMemo(() => {
    const m = new Map<string, number>();
    budget.effects.forEach((e) => m.set(e.effectId, e.costMs));
    return m;
  }, [budget]);
  const budgetPct = budget.budgetMs > 0 ? Math.min((budget.totalCostMs / budget.budgetMs) * 100, 100) : 0;

  const toggleEffect = useCallback((effectId: string) => {
    setEffects((prev) => prev.map((e) =>
      e.id === effectId ? { ...e, enabled: !e.enabled } : e,
    ));
  }, []);

  const moveEffect = useCallback((effectId: string, direction: 'up' | 'down') => {
    setEffects((prev) => reorderByPriority(prev, effectId, direction));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleGenerate = useCallback(() => {
    if (enabledCount === 0) {
      setGenerateError('Enable at least one effect before compiling the volume settings.');
      return;
    }
    try {
      setGenerateError(null);
      onGenerate({ effects });
    } catch (e) {
      logger.warn('Post-process generate dispatch failed', e);
      setGenerateError(e instanceof Error ? e.message : 'Failed to compile volume settings');
    }
  }, [effects, onGenerate, enabledCount]);

  const handleBlenderPreview = useCallback(async () => {
    setBlenderPreviewing(true);
    setBlenderResult(null);
    try {
      // Collect enabled effects into compositor settings
      const enabledIds = new Set(effects.filter((e) => e.enabled).map((e) => e.id));
      const settings: Parameters<typeof compositorStackScript>[0] = {};
      if (enabledIds.has('bloom')) {
        settings.bloom = { intensity: 0.675, threshold: -1.0, radius: 4.0 };
      }
      if (enabledIds.has('color-grading')) {
        settings.colorGrading = { saturation: 1.0, whiteBalance: 6500 };
      }
      if (enabledIds.has('vignette')) {
        settings.vignette = { intensity: 0.4 };
      }
      const code = compositorStackScript(settings);
      const result = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (result.ok) {
        setBlenderResult({ message: result.data.output || 'Compositor stack applied in Blender', isError: false });
      } else {
        setBlenderResult({ message: result.error, isError: true });
      }
    } catch (e) {
      logger.warn('Blender PP preview failed', e);
      setBlenderResult({ message: e instanceof Error ? e.message : 'Preview failed', isError: true });
    } finally {
      setBlenderPreviewing(false);
    }
  }, [effects]);

  return (
    <div className="w-full h-full bg-[#03030a] rounded-2xl border border-violet-900/30 shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] p-6 relative overflow-y-auto">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Blender Connection */}
        <BlenderConnectionBar />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-violet-900/30 pb-4 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-violet-900/40 border border-violet-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)] flex-shrink-0">
              <LayersIcon className="w-6 h-6 text-violet-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold tracking-widest uppercase text-violet-100">Post-Process Stack Pipeline</h3>
              <p className="text-xs text-violet-400/80 uppercase tracking-wider mt-0.5">
                {enabledCount}/{effects.length} ACTIVE_NODES — PRIORITY_ROUTING_LOCKED
              </p>
            </div>
          </div>

          {/* GPU budget readout — same estimator the studio view shows */}
          <div
            data-testid="pp-gpu-budget"
            className="flex flex-col items-end flex-shrink-0 px-3 py-2 rounded-xl border bg-black/40"
            style={{
              borderColor: budget.overBudget ? 'rgba(248,113,113,0.4)' : 'rgba(139,92,246,0.3)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" style={{ color: budget.overBudget ? '#f87171' : ACCENT_VIOLET }} />
              <span
                className="text-sm font-mono font-bold"
                style={{ color: budget.overBudget ? '#f87171' : '#34d399' }}
              >
                {budget.totalCostMs.toFixed(2)}ms
              </span>
              <span className="text-[10px] font-mono text-violet-400/70">/ {budget.budgetMs}ms @ {budget.resolution}</span>
            </div>
            <div className="w-32 h-1 bg-violet-950/60 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${budgetPct}%`,
                  backgroundColor: budget.overBudget ? '#f87171' : ACCENT_VIOLET,
                }}
              />
            </div>
            {budget.overBudget && (
              <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-red-400">
                <AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" />
                OVER_BUDGET
              </div>
            )}
          </div>
        </div>

        {/* Stack list */}
        <div className="space-y-3">
          {sortedEffects.map((effect, idx) => (
            <EffectRow
              key={effect.id}
              effect={effect}
              gpuCost={costById.get(effect.id)}
              isExpanded={expandedId === effect.id}
              isFirst={idx === 0}
              isLast={idx === sortedEffects.length - 1}
              onToggle={() => toggleEffect(effect.id)}
              onMoveUp={() => moveEffect(effect.id, 'up')}
              onMoveDown={() => moveEffect(effect.id, 'down')}
              onExpand={() => toggleExpand(effect.id)}
            />
          ))}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || enabledCount === 0}
          className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-50 mt-4 group outline-none focus-visible:ring-1 focus-visible:ring-text/40"
          style={{
            backgroundColor: `${MODULE_COLORS.content}15`,
            color: MODULE_COLORS.content,
            border: `1px solid ${MODULE_COLORS.content}50`,
            boxShadow: `0 0 20px ${MODULE_COLORS.content}20, inset 0 0 10px ${MODULE_COLORS.content}10`,
          }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
          <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

          {isGenerating ? (
            <div className="flex items-center gap-2 animate-pulse">
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              COMPILING_STACK...
            </div>
          ) : (
            <>
              <Zap className="w-4 h-4 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(currentColor,0.8)] transition-all" />
              COMPILE VOLUME_SETTINGS ({enabledCount})
            </>
          )}
        </button>

        {/* Generate path: empty-state hint + consistent inline error */}
        {enabledCount === 0 && (
          <div
            data-testid="pp-generate-empty"
            className="text-xs font-mono px-3 py-2 rounded-lg border border-violet-900/40 bg-violet-950/20 text-violet-400/80"
          >
            Enable at least one effect to compile the volume settings.
          </div>
        )}
        {generateError && (
          <div
            role="alert"
            data-testid="pp-generate-error"
            className="text-xs font-mono px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400"
          >
            {generateError}
          </div>
        )}

        {/* Preview in Blender */}
        <button
          onClick={handleBlenderPreview}
          disabled={!blenderConnected || blenderPreviewing || enabledCount === 0}
          className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-40 group outline-none border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 focus-visible:ring-1 focus-visible:ring-text/40"
          title={!blenderConnected ? 'Connect to Blender first' : 'Preview compositor stack in Blender'}
        >
          {blenderPreviewing ? (
            <div className="flex items-center gap-2 animate-pulse">
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              SENDING_TO_BLENDER...
            </div>
          ) : (
            <>
              <Monitor className="w-4 h-4 group-hover:scale-110 transition-all" />
              PREVIEW IN BLENDER ({enabledCount})
            </>
          )}
        </button>

        {/* Blender result */}
        {blenderResult && (
          <div className={`text-xs font-mono px-3 py-2 rounded-lg border ${blenderResult.isError ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
            {blenderResult.message}
          </div>
        )}
      </div>
    </div>
  );
}

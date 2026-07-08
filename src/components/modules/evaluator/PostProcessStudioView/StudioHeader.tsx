'use client';

import {
  Palette, Play, RefreshCw,
  Gauge, SplitSquareHorizontal, Cpu,
  Monitor, BookOpen,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { PPStudioEffect, PPResolution, GPUBudgetReport } from '@/types/post-process-studio';
import { MOTION } from '@/lib/constants';
import { ACCENT, RESOLUTIONS } from './constants';
import { StatCard } from './StatCard';

export function StudioHeader({
  effects,
  resolution,
  setResolution,
  explainMode,
  toggleExplainMode,
  compareMode,
  toggleCompareMode,
  handleGenerate,
  isGenerating,
  isRunning,
  enabledCount,
  budget,
  budgetPct,
  budgetColor,
}: {
  effects: PPStudioEffect[];
  resolution: PPResolution;
  setResolution: (res: PPResolution) => void;
  explainMode: boolean;
  toggleExplainMode: () => void;
  compareMode: boolean;
  toggleCompareMode: () => void;
  handleGenerate: () => void;
  isGenerating: boolean;
  isRunning: boolean;
  enabledCount: number;
  budget: GPUBudgetReport | null;
  budgetPct: number;
  budgetColor: string;
}) {
  return (
    <div className="px-6 pt-6 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${ACCENT}20, ${ACCENT}08)`,
            border: `1px solid ${ACCENT}30`,
          }}
        >
          <Palette className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-text">Post-Process Recipe Studio</h1>
          <p className="text-xs text-text-muted">
            Visual post-process stack with live parameter tuning and GPU budget
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Resolution selector */}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg px-1 py-0.5">
            <Monitor className="w-3 h-3 text-text-muted ml-1" />
            {RESOLUTIONS.map((res) => (
              <button
                key={res}
                onClick={() => setResolution(res)}
                className={`px-2 py-0.5 rounded text-2xs font-medium transition-colors ${
                  resolution === res
                    ? 'bg-violet-500/15 text-violet-400'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {res}
              </button>
            ))}
          </div>

          {/* Explain mode toggle — plain-language decoder for cryptic params */}
          <button
            onClick={toggleExplainMode}
            aria-pressed={explainMode}
            title="Explain effect parameters in plain language"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              explainMode
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Explain
          </button>

          {/* A/B Compare toggle */}
          <button
            onClick={toggleCompareMode}
            aria-pressed={compareMode}
            title="Compare two post-process stacks side by side"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus-ring ${
              compareMode
                ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" />
            A/B
          </button>

          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || isRunning || enabledCount === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: `${ACCENT}15`,
              color: ACCENT,
              border: `1px solid ${ACCENT}40`,
            }}
          >
            {isGenerating || isRunning
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <Play className="w-3.5 h-3.5" />
            }
            {isGenerating ? 'Building...' : isRunning ? 'Generating...' : `Generate C++ (${enabledCount})`}
          </button>
        </div>
      </div>

      {/* GPU Budget Bar + Stats */}
      {budget && (
        <div className="flex gap-3 mb-1">
          <SurfaceCard className="flex items-center gap-2.5 px-3 py-2 flex-1" level={2}>
            <ProgressRing
              value={Math.round(budgetPct)}
              size={36}
              strokeWidth={3}
              color={budgetColor}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold" style={{ color: budgetColor }}>
                  {budget.totalCostMs.toFixed(2)}ms
                </span>
                <span className="text-2xs text-text-muted">
                  / {budget.budgetMs}ms PP budget
                </span>
                {budget.overBudget && (
                  <Badge variant="error">Over Budget</Badge>
                )}
              </div>
              <div className="w-full h-1.5 bg-surface-deep rounded-full mt-1 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: budgetColor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${budgetPct}%` }}
                  transition={{ duration: MOTION.slow, ease: MOTION.ease }}
                />
              </div>
            </div>
          </SurfaceCard>

          <StatCard
            icon={<Cpu className="w-4 h-4 text-violet-400" />}
            value={`${enabledCount}/${effects.length}`}
            label="Active Effects"
            color="text-violet-400"
          />
          <StatCard
            icon={<Gauge className="w-4 h-4 text-cyan-400" />}
            value={resolution}
            label="Target Res"
            color="text-cyan-400"
          />
        </div>
      )}
    </div>
  );
}

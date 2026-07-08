'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import {
  STATUS_SUCCESS,
  STATUS_ERROR,
  STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import {
  findBudgetViolations,
  type AssetStats,
  type BudgetViolation,
} from '../assetStats';
import { useViewerStore } from '../useViewerStore';
import { BudgetSection } from './BudgetSection';
import {
  GeometrySection,
  BoundingBoxSection,
  MaterialsSection,
  TexturesSection,
  AnimationsSection,
} from './Sections';

interface AssetInspectorProps {
  modelName: string | null;
}

export function AssetInspector({ modelName }: AssetInspectorProps) {
  const stats = useViewerStore((s) => s.stats);
  const budget = useViewerStore((s) => s.budget);
  const setBudget = useViewerStore((s) => s.setBudget);

  const violations = useMemo<BudgetViolation[]>(
    () => (stats ? findBudgetViolations(stats, budget) : []),
    [stats, budget],
  );

  const overBudget = violations.length > 0;

  return (
    <aside
      className="flex flex-col h-full w-[320px] shrink-0 border-l border-border bg-surface/40 overflow-hidden"
      aria-label="Asset inspector"
    >
      <header className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-text-muted" />
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Inspector
          </span>
        </div>
        <BudgetBadge overBudget={overBudget} hasStats={!!stats} />
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-xs">
        {!stats ? (
          <EmptyInspector />
        ) : (
          <>
            <ModelSummary modelName={modelName} stats={stats} />
            <BudgetSection
              budget={budget}
              violations={violations}
              onChange={setBudget}
            />
            <GeometrySection stats={stats} budget={budget} violations={violations} />
            <BoundingBoxSection stats={stats} />
            <MaterialsSection stats={stats} budget={budget} />
            <TexturesSection stats={stats} budget={budget} />
            <AnimationsSection stats={stats} />
          </>
        )}
      </div>
    </aside>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function BudgetBadge({ overBudget, hasStats }: { overBudget: boolean; hasStats: boolean }) {
  if (!hasStats) {
    return (
      <span className="text-[10px] uppercase tracking-wide" style={{ color: STATUS_NEUTRAL }}>
        idle
      </span>
    );
  }
  return overBudget ? (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}1a` }}
    >
      <AlertTriangle size={10} /> Over budget
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}1a` }}
    >
      <CheckCircle2 size={10} /> Within budget
    </span>
  );
}

function EmptyInspector() {
  return (
    <div className="text-text-muted text-xs leading-relaxed">
      Load a model with the toolbar <span className="text-text">Load Model</span> button.
      The inspector will report triangles, materials, textures, bounding box, and
      animation clips, and flag anything that exceeds your UE5 budget.
    </div>
  );
}

function ModelSummary({
  modelName,
  stats,
}: {
  modelName: string | null;
  stats: AssetStats;
}) {
  return (
    <div>
      <div className="text-text font-medium truncate" title={modelName ?? undefined}>
        {modelName ?? 'Unnamed asset'}
      </div>
      <div className="text-text-muted">
        {stats.meshes} mesh{stats.meshes === 1 ? '' : 'es'} · {stats.materials.length} mat
        · {stats.textures.length} tex · {stats.animations.length} clip
        {stats.animations.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}

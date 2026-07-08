import { Info, ArrowRight } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { OPACITY_10, OPACITY_15 } from '@/lib/chart-colors';
import type { DirectorResult } from '@/types/squad-tactics';
import { ACCENT, STEP_KIND_COLORS } from './constants';

/* ── EQS Pipeline View ────────────────────────────────────────────────────── */

export function PipelineView({ result }: { result: DirectorResult }) {
  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="squad-pipeline-view">
      <div className="px-4 py-3 border-b border-border/40">
        <h4 className="text-sm font-bold text-text font-mono">Composed EQS Pipeline</h4>
        <p className="text-2xs text-text-muted">
          The AI Director composes individual EQS queries into a coordinated squad pipeline.
          Unlike isolated queries, each member&apos;s allocation considers ally positions.
        </p>
      </div>

      {/* Flow summary */}
      <div className="px-4 py-2.5 border-b border-border/20 flex items-center gap-1 flex-wrap">
        {result.composedPipeline.map((step, i) => {
          const color = STEP_KIND_COLORS[step.kind] ?? ACCENT;
          return (
            <div key={i} className="flex items-center gap-1">
              <span
                className="text-2xs font-mono px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${color}${OPACITY_10}`,
                  color,
                  border: `1px solid ${color}30`,
                }}
              >
                {step.label}
              </span>
              {i < result.composedPipeline.length - 1 && (
                <ArrowRight className="w-3 h-3 text-text-muted" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step details */}
      <div className="p-3 space-y-1.5">
        {result.composedPipeline.map((step, i) => {
          const color = STEP_KIND_COLORS[step.kind] ?? ACCENT;
          const kindLabel = step.kind === 'test-score' ? 'Score' : step.kind === 'test-filter' ? 'Filter' : step.kind.charAt(0).toUpperCase() + step.kind.slice(1);

          return (
            <div key={i}>
              <div
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: `${color}30` }}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-bold text-text">{step.label}</span>
                  <span
                    className="text-2xs font-medium px-1.5 py-0.5 rounded ml-auto shrink-0"
                    style={{ color, backgroundColor: `${color}${OPACITY_15}` }}
                  >
                    {kindLabel}
                  </span>
                </div>
                <div className="px-3 pb-2 space-y-0.5">
                  {step.cppClass && (
                    <p className="text-2xs font-mono" style={{ color }}>{step.cppClass}</p>
                  )}
                  <p className="text-2xs text-text-muted">{step.description}</p>
                </div>
              </div>
              {i < result.composedPipeline.length - 1 && (
                <div className="flex items-center justify-center py-0.5">
                  <ArrowRight className="w-3.5 h-3.5" style={{ color: STEP_KIND_COLORS[result.composedPipeline[i + 1].kind] ?? ACCENT }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Key insight */}
      <div className="mx-3 mb-3">
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg text-2xs"
          style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT }}
        >
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>Key difference from standard EQS:</strong> The <code className="font-mono">AllySeparation</code> test
            and <code className="font-mono">Director Allocate</code> step make this pipeline squad-aware.
            Positions are allocated sequentially by role priority, so each member&apos;s query
            incorporates previously allocated ally positions as additional scoring context.
          </span>
        </div>
      </div>
    </SurfaceCard>
  );
}

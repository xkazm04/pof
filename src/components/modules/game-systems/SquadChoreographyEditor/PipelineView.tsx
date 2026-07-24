import { useId } from 'react';
import { Info, ArrowRight } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { OPACITY_10, OPACITY_15 } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import type { ComposedEQSStep, DirectorResult } from '@/types/squad-tactics';
import { ACCENT, STEP_KIND_COLORS } from './constants';

/* ── EQS Pipeline View ────────────────────────────────────────────────────── */

/** Readable badge text per step kind — one lookup instead of an inline ternary chain. */
const KIND_LABELS: Record<ComposedEQSStep['kind'], string> = {
  context: 'Context',
  generator: 'Generator',
  'test-score': 'Score',
  'test-filter': 'Filter',
  director: 'Director',
  result: 'Result',
};

export function PipelineView({ result }: { result: DirectorResult }) {
  const headingId = useId();
  const steps = result.composedPipeline;

  return (
    <SurfaceCard
      className="p-0 overflow-hidden"
      role="region"
      aria-labelledby={headingId}
      data-testid="squad-pipeline-view"
    >
      <div className="px-4 py-3 border-b border-border/40">
        <div className="flex items-baseline gap-2">
          <h4 id={headingId} className="text-sm font-bold text-text font-mono">Composed EQS Pipeline</h4>
          <span className={`${TEXT_SCALE.meta} font-mono text-text-muted shrink-0`}>
            {steps.length} {steps.length === 1 ? 'step' : 'steps'}
          </span>
        </div>
        {/* Prose sits at the 12px legibility floor (TEXT_SCALE.body); `text-2xs`
            stays reserved for badges, counts and mono identifiers. */}
        <p className={`${TEXT_SCALE.body} text-text-muted`}>
          The AI Director composes individual EQS queries into a coordinated squad pipeline.
          Unlike isolated queries, each member&apos;s allocation considers ally positions.
        </p>
      </div>

      {steps.length === 0 ? (
        <p
          className={`px-4 py-6 text-center ${TEXT_SCALE.body} text-text-muted`}
          data-testid="squad-pipeline-empty"
        >
          No pipeline composed — this formation declares no roles, so there are no EQS
          queries to chain. Pick a formation with at least one role to see the pipeline.
        </p>
      ) : (
        <>
          {/* Flow summary — a purely visual overview of the same steps listed below,
              so it is hidden from assistive tech to avoid announcing them twice. */}
          <div
            className="px-4 py-2.5 border-b border-border/20 flex items-center gap-1 flex-wrap"
            aria-hidden="true"
          >
            {steps.map((step, i) => {
              const color = STEP_KIND_COLORS[step.kind] ?? ACCENT;
              return (
                <div key={i} className="flex items-center gap-1">
                  <span
                    className={`${TEXT_SCALE.meta} font-mono px-2 py-0.5 rounded-md`}
                    style={{
                      backgroundColor: `${color}${OPACITY_10}`,
                      color,
                      border: `1px solid ${color}30`,
                    }}
                  >
                    {step.label}
                  </span>
                  {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-text-muted" />}
                </div>
              );
            })}
          </div>

          {/* Step details — an ordered list, so the execution order the Director
              relies on is conveyed structurally and not by arrow glyphs alone. */}
          <ol className="p-3 space-y-1.5" aria-label="Pipeline steps in execution order">
            {steps.map((step, i) => {
              const color = STEP_KIND_COLORS[step.kind] ?? ACCENT;

              return (
                <li key={i}>
                  <div
                    className="rounded-lg border overflow-hidden"
                    style={{ borderColor: `${color}30` }}
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      {/* Ordinal replaces a bare color dot: it names the position in the
                          chain while keeping the kind's color. The <ol> already conveys
                          order to screen readers, so it is decorative there. */}
                      <span
                        aria-hidden="true"
                        className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center ${TEXT_SCALE.meta} font-mono font-bold`}
                        style={{
                          backgroundColor: `${color}${OPACITY_15}`,
                          color,
                          border: `1px solid ${color}60`,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className={`${TEXT_SCALE.body} font-bold text-text min-w-0 break-words`}>
                        {step.label}
                      </span>
                      <span
                        className={`${TEXT_SCALE.meta} font-medium px-1.5 py-0.5 rounded ml-auto shrink-0`}
                        style={{ color, backgroundColor: `${color}${OPACITY_15}` }}
                      >
                        {KIND_LABELS[step.kind]}
                      </span>
                    </div>
                    <div className="px-3 pb-2 space-y-0.5">
                      {step.cppClass && (
                        <p className={`${TEXT_SCALE.meta} font-mono break-all`} style={{ color }}>
                          {step.cppClass}
                        </p>
                      )}
                      <p className={`${TEXT_SCALE.body} text-text-muted`}>{step.description}</p>
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex items-center justify-center py-0.5" aria-hidden="true">
                      <ArrowRight
                        className="w-3.5 h-3.5"
                        style={{ color: STEP_KIND_COLORS[steps[i + 1].kind] ?? ACCENT }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Key insight */}
          <div className="mx-3 mb-3">
            <div
              className={`flex items-start gap-2 px-3 py-2 rounded-lg ${TEXT_SCALE.body}`}
              style={{ backgroundColor: `${ACCENT}${OPACITY_10}`, color: ACCENT }}
            >
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong>Key difference from standard EQS:</strong> The <code className="font-mono">AllySeparation</code> test
                and <code className="font-mono">Director Allocate</code> step make this pipeline squad-aware.
                Positions are allocated sequentially by role priority, so each member&apos;s query
                incorporates previously allocated ally positions as additional scoring context.
              </span>
            </div>
          </div>
        </>
      )}
    </SurfaceCard>
  );
}

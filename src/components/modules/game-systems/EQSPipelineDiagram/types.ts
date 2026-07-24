// ── Pipeline data (from C++ EQS sources) ───────────────────────────────────
// Numeric defaults come from the single-source `eqs-defaults.ts` so this diagram
// can never silently drift from the visualizers, the component inventory, or the
// engine.

export type StepKind = 'context' | 'generator' | 'test-score' | 'test-filter' | 'result';

export interface PipelineStep {
  id: string;
  label: string;
  cppClass: string;
  kind: StepKind;
  color: string;
  detail: string;
  cost?: 'Low' | 'High';
  /** True for engine-provided components (e.g. UEnvQueryContext_Querier). Keeps
   *  the "N custom components" copy honest — see CUSTOM_COMPONENT_COUNT. */
  builtIn?: boolean;
  params?: { label: string; value: string }[];
}

export interface QueryPipeline {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: PipelineStep[];
}

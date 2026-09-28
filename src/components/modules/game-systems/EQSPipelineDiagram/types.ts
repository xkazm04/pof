// ── Pipeline data (from C++ EQS sources) ───────────────────────────────────
// Component identity (cppClass / kind / cost / built-in) is resolved from the
// single-source `eqs-catalog.ts` by `componentId`; numeric defaults come from
// `eqs-defaults.ts`. So this diagram can never silently drift from the
// visualizers, the component inventory, the squad director, or the engine.

import type { EQSComponentId, EQSCost } from '@/lib/ai-director/eqs-catalog';

export type StepKind = 'context' | 'generator' | 'test-score' | 'test-filter' | 'result';

export interface PipelineStep {
  id: string;
  /** Catalog component this step instantiates. Absent only on the terminal result step. */
  componentId?: EQSComponentId;
  label: string;
  cppClass: string;
  kind: StepKind;
  color: string;
  detail: string;
  cost?: EQSCost;
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

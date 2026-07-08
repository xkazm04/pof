// ── Real UPROPERTY data from C++ EQS sources ────────────────────────────────
// Numeric defaults + clamp metas come from the single-source `eqs-defaults.ts`
// so this inventory can never silently drift from the visualizers, the pipeline
// diagram, or the engine.

export type ComponentKind = 'context' | 'generator' | 'test';

export interface PropertyDef {
  name: string;
  type: string;
  defaultValue: string;
  meta?: string;
  description: string;
}

export interface EQSComponentDef {
  id: string;
  displayName: string;
  cppClass: string;
  kind: ComponentKind;
  parentClass: string;
  description: string;
  cost?: 'Low' | 'High';
  outputType?: string;
  properties: PropertyDef[];
}

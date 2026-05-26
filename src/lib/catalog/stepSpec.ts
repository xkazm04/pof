import type { Checker } from './acceptance/types';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { StepOutput } from '@/components/layout-lab/labPipelineStore';

/** The common archetypes (Hybrid: these use the generic renderer; complex rows may register a bespoke component instead). */
export type ArchetypeId =
  | 'brief' | 'schema' | 'balance' | 'gallery' | 'rules' | 'checklist' | 'manifest' | 'custom';

/** Declarative View for the generic ArchetypeStep renderer. */
export type ViewDescriptor =
  | { kind: 'prose'; field: string; emptyText: string }
  | { kind: 'table'; field: string; columns: { key: string; unit?: string }[] }
  | { kind: 'gallery'; field: string; candidates: number }
  | { kind: 'checklist'; field: string }
  | { kind: 'manifest'; field: string };

export interface StepSpec {
  archetype: ArchetypeId;
  label: string;
  view: ViewDescriptor;
  /** What the Produce writes. */
  produce: (entity: LabEntity) => StepOutput;
  /** Derives the acceptance result from the persisted artifact data. */
  accept: Checker;
  /** Optional CLI direction default + note for the Produce panel. */
  produceNote?: string;
  defaultDirection?: string;
}

export interface CatalogPipeline {
  catalogId: string;
  steps: StepSpec[];
}

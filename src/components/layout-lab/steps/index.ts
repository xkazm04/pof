import type { ComponentType } from 'react';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';
import { ItemConceptBrief } from './ItemConceptBrief';
import { ItemAttributes } from './ItemAttributes';
import { ItemEconomy } from './ItemEconomy';

export type StepComponent = ComponentType<{ t: LabTheme; entity: LabEntity }>;

/** Per-catalog, per-step composition UIs (the View/Produce/Acceptance prototype).
 *  Only the Items example's first 3 steps are implemented; everything else falls
 *  back to the Baseline placeholder canvas. */
const STEP_REGISTRY: Record<string, Record<string, StepComponent>> = {
  items: {
    'Concept Brief': ItemConceptBrief,
    'Attributes': ItemAttributes,
    'Economy': ItemEconomy,
  },
};

export function getStepComponent(catalogId: string, stepName: string): StepComponent | null {
  return STEP_REGISTRY[catalogId]?.[stepName] ?? null;
}

import type { ComponentType } from 'react';
import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';
import { ItemConceptBrief } from './ItemConceptBrief';
import { ItemAttributes } from './ItemAttributes';
import { ItemEconomy } from './ItemEconomy';
import { ItemIcon2D, Item3DGen, ItemMaterial } from './ItemArt';
import { ItemAnimations, ItemVFX, ItemSFX } from './ItemAnimAudio';
import { ItemInventoryUI, ItemTooltip } from './ItemIntegration';
import { ItemTestGate, ItemPackaging } from './ItemGate';
import { ITEM_STEP_NAMES } from './itemsSteps';

export type StepComponent = ComponentType<{ t: LabTheme; entity: LabEntity; step: string }>;

/** The 13 Items step UIs in ITEM_STEP_NAMES order. Zipped to their labels below
 *  so the step names live in exactly one place (ITEM_STEP_SPECS in itemsSteps.ts)
 *  and a rename can never silently route a real step to the generic placeholder. */
const ITEM_STEP_COMPONENTS: StepComponent[] = [
  ItemConceptBrief, ItemAttributes, ItemEconomy, ItemIcon2D, Item3DGen,
  ItemMaterial, ItemAnimations, ItemVFX, ItemSFX, ItemInventoryUI,
  ItemTooltip, ItemTestGate, ItemPackaging,
];

if (ITEM_STEP_COMPONENTS.length !== ITEM_STEP_NAMES.length) {
  throw new Error(
    `Items step registry out of sync: ${ITEM_STEP_COMPONENTS.length} components for ${ITEM_STEP_NAMES.length} step names`,
  );
}

/** Per-catalog, per-step composition UIs (View/Produce/Acceptance). The full Items
 *  pipeline is prototyped; other catalogs fall back to the Baseline placeholder. */
const STEP_REGISTRY: Record<string, Record<string, StepComponent>> = {
  items: Object.fromEntries(ITEM_STEP_NAMES.map((name, i) => [name, ITEM_STEP_COMPONENTS[i]])),
};

export function getStepComponent(catalogId: string, stepName: string): StepComponent | null {
  return STEP_REGISTRY[catalogId]?.[stepName] ?? null;
}

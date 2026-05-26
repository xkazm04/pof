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

export type StepComponent = ComponentType<{ t: LabTheme; entity: LabEntity; step: string }>;

/** Per-catalog, per-step composition UIs (View/Produce/Acceptance). The full Items
 *  pipeline is prototyped; other catalogs fall back to the Baseline placeholder. */
const STEP_REGISTRY: Record<string, Record<string, StepComponent>> = {
  items: {
    'Concept Brief': ItemConceptBrief,
    'Attributes': ItemAttributes,
    'Economy': ItemEconomy,
    'Icon 2D Art': ItemIcon2D,
    '3D Generation': Item3DGen,
    'Material / Texture': ItemMaterial,
    'Animations': ItemAnimations,
    'VFX': ItemVFX,
    'SFX': ItemSFX,
    'Inventory UI Integration': ItemInventoryUI,
    'Tooltip / Compare': ItemTooltip,
    'Test Gate': ItemTestGate,
    'UE Packaging': ItemPackaging,
  },
};

export function getStepComponent(catalogId: string, stepName: string): StepComponent | null {
  return STEP_REGISTRY[catalogId]?.[stepName] ?? null;
}

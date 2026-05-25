import type { SubModuleId } from '@/types/modules';
import { NEW_CATALOGS } from './new-catalogs';

/**
 * Catalog id → owning PoF module (session labelling + analytics). Single source of
 * truth (was duplicated in useGeneration + useEntityTrackHelp). New catalogs are
 * merged from the NEW_CATALOGS driver.
 */
export const CATALOG_MODULE: Record<string, SubModuleId> = {
  spellbook: 'arpg-gas',
  items: 'arpg-inventory',
  'loot-tables': 'arpg-loot',
  bestiary: 'arpg-enemy-ai',
  'combat-map': 'arpg-combat',
  'screen-flow': 'arpg-ui',
  'zone-map': 'arpg-world',
  'state-graph': 'arpg-animation',
  materials: 'materials',
  audio: 'audio',
  'animation-assets': 'arpg-animation',
  ...Object.fromEntries(NEW_CATALOGS.map((c) => [c.catalogId, c.module])),
};

/** Owning module for a catalog; falls back to arpg-gas for unknown ids. */
export function catalogModule(catalogId: string): SubModuleId {
  return CATALOG_MODULE[catalogId] ?? 'arpg-gas';
}

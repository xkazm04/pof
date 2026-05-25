import type { CatalogLink } from './types';

/**
 * Catalogs that are shared PRESENTATION libraries. Content-bearing rows
 * (abilities, characters, props, status effects, items, …) BIND to entries here
 * via `CatalogLink` rather than producing their own — so the pipeline's
 * VFX/SFX/Icon/UI steps mean "bind to a presentation-catalog entry," produced
 * once and reused. (Catalog Pipeline finding, Phase B.)
 */
export const PRESENTATION_CATALOGS = ['vfx', 'icon-sets', 'hud-elements', 'audio', 'music', 'ambient'] as const;
export type PresentationCatalogId = (typeof PRESENTATION_CATALOGS)[number];

/** A presentation aspect a content entity binds to. */
export type PresentationRole = 'icon' | 'vfx' | 'sfx' | 'music' | 'ambient' | 'hud';

/** Which presentation catalog owns each role. */
export const ROLE_CATALOG: Record<PresentationRole, PresentationCatalogId> = {
  icon: 'icon-sets',
  vfx: 'vfx',
  sfx: 'audio',
  music: 'music',
  ambient: 'ambient',
  hud: 'hud-elements',
};

export function isPresentationCatalog(catalogId: string): boolean {
  return (PRESENTATION_CATALOGS as readonly string[]).includes(catalogId);
}

/** Build a cross-catalog link binding a content entity to a presentation entry. */
export function presentationLink(role: PresentationRole, entityId: string): CatalogLink {
  return { catalogId: ROLE_CATALOG[role], entityId, role };
}

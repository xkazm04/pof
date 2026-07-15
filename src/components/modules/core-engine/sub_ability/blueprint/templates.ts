/**
 * Preset archetype templates for the GAS Blueprint Editor — public barrel.
 *
 * Split across three files (each ≤200 LOC, no import cycle):
 *   template-base.ts    - interface, shared base data, melee / projectile / channel
 *   template-presets.ts - aura / DoT / summon + combined GAS_TEMPLATES export
 *   templates.ts (this) - re-export barrel; the stable import path for consumers
 *
 * Historical note: templates.ts and template-presets.ts used to import each
 * other (templates re-exported GAS_TEMPLATES; presets imported the base data),
 * a bidirectional cycle that put BASE_VITALS in a temporal-dead-zone the moment
 * the tree gained a JSX importer. The base primitives now live in template-base.ts
 * so the dependency graph is one-directional.
 */

export type { GASTemplate } from './template-base';
export {
  BASE_VITALS, BASE_RELATIONSHIPS,
  DEAD_BLOCKS_ALL, STUN_BLOCKS_ALL,
  MELEE_COMBO, PROJECTILE_SPELL, CHANNELED_ABILITY,
} from './template-base';
export { GAS_TEMPLATES } from './template-presets';

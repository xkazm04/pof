import type { RuleCategory } from './types';

/**
 * Which canon categories prefix each archetype's Produce prompt.
 *
 * Shared by the UI `ArchetypeStep` (client) and the headless recipe builder
 * (`src/lib/catalog/recipe.ts`, server) so the prompt context Claude receives is
 * IDENTICAL whether a step is driven from the `/layout` lab or the pof-mcp layer.
 * Edit here, not in either consumer.
 */
export const ARCHETYPE_CANON: Record<string, RuleCategory[]> = {
  brief: ['game'],
  schema: ['project', 'game'],
  rules: ['project', 'game'],
  balance: ['project', 'game'],
  gallery: ['art', 'game'],
  checklist: ['project'],
  manifest: ['project'],
  graph: ['game', 'project'],
  // Bespoke steps (python-driven wiring/visual gates). Decided, not defaulted: they carry every
  // category, which is what an unmapped key used to give them implicitly. Narrow deliberately,
  // never by deleting the key (undefined = unfiltered canon).
  custom: ['art', 'game', 'project'],
};

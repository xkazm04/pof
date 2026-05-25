/**
 * Plain-language glossary for UE5 / PoF jargon. Backs the `GlossaryTerm`
 * primitive. Seed entries cover the most common terms surfaced in the ECW
 * shell; per-catalog facets in Phase 10 extend this with their own entries.
 *
 * Phase 11-DS infrastructure (idea 143ff660).
 */
export const GLOSSARY: Record<string, string> = {
  // GAS / Gameplay Ability System
  GAS: 'Gameplay Ability System — UE5\'s framework for abilities, attributes, and effects.',
  GA: 'Gameplay Ability — one action the player or AI can perform (e.g. Fireball, Dodge).',
  GE: 'Gameplay Effect — a modifier applied through GAS (e.g. damage, debuff, heal).',
  ASC: 'Ability System Component — the per-actor host for abilities + attributes.',
  CDO: 'Class Default Object — the template instance of a UClass. Set props on placed instances, not the CDO.',

  // Lifecycle states
  planned: 'Designed but not generated. Nothing in UE yet.',
  scaffolded: 'C++ class exists and compiles. No runtime behavior wired.',
  generated: 'Asset placed in /Game/ via Python. Not yet wired to gameplay.',
  wired: 'Asset is granted/bound on the placed instance. Should be reachable in PIE.',
  verified: 'Functional test runs green. Reproducible in-engine.',
  failed: 'Last generation step failed. Check session log; reset to planned to retry.',

  // Catalog terms
  catalog: 'A first-class collection of game entities (spellbook · items · loot · bestiary · etc).',
  facet: 'A per-catalog custom view inside the entity inspector (e.g. archetype radar for bestiary).',
  recipe: 'The generation strategy for a catalog: steps + prompts + functional-test gate.',

  // CLI / dispatch
  '@@CALLBACK': 'In-prompt marker. CLI emits a JSON payload Claude can\'t tamper with; the app POSTs it to /api/catalog.',
  Bridge: 'PoF Bridge plugin — UE5 companion that exposes editor state + manifest over HTTP.',

  // UE asset paths
  '/Script/': 'Native C++ class path prefix. /Script/PoF.GA_Fireball means the UGA_Fireball class in the PoF module.',
  '/Game/': 'Project content path prefix. /Game/Items/Sword is a .uasset under Content/Items/.',

  // Loot
  PWR: 'Total power score across all stats.',
  UARPGLootTable: 'The UE5 data-asset class for weighted loot tables in this project.',
  UARPGItemDefinition: 'The UE5 data-asset class for one item\'s static properties.',
  bIsPrefix: 'UPROPERTY bool — true if the affix attaches to the front of the item name.',

  // Animation
  AnimBP: 'Animation Blueprint — UE5\'s graph-based animation state machine. The graph stays manual; Python authors the montage assets.',
};

/** Look up a glossary entry; returns undefined if not present. */
export function lookupGlossary(term: string): string | undefined {
  return GLOSSARY[term];
}

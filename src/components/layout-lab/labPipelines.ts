import { pipelineForCatalog, trackLabel } from '@/lib/pipeline/tracks';
import type { LifecycleState } from '@/lib/catalog/types';

/**
 * Fine idea→UE pipeline steps per catalog (from game_catalog_pipelines.xlsx).
 * Spellbook is the lab showcase (16 steps); other catalogs fall back to their
 * 8-track labels so every detail view still renders a pipeline.
 */
const FINE_STEPS: Record<string, string[]> = {
  spellbook: [
    'Concept Brief & Fantasy', 'Mechanical Effect Logic', 'Cost & Cooldown Rules',
    'Targeting Rules', 'Damage / Healing / Status Formulas', 'Combo & Interaction Rules',
    'Balancing & Tuning Pass', 'Animation Set', 'VFX (cast, projectile, impact)',
    'SFX (cast, impact, voice)', 'UI (icon, tooltip, cooldown)', 'Camera Shake / Feedback',
    'Localization', 'AI Usage Hints', 'Combat Test Gate', 'UE Ability Asset Packaging',
  ],
  items: [
    'Concept Brief', 'Data Schema', 'Stat & Rules Logic', 'Economy & Rarity Balancing',
    'Icon 2D Art', '3D Mesh', 'Material & Texture', 'Pickup / Equip Animation',
    'VFX', 'SFX', 'Inventory UI', 'Tooltip & Compare', 'Test Gate', 'UE Packaging',
  ],
  bestiary: [
    'Concept Brief & Role', 'Lore & Codex Text', 'Stat Block & Resistances', 'Ability Set',
    'AI Behavior Tree', 'Aggro / Perception', 'Encounter Balancing', 'Loot Binding',
    'Concept Art 2D', '3D Model & Rig', 'Material & Texture', 'Animation Set',
    'VFX Set', 'SFX Set', 'Combat Test Gate', 'UE Packaging',
  ],
  currencies: [
    'Concept Brief & Role', 'Source/Sink Mapping', 'Cap & Decay Rules', 'Conversion Rules',
    'Inflation Sim', 'Icon 2D Art', 'Gain VFX', 'Gain SFX', 'Wallet UI',
    'Localization', 'Anti-Exploit', 'Telemetry', 'Economy Test Gate', 'UE Packaging',
  ],
};

export function labPipelineSteps(catalogId: string): string[] {
  return FINE_STEPS[catalogId] ?? pipelineForCatalog(catalogId).map(trackLabel);
}

/** Pseudo-progress for the prototype: how many steps read as "done" for a lifecycle. */
const LIFECYCLE_FRAC: Record<LifecycleState, number> = {
  planned: 0.12, scaffolded: 0.35, generated: 0.6, wired: 0.8, verified: 1, failed: 0.45,
};

export function labStepsDone(lifecycle: LifecycleState, total: number): number {
  return Math.max(0, Math.min(total, Math.round((LIFECYCLE_FRAC[lifecycle] ?? 0.1) * total)));
}

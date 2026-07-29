import type { EditorEffect, TagRule } from '@/lib/gas-codegen';
import { STATUS_NEUTRAL } from '@/lib/chart-colors';

export type { EditorEffect, TagRule };

/**
 * Provenance of an adopted forge output. Additive + optional — records where a
 * spec's effects/tagRules came from (the AbilityForge) and preserves the raw
 * generated C++ + the exact prompt so the design is auditable. The app never
 * writes these C++ strings to disk; UE materialization stays the agent task's
 * job (generateGasEffects). Pure data.
 */
export interface SpecProvenance {
  source: 'forge';
  className: string;
  displayName: string;
  damageType: string;
  /** The natural-language prompt that produced the forge output. */
  prompt?: string;
  /** Raw generated .h — stored for audit, not written to the project. */
  headerCode: string;
  /** Raw generated .cpp — stored for audit, not written to the project. */
  cppCode: string;
}

/**
 * Codegen provenance: what the `generate-gas-effects` agent actually did in the
 * UE project, reported back through the task's `@@CALLBACK` and re-derived
 * server-side. This is the ONE record that makes the "exports C++" claim
 * checkable — a dispatch alone proves nothing. Pure data.
 */
export interface CodegenReport {
  /** Server-derived, never taken from the model's word. */
  status: 'confirmed' | 'failed';
  /** Project-relative paths the agent wrote (GE/GA .h/.cpp, manifest, README). */
  filesWritten: string[];
  /** Did the PoF module build after the write? */
  buildOk: boolean;
  /** Did `seed_generated_abilities.py` run headless? */
  seedRan: boolean;
  /** Rows the seeder saved into DT_GeneratedAbilities (null = not reported). */
  dataTableRows: number | null;
  /** Tags referenced but not declared in ARPGGameplayTags.h. */
  missingTags: string[];
  /** Why it is `failed` (Rule 4 — a failure always reports its reason). */
  reason?: string;
  /** ISO timestamp the report was accepted. */
  reportedAt: string;
}

/** Per-entity enriched GAS authoring spec — drives the rich editors (B2) + C++ codegen (B3). */
export interface EnrichedAbilitySpec {
  catalogId: string;
  entityId: string;
  effects: EditorEffect[];
  tagRules: TagRule[];
  updatedAt?: string;
  /** Optional adoption provenance (present when adopted from the forge). */
  provenance?: SpecProvenance;
  /** Optional codegen provenance (present once a generate-gas-effects run reported back). */
  codegen?: CodegenReport;
}

/** The thin fields `deriveDefaultSpec` needs from a SpellbookAbility. */
export interface AbilityLike {
  id: string;
  element?: string;
  color?: string;
  damage?: number;
  cooldown?: number;
  tag?: string;
}

/**
 * Seed a starter spec from the thin ability so the B2 editors are never empty:
 * one element-themed instant effect (Health −damage) carrying the cooldown, plus
 * the standard "can't act while incapacitated" activation blocks. Pure.
 */
export function deriveDefaultSpec(catalogId: string, ability: AbilityLike): EnrichedAbilitySpec {
  const tag = ability.tag ?? 'Ability';
  const effects: EditorEffect[] = [{
    id: `${ability.id}-primary`,
    name: ability.element ? `${ability.element} Strike` : 'Effect',
    duration: 'instant',
    durationSec: 0,
    cooldownSec: ability.cooldown ?? 0,
    color: ability.color ?? STATUS_NEUTRAL,
    modifiers: [{ attribute: 'Health', operation: 'add', magnitude: ability.damage ? -ability.damage : 0 }],
    grantedTags: [],
  }];
  const tagRules: TagRule[] = [
    { id: `${ability.id}-block-dead`, sourceTag: tag, targetTag: 'State.Dead', type: 'blocks' },
    { id: `${ability.id}-block-stunned`, sourceTag: tag, targetTag: 'State.Stunned', type: 'blocks' },
  ];
  return { catalogId, entityId: ability.id, effects, tagRules };
}

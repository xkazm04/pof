import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getSpec, upsertSpec } from '@/lib/ability/ability-spec-db';
import type { AttrRelationship, SpecProvenance, SpecWrite } from '@/lib/ability/spec';
import type { EditorAttribute, EditorEffect, TagRule, GASLoadoutSlot } from '@/lib/gas-codegen';

/**
 * Optional slice → write semantics, preserving key ABSENCE vs explicit `null`:
 * absent key → `undefined` (keep the stored slice), `null` → `null` (clear it),
 * an array → replace. Any other value is treated as absent so a malformed body
 * can never destroy a stored slice.
 */
function optionalSlice<T>(body: Record<string, unknown>, key: string): T[] | null | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  if (value === null) return null;
  return Array.isArray(value) ? (value as T[]) : undefined;
}

/** Same absent/null/replace rule for the adoption provenance object. */
function optionalProvenance(body: Record<string, unknown>): SpecProvenance | null | undefined {
  const value = body.provenance;
  if (value === null) return null;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as SpecProvenance) : undefined;
}

/** GET /api/ability-spec?catalogId=spellbook&entityId=off-fire-01 → EnrichedAbilitySpec | null */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const entityId = req.nextUrl.searchParams.get('entityId');
    if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);
    return apiSuccess(getSpec(catalogId, entityId));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Ability-spec GET failed', 500);
  }
}

/**
 * POST /api/ability-spec → slice-merge upsert
 * { catalogId, entityId, effects, tagRules, attributes?, relationships?, loadout?, provenance? }
 *
 * effects/tagRules replace. Each optional slice: absent = keep the stored one,
 * `null` = clear it, value = replace (see `mergeSpecWrite`). Absent keys are
 * left OFF the write so upsertSpec can tell them from an explicit null.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') return apiError('JSON object body required', 400);
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId : '';
    if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);
    if (!Array.isArray(body.effects) || !Array.isArray(body.tagRules)) {
      return apiError('effects and tagRules (arrays) are required', 400);
    }
    const write: SpecWrite = {
      catalogId,
      entityId,
      effects: body.effects as EditorEffect[],
      tagRules: body.tagRules as TagRule[],
    };
    // The three additive editor slices (AttributeSet.h / GameplayTags.h inputs)
    // + the optional adoption provenance (raw forged C++ + prompt).
    const attributes = optionalSlice<EditorAttribute>(body, 'attributes');
    const relationships = optionalSlice<AttrRelationship>(body, 'relationships');
    const loadout = optionalSlice<GASLoadoutSlot>(body, 'loadout');
    const provenance = optionalProvenance(body);
    if (attributes !== undefined) write.attributes = attributes;
    if (relationships !== undefined) write.relationships = relationships;
    if (loadout !== undefined) write.loadout = loadout;
    if (provenance !== undefined) write.provenance = provenance;
    return apiSuccess(upsertSpec(write));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Ability-spec POST failed', 500);
  }
}

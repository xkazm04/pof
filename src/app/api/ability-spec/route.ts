import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getSpec, upsertSpec } from '@/lib/ability/ability-spec-db';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import type { EditorEffect, TagRule } from '@/lib/gas-codegen';

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

/** POST /api/ability-spec { catalogId, entityId, effects, tagRules } → upsert */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId : '';
    if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);
    if (!Array.isArray(body.effects) || !Array.isArray(body.tagRules)) {
      return apiError('effects and tagRules (arrays) are required', 400);
    }
    const record: EnrichedAbilitySpec = {
      catalogId,
      entityId,
      effects: body.effects as EditorEffect[],
      tagRules: body.tagRules as TagRule[],
    };
    return apiSuccess(upsertSpec(record));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Ability-spec POST failed', 500);
  }
}

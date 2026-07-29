import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listSpecs } from '@/lib/ability/ability-spec-db';
import { specTagReferences } from '@/lib/ability/tag-audit';

/**
 * GET /api/ability-spec/tags[?catalogId=spellbook] → string[]
 *
 * The distinct gameplay tags referenced by APP-authored ability specs (tag rules
 * + effect granted tags), normalized to the dotted dialect. This is the third
 * source the tag audit ingests — without it the audit only ever compared UE5
 * source against itself and never saw a tag the app authored.
 */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId') ?? undefined;
    return apiSuccess(specTagReferences(listSpecs(catalogId)));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Ability-spec tags GET failed', 500);
  }
}

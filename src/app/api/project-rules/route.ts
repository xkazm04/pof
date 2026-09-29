import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listRules, upsertRule, deleteRule, restoreCanonSeed, canonDrift, adoptShipped, keepMine, undoAdopt } from '@/lib/project-rules-db';
import { requireOperator } from '@/lib/api-auth';
import { ruleUpsertSchema } from '@/lib/catalog/canon/validation';
import { CANON_PROFILES } from '@/lib/catalog/canon/profiles';
import type { ProjectRule } from '@/lib/catalog/canon/types';

/**
 * GET /api/project-rules → ProjectRule[]
 * GET /api/project-rules?view=drift → CanonDrift: every shipped/DB disagreement that needs an
 * operator (unrecorded / conflict / missing / orphaned), grouped by profile → verdict, plus the
 * adopts that can still be undone. Reading it writes nothing.
 */
export async function GET(req?: NextRequest) {
  try {
    if (req?.nextUrl.searchParams.get('view') === 'drift') return apiSuccess(canonDrift());
    return apiSuccess(listRules());
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'project-rules GET failed', 500);
  }
}

/**
 * POST /api/project-rules — upsert a rule.
 *
 * POST /api/project-rules?action=restore-defaults re-writes the shipped canon.
 * That is the ONLY path that puts `CANON_SEED` back: emptying the table no longer
 * resurrects it, so restoring has to be something the caller asked for by name.
 * The body is ignored for this action.
 *
 * Canon drift review — `{ ids: string[] }`, behind requireOperator (they overwrite rows in bulk):
 * - ?action=adopt-shipped  write the shipped rule over each row (the replaced row is archived first)
 * - ?action=keep-mine      keep each row's text; it asks again only when the shipped text moves again
 * - ?action=undo-adopt     restore each archived row exactly as it was before its adopt
 */
export async function POST(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action');
    if (action === 'restore-defaults') {
      return apiSuccess(restoreCanonSeed());
    }
    const review = action ? DRIFT_ACTIONS[action] : undefined;
    if (review) {
      const denied = requireOperator(req);
      if (denied) return denied;
      const ids = ((await req.json().catch(() => null)) as { ids?: unknown } | null)?.ids;
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) return apiError('ids: string[] is required', 400);
      return apiSuccess(review(ids));
    }
    if (action) return apiError(`Unknown action "${action}"`, 400);
    const body = await req.json();
    const parsed = ruleUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid rule', 400, parsed.error.issues);
    }
    if (parsed.data.profile && !CANON_PROFILES[parsed.data.profile]) {
      return apiError(`Unknown canon profile "${parsed.data.profile}" — registered: ${Object.keys(CANON_PROFILES).join(', ')}`, 400);
    }
    const rule: ProjectRule = {
      id: parsed.data.id,
      category: parsed.data.category,
      scope: parsed.data.scope,
      title: parsed.data.title,
      body: parsed.data.body,
      refs: parsed.data.refs,
      // Carried explicitly: dropping it here would move an edited Diablo rule back into PoF's world.
      ...(parsed.data.profile ? { profile: parsed.data.profile } : {}),
    };
    return apiSuccess(upsertRule(rule));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'project-rules POST failed', 500);
  }
}

const DRIFT_ACTIONS: Record<string, (ids: string[]) => unknown> = {
  'adopt-shipped': adoptShipped,
  'keep-mine': keepMine,
  'undo-adopt': undoAdopt,
};

/**
 * DELETE /api/project-rules?id=<id>
 *
 * Deleting the last rule leaves the canon EMPTY and keeps it that way — it used to
 * report success and then hand the full seed back on the next read.
 */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return apiError('id is required', 400);
    deleteRule(id);
    return apiSuccess({ id });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'project-rules DELETE failed', 500);
  }
}

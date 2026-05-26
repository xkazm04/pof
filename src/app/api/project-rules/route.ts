import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listRules, upsertRule, deleteRule } from '@/lib/project-rules-db';
import { ruleUpsertSchema } from '@/lib/catalog/canon/validation';
import type { ProjectRule } from '@/lib/catalog/canon/types';

/** GET /api/project-rules → ProjectRule[] */
export async function GET() {
  try {
    return apiSuccess(listRules());
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'project-rules GET failed', 500);
  }
}

/** POST /api/project-rules — upsert a rule */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ruleUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid rule', 400, parsed.error.issues);
    }
    const rule: ProjectRule = {
      id: parsed.data.id,
      category: parsed.data.category,
      scope: parsed.data.scope,
      title: parsed.data.title,
      body: parsed.data.body,
      refs: parsed.data.refs,
    };
    return apiSuccess(upsertRule(rule));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'project-rules POST failed', 500);
  }
}

/** DELETE /api/project-rules?id=<id> */
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

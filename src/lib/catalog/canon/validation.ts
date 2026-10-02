import { z } from 'zod';
import type { Result } from '@/types/result';
import { CANON_PROFILES } from './profiles';

export const ruleUpsertSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['art', 'game', 'project']),
  scope: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  refs: z.array(z.string()).default([]),
  /** Canon profile (`canon/profiles.ts`); absent = PoF's own. */
  profile: z.string().min(1).optional(),
});
export type RuleUpsert = z.infer<typeof ruleUpsertSchema>;

/** `global`, or a catalog id with a registered pipeline — the only scopes `selectRules` can match. */
export function scopeIsKnown(scope: string, pipelines: readonly { catalogId: string }[]): boolean {
  return scope === 'global' || pipelines.some((p) => p.catalogId === scope);
}

/**
 * The ONE check a canon law passes before it is stored — the editor runs it before POSTing and
 * the route runs it on every upsert. `pipelines` is the pipeline registry (`allCatalogPipelines()`,
 * which the caller must have populated): a scope outside it reaches no prompt, so it is refused
 * rather than stored as a law nothing ever cites.
 */
export function validateRuleDraft(draft: unknown, pipelines: readonly { catalogId: string }[]): Result<RuleUpsert, string> {
  const parsed = ruleUpsertSchema.safeParse(draft);
  if (!parsed.success) {
    const why = parsed.error.issues.map((i) => `${i.path.join('.') || 'rule'}: ${i.message}`).join('; ');
    return { ok: false, error: `Invalid rule — ${why}` };
  }
  const rule = parsed.data;
  if (rule.profile && !CANON_PROFILES[rule.profile]) {
    return { ok: false, error: `Unknown canon profile "${rule.profile}" — registered: ${Object.keys(CANON_PROFILES).join(', ')}` };
  }
  if (!scopeIsKnown(rule.scope, pipelines)) {
    return { ok: false, error: `Unknown scope "${rule.scope}" — use "global" or a registered catalog id; a law with this scope would enter no prompt` };
  }
  return { ok: true, data: rule };
}

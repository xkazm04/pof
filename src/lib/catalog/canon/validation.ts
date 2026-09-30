import { z } from 'zod';

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

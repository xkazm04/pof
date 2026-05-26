import { z } from 'zod';

export const ruleUpsertSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['art', 'game', 'project']),
  scope: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  refs: z.array(z.string()).default([]),
});
export type RuleUpsert = z.infer<typeof ruleUpsertSchema>;

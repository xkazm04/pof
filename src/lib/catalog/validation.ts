import { z } from 'zod';

export const lifecycleStateSchema = z.enum([
  'planned', 'scaffolded', 'generated', 'wired', 'verified', 'failed',
]);

export const testResultSchema = z.enum(['pass', 'fail']);

/**
 * The fields a generation @@CALLBACK posts back (model-supplied only — the
 * trusted catalogId/entityId/step arrive via the callback's staticFields).
 */
export const generationCallbackSchema = z.object({
  ueAssets: z.array(z.string()).default([]),
  testResult: testResultSchema.optional(),
  error: z.string().optional(),
});

export type GenerationCallbackPayload = z.infer<typeof generationCallbackSchema>;

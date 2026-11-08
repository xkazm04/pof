import { z } from 'zod';
import { LIFECYCLE_STATES } from '@/lib/catalog/types';

export const lifecycleStateSchema = z.enum(LIFECYCLE_STATES);

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

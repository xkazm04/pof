import { z } from 'zod';

export const artifactUpsertSchema = z.object({
  catalogId: z.string().min(1),
  entityId: z.string().min(1),
  step: z.string().min(1),
  data: z.record(z.string(), z.unknown()).default({}),
  ueAssets: z.array(z.string()).default([]),
  status: z.enum(['pass', 'pending', 'fail', 'deferred']),
  tier: z.enum(['L0', 'L1', 'L2', 'L3', 'L4']).optional(),
  reason: z.string().optional(),
});

export type ArtifactUpsert = z.infer<typeof artifactUpsertSchema>;

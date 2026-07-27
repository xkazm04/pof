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
  /**
   * The quality-pack version this artifact was produced under. Additive and optional —
   * old clients omit it and the route stamps the pack version in effect at write time.
   * Recorded as `data._provenance.promptVersion`, which is the join key judge-fitness
   * aggregates verdict scores on.
   */
  promptVersion: z.string().min(1).optional(),
});

export type ArtifactUpsert = z.infer<typeof artifactUpsertSchema>;

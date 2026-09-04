import { z } from 'zod';
import { CLIENT_DECLARABLE_ENGINES } from '@/lib/provenance';

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
  /**
   * Who produced this artifact, DECLARED by the client — recorded as
   * `data._provenance.engine`. Restricted to {@link CLIENT_DECLARABLE_ENGINES}: a client
   * may only assert about itself (`Code` = a deterministic produce body in this app).
   * `Claude` / `Leonardo` / `Tripo` / `ElevenLabs` assert that a remote engine RAN and are
   * refused here — only the server that ran the dispatch may stamp those (see
   * `POST /api/one-shot/step`). Absent → the route resolves the engine from the payload,
   * degrading to `unknown` rather than guessing.
   */
  engine: z.enum(CLIENT_DECLARABLE_ENGINES).optional(),
});

export type ArtifactUpsert = z.infer<typeof artifactUpsertSchema>;

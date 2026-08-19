/**
 * The Asset Forge status contract — the ONE place the poll payload's shape is
 * declared, so the route's projection and the client's consumption cannot drift.
 *
 * Why this file exists: the 3D lib layer computes an unusually honest set of
 * signals (`accepted`, `gateReason`, `attempts`, `formatMismatch`, an errored
 * critique) and the client used to type the response as five fields and discard
 * the rest — so a job that finished `done` with `accepted: false` rendered as a
 * green "Complete". The lie was introduced client-side, after the server got it
 * right. Everything here is PURE and shared by both sides.
 */
import type { CritiqueResult, MeshMetrics, Scorecard } from '@/lib/visual-gen/mesh-critique';
import { ASSET_DIRS, assetUrl } from '@/lib/visual-gen/generated-assets';

/**
 * The critique metrics the UI actually reads. `componentFaces` (up to 4096
 * numbers, a gate INPUT never rendered) is deliberately absent: it was shipped
 * on every 5 s poll and read by nothing.
 */
export type ForgeMeshMetrics = Omit<MeshMetrics, 'componentFaces'>;

/**
 * A critique as the client sees it. Explicitly discriminated: a critique that
 * FAILED TO RUN is `{ ok: false, error }`, not an object whose fields happen to
 * be undefined. The old projection emitted `{}` for an errored critique — truthy,
 * so the badge rendered, and `VERDICT[undefined].cls` threw into the module error
 * boundary. A missing verdict is now a stated outcome, not a crash.
 */
export type ForgeCritique =
  | { ok: true; verdict: Scorecard['verdict']; score: number; reasons: string[]; metrics?: ForgeMeshMetrics }
  | { ok: false; error: string };

/** Exactly what GET /api/visual-gen/generate/status returns. */
export interface ForgeStatusResponse {
  status: string;
  meshPath?: string;
  verts?: number;
  faces?: number;
  previewPath?: string;
  device?: string;
  vramGb?: number;
  durationMs?: number;
  /** The provider's own render of the mesh (cloud Tripo only) — an IMAGE url. */
  renderUrl?: string;
  /** Set when the delivered container does not match the extension it was written to. */
  formatMismatch?: string;
  critique?: ForgeCritique;
  fidelity?: number;
  /** Paid generations spent on this job. */
  attempts?: number;
  /** Whether the DELIVERED mesh cleared the Tier-1 gate. Orthogonal to `status`. */
  accepted?: boolean;
  /** Why the regeneration loop stopped — the reason behind `accepted: false`. */
  gateReason?: string;
  error?: string;
}

/**
 * Project a store-side `CritiqueResult` onto the wire shape. Pure.
 *
 * The three job stores run the Tier-1 gate best-effort, so `critique` can be
 * present and `ok: false` (no `POF_TRIPOSR_ROOT`, no venv python, no markers in
 * the script output). That is a real, reportable outcome — it is projected as
 * such rather than collapsing into an empty object.
 */
export function projectCritique(critique: CritiqueResult | undefined): ForgeCritique | undefined {
  if (!critique) return undefined;
  if (!critique.ok || critique.verdict === undefined) {
    return { ok: false, error: critique.error ?? 'critique produced no verdict' };
  }
  const metrics = critique.metrics;
  let trimmed: ForgeMeshMetrics | undefined;
  if (metrics) {
    // Destructured-and-dropped: the histogram never reaches the wire.
    const { componentFaces: _dropped, ...rest } = metrics;
    void _dropped;
    trimmed = rest;
  }
  return {
    ok: true,
    verdict: critique.verdict,
    score: critique.score ?? 0,
    reasons: critique.reasons ?? [],
    metrics: trimmed,
  };
}

/**
 * What a queue card should SAY about a job. `rejected` is the state the job
 * stores were written to make visible and the queue used to hide: the mesh was
 * produced and handed over (`status: completed`) but never cleared the gate
 * (`accepted: false`). Reporting the transport status alone renders that green.
 * Pure.
 */
export type ForgeOutcome = 'pending' | 'generating' | 'importing' | 'complete' | 'rejected' | 'failed';

export function jobOutcome(job: { status: string; accepted?: boolean }): ForgeOutcome {
  if (job.status === 'completed') return job.accepted === false ? 'rejected' : 'complete';
  if (job.status === 'failed') return 'failed';
  if (job.status === 'generating' || job.status === 'importing' || job.status === 'pending') return job.status;
  return 'pending';
}

/**
 * Directories under `generated/` that `GET /api/visual-gen/asset/:name` can serve.
 *
 * Now DERIVED from the route's own allow-list (`ASSET_DIRS`) rather than restated,
 * so the gap this UI reports cannot drift from the real serving rule: the route was
 * widened from `generated/triposr` alone to every provider dir + mesh-finish, and a
 * hand-maintained copy here would have gone on reporting a gap that no longer exists.
 */
export const SERVED_ASSET_DIRS: readonly string[] = ASSET_DIRS.map((d) => d.dir);

export type MeshPreview =
  | { kind: 'servable'; url: string }
  | { kind: 'gap'; reason: string };

/**
 * Resolve a runner's absolute mesh path to a preview the UI can actually show.
 * Pure, and honest in both directions: a mesh the asset route cannot serve gets a
 * stated reason, never a broken viewer or a silently-absent panel.
 */
export function meshPreview(meshPath: string | undefined): MeshPreview | null {
  if (!meshPath) return null;
  const parts = meshPath.split(/[\\/]/).filter(Boolean);
  const name = parts[parts.length - 1];
  const dir = parts[parts.length - 2];
  if (!name || !/\.(glb|gltf)$/i.test(name)) {
    return { kind: 'gap', reason: `No 3D preview: "${name ?? meshPath}" is not a .glb/.gltf file.` };
  }
  if (!dir || !SERVED_ASSET_DIRS.includes(dir)) {
    return {
      kind: 'gap',
      reason:
        `No 3D preview: /api/visual-gen/asset serves generated/${SERVED_ASSET_DIRS.join(', generated/')} only, ` +
        `and this mesh is at ${meshPath}. The file exists on disk — it just has no serving route yet.`,
    };
  }
  // The URL must NAME the dir for anything but the legacy default, or the preview
  // 404s: basenames repeat across provider dirs, so the route cannot guess.
  return { kind: 'servable', url: assetUrl(name, dir) };
}

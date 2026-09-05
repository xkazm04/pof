/**
 * The verdict axis for a Blender-MCP generation — and the honest reason it is empty.
 *
 * Runner-backed jobs report `accepted` / `ungated` / `gateReason` from the Tier-1 mesh
 * critique. MCP-backed jobs (the Blender bridge) reported NOTHING, so `submitMcpJob`
 * rendered on transport `status` alone and a finished Blender generation read as a plain
 * green "Complete" — indistinguishable, in the same queue, from a runner mesh that had
 * actually passed a gate. That was honest only by accident.
 *
 * WHY THE CRITIQUE CANNOT RUN HERE (measured, not assumed). `critiqueMesh(glbPath)` is
 * path-based: it spawns trimesh over a file on THIS server's disk. Nothing on the MCP
 * path ever puts one there — `create_rodin_job` / `create_hunyuan_job` run at the
 * provider, `poll_*_job_status` returns the provider's own `resultUrl`, and
 * `import_generated_asset` is executed BY the Blender addon, which downloads the mesh
 * into the Blender scene and returns only an `objectName` (see `ImportedObject` — one
 * string, no path). Grading it would mean fetching a provider URL server-side and
 * writing it under `generated/`, i.e. a new download path — outside "server-side critique
 * of the resulting file only", and impossible while there is no resulting file.
 *
 * So this projects the state that IS true: delivered, ungated, with the reason named —
 * through `summarizeGate`/`critiqueUnavailable`, the same functions the local job stores
 * use, so both paths speak ONE vocabulary rather than two descriptions of one situation.
 */
import { critiqueMesh, critiqueUnavailable, summarizeGate, type CritiqueResult } from '@/lib/visual-gen/mesh-critique';
import { fetchMeshForGrading, MCP_ASSET_DIR, type MeshFetchOutcome } from '@/lib/visual-gen/mesh-fetch';
import { assetUrl } from '@/lib/visual-gen/generated-assets';
import type { ForgeGateProjection } from '@/components/modules/visual-gen/asset-forge/forgeJobStatus';
import type { JobStatus } from '@/lib/blender-mcp/types';

/** What is missing, in the operator's terms — not a hedge, a located gap. */
export const MCP_CRITIQUE_UNAVAILABLE_REASON =
  'no mesh file reaches this server on the Blender MCP path (the addon imports the provider\'s asset straight into the Blender scene), and the Tier-1 critique reads a .glb from disk';

/**
 * The gate fields an MCP job reports for a given transport status. Pure.
 *
 * Only a DELIVERY carries a verdict: a pending/processing job has produced nothing to
 * grade, and a failed one produced nothing either — stamping those "ungated" would turn
 * a normal in-flight poll into a standing quality complaint.
 */
export function mcpGateProjection(status: JobStatus): ForgeGateProjection {
  if (status !== 'completed') return {};
  const gate = summarizeGate(critiqueUnavailable(MCP_CRITIQUE_UNAVAILABLE_REASON));
  return { accepted: gate.accepted, ungated: gate.ungated, gateReason: gate.reason };
}

// ── The graded path (wave 29) ────────────────────────────────────────────────
// The header above measured WHY this path could not be graded: there is no file on this
// server's disk. `mesh-fetch.ts` is the one thing that changes that — it downloads the
// provider's `resultUrl` into `generated/mcp/<jobId>.glb` under an explicit host
// allow-list, a mesh content-type check and a stated size cap, and NAMES every refusal.
//
// So this path now has two honest outcomes rather than one:
//  - a file arrived → the Tier-1 critique runs on it and the job reports a real verdict,
//    through the SAME `summarizeGate` the runner stores use (one vocabulary, not two);
//  - nothing arrived → still "delivered, ungated, <reason>" — but the reason is now the
//    SPECIFIC refusal (host not allow-listed, over the cap, HTTP 403…) rather than the
//    blanket structural one, which stays for a job that never had a URL at all (a mesh
//    imported straight into Blender is the explicit non-goal: there is nothing to fetch).

/** What one MCP job knows about itself when the gate is asked. */
export interface McpJobRef {
  jobId: string;
  status: JobStatus;
  /** The provider's own URL, as `poll_*_job_status` reported it. */
  resultUrl?: string;
}

export interface McpGradeDeps {
  fetchMesh?: (url: string, jobId: string) => Promise<MeshFetchOutcome>;
  critique?: (path: string) => Promise<CritiqueResult>;
}

/** The gate axis plus, when one was actually fetched and graded, the servable mesh URL. */
export interface McpGate extends ForgeGateProjection {
  meshUrl?: string;
}

/**
 * One verdict per job, computed once. The forge queue polls this route every few seconds
 * and a paid provider result must not be re-downloaded (or re-critiqued — the critique
 * spawns a python subprocess) on every tick. Cleared per-process only; a restart re-grades
 * from the file already on disk, which `fetchMeshForGrading` reports as cached.
 */
const graded = new Map<string, McpGate>();

/** Test-only: forget every memoised verdict between cases. */
export function __resetMcpGrades(): void { graded.clear(); }

/**
 * The gate fields for one MCP job — grading the delivered mesh when it can be fetched.
 *
 * Only a DELIVERY carries a verdict: a pending/processing/failed job has produced nothing,
 * exactly as in {@link mcpGateProjection}.
 */
export async function mcpGateForJob(job: McpJobRef, deps: McpGradeDeps = {}): Promise<McpGate> {
  if (job.status !== 'completed') return {};
  const memo = graded.get(job.jobId);
  if (memo) return memo;

  // No URL ⇒ the addon imported the asset straight into the Blender scene and nothing ever
  // left it. That is the structural gap the header names, and it is not fetchable.
  if (!job.resultUrl) return mcpGateProjection('completed');

  const fetchMesh = deps.fetchMesh ?? ((url: string, jobId: string) => fetchMeshForGrading(url, jobId));
  const critique = deps.critique ?? ((path: string) => critiqueMesh(path));

  const fetched = await fetchMesh(job.resultUrl, job.jobId);
  if (!fetched.ok) {
    // Delivered, ungated, and the reason is the download's own words.
    const gate = summarizeGate(critiqueUnavailable(fetched.reason));
    const projection: McpGate = { accepted: gate.accepted, ungated: gate.ungated, gateReason: gate.reason };
    graded.set(job.jobId, projection);
    return projection;
  }

  const gate = summarizeGate(await critique(fetched.path));
  const projection: McpGate = {
    accepted: gate.accepted,
    ungated: gate.ungated,
    gateReason: gate.reason,
    meshUrl: assetUrl(fetched.name, MCP_ASSET_DIR),
  };
  graded.set(job.jobId, projection);
  return projection;
}

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
import { critiqueUnavailable, summarizeGate } from '@/lib/visual-gen/mesh-critique';
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

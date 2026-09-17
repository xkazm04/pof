/**
 * The download seam — how a Blender-MCP mesh becomes gradeable at all.
 *
 * MEASURED PROBLEM (see `blender-mcp/mcp-gate.ts`): `critiqueMesh(glbPath)` is path-based
 * over a file on THIS server's disk, and the MCP path never puts one there. The provider
 * jobs run remotely, `poll_*_job_status` returns the provider's own `resultUrl`, and
 * `import_generated_asset` is executed BY the Blender addon, which downloads into the
 * Blender scene and returns only `{ objectName }`. Wave 13 shipped the honest "delivered,
 * ungated, reason named" card. Grading it needs exactly one new thing: a file on disk.
 *
 * This is that file — and it is a TRUST SURFACE, so it is written as a list of refusals:
 *
 *  1. **https only.** A plaintext mesh URL is refused by scheme.
 *  2. **Host allow-list** ({@link MESH_HOST_ALLOWLIST}) — the two providers the MCP path
 *     actually uses (`create_rodin_job` → Hyper3D/Rodin at Deemos; `create_hunyuan_job` →
 *     Tencent Hunyuan; see `PROVIDER_COMMANDS` in `blender-mcp/service.ts`). Matching is
 *     exact-or-subdomain, never a substring, so `deemos.com.evil.io` cannot pass.
 *  3. **Mesh content-type**, with `application/octet-stream` accepted ONLY when the URL
 *     path itself ends `.glb`/`.gltf` (object stores commonly serve a glb as octet-stream;
 *     an HTML error page served as octet-stream would not carry that extension).
 *  4. **A stated size cap** ({@link MESH_FETCH_MAX_BYTES}) checked against
 *     `content-length` first and against the received body second, so an undeclared
 *     length cannot walk past it.
 *  5. **The final URL is re-checked** after the request: a redirect that left the
 *     allow-list is refused and nothing is written.
 *  6. **The filename is derived from the job id**, sanitised to the same shape
 *     `safeAssetName` will later accept — a job id that cannot be a safe basename is
 *     refused rather than escaped.
 *
 * Every refusal returns its reason in words, because the whole point of the exercise is
 * that an ungradeable delivery must SAY what is missing
 * (`game-production/regeneration-vs-repair-economics`).
 *
 * HONESTY NOTE, stated where it matters: the allow-list is derived from the two providers'
 * own domains, NOT from an observed download — no live provider download has happened. If
 * a provider hands back a third-party CDN URL, this refuses it BY NAME with the host
 * printed, so extending the list is a one-line deliberate edit here after an operator has
 * seen the real host. A silently-widened list would be the one failure mode worse than a
 * refused download.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '@/lib/logger';
import { DEFAULT_THRESHOLDS } from './mesh-critique';

/**
 * Hosts a provider mesh may be downloaded from. Exact host or any subdomain of it.
 * Deemos = Hyper3D/Rodin (`create_rodin_job`); Tencent = Hunyuan (`create_hunyuan_job`).
 */
export const MESH_HOST_ALLOWLIST: readonly string[] = [
  'deemos.com',
  'hyper3d.ai',
  'hunyuan.tencent.com',
  'myqcloud.com',
];

/**
 * The size cap for one downloaded mesh: 96 MB. Chosen against what the gate consumes —
 * `critiqueMesh` loads the whole mesh into trimesh in a python subprocess, and the largest
 * `.glb` measured under `generated/` (2026-08-20 sweep, 52 files) is an order of magnitude
 * under this. A provider result bigger than this is refused rather than paged in.
 */
export const MESH_FETCH_MAX_BYTES = 96 * 1024 * 1024;

/**
 * How far past the grader's own decimation line a delivery may sit and still be worth
 * loading at all. The grader warns above {@link DEFAULT_THRESHOLDS}.`maxFacesWarn`
 * ("needs decimation for game use"); a pre-retopology source mesh legitimately arrives
 * far denser than that, and the densest real one under `generated/` (2026-09-17 sweep,
 * 60 files) declares 1,492,072 triangles. This headroom clears that with room and is
 * stated here rather than folded into a byte figure, because it is a claim about the
 * grader, not about the wire.
 */
export const MESH_ADMISSION_HEADROOM = 16;

/**
 * The most geometry this door will admit, in the unit the grader is charged in.
 *
 * The byte cap above cannot stand in for this one, and the reason is arithmetic rather
 * than taste: across the 60 real `.glb` files in this tree, bytes per triangle ranges
 * from 18.6 to 640.5 — a 34x spread — and a 615 KB hilt declares 30,700 triangles while
 * a 3.1 MB bust declares 4,867. Bytes do not even ORDER deliveries by the cost they
 * impose. At the densest observed ratio the 96 MB cap admits 5.4M triangles, and a
 * container may declare geometry it does not carry at all: a 200-byte JSON chunk can
 * announce a hundred million triangles and clear the byte cap by five orders of
 * magnitude. So the door reads the declared dimension too.
 */
export const MESH_FETCH_MAX_TRIANGLES = DEFAULT_THRESHOLDS.maxFacesWarn * MESH_ADMISSION_HEADROOM;

/** Primitive modes that produce triangles (TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN). */
const TRIANGLE_MODES = new Set([4, 5, 6]);

/**
 * Triangles the container DECLARES, or null when the body is not a readable glTF binary.
 *
 * Null is "unmeasured", never "compliant" — a `.gltf` JSON delivery, a future container
 * revision and a corrupt body all land here, and the caller admits them on the byte cap
 * alone while saying so. Three disciplines, each one a failure this would otherwise have:
 *
 *  - **The JSON chunk is bounded by the body already read**, so a header declaring a
 *    chunk longer than the file cannot make this read past the buffer. A declared length
 *    is a hint here exactly as `content-length` is a hint upstream.
 *  - **The running total is compared, never completed.** Counts come from the request, so
 *    summing first and comparing second lets a sum leave exact-integer range before the
 *    comparison happens; the loop stops the moment the total passes the budget, and a
 *    count that is not a safe non-negative integer aborts the read rather than being
 *    coerced.
 *  - **Triangles are derived by DIVISION**, not by multiplying a count back up: an index
 *    count divided by three cannot exceed the count it came from, so the derivation
 *    cannot grow into the headroom the budget was supposed to withhold.
 */
export function declaredGlbTriangles(buf: Uint8Array): number | null {
  if (buf.byteLength < 20) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) return null; // 'glTF'
  const jsonLen = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== 0x4e4f534a) return null; // 'JSON'
  if (jsonLen > buf.byteLength - 20) return null;
  let doc: { accessors?: { count?: unknown }[]; meshes?: { primitives?: { mode?: unknown; indices?: unknown; attributes?: { POSITION?: unknown } }[] }[] };
  try {
    doc = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + jsonLen)));
  } catch {
    return null;
  }
  const accessors = Array.isArray(doc.accessors) ? doc.accessors : [];
  const elements = (i: unknown): number | null => {
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= accessors.length) return null;
    const c = accessors[i]?.count;
    if (typeof c !== 'number' || !Number.isSafeInteger(c) || c < 0) return null;
    return c;
  };
  let total = 0;
  for (const mesh of Array.isArray(doc.meshes) ? doc.meshes : []) {
    for (const prim of Array.isArray(mesh.primitives) ? mesh.primitives : []) {
      const mode = typeof prim.mode === 'number' ? prim.mode : 4;
      if (!TRIANGLE_MODES.has(mode)) continue;
      const n = elements(prim.indices !== undefined ? prim.indices : prim.attributes?.POSITION);
      if (n === null) return Number.POSITIVE_INFINITY; // a count we cannot read is not a small one
      total += mode === 4 ? Math.floor(n / 3) : Math.max(0, n - 2);
      if (total > MESH_FETCH_MAX_TRIANGLES) return total;
    }
  }
  return total;
}

/** The dir every fetched provider mesh lands in, under the repo's `generated/` root. */
export const MCP_ASSET_DIR = 'mcp';

/** Content types accepted outright (an octet-stream needs the extension too — see the header). */
const MESH_CONTENT_TYPES = ['model/gltf-binary', 'model/gltf+json'];

/** Exact-or-subdomain membership of {@link MESH_HOST_ALLOWLIST}. Pure. */
export function meshHostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return MESH_HOST_ALLOWLIST.some((a) => h === a || h.endsWith(`.${a}`));
}

/** `<jobId>.glb|.gltf`, or null when the job id cannot be a safe basename. Pure. */
export function meshFileNameFor(jobId: string, url: string): string | null {
  const ext = /\.gltf(\?|$)/i.test(url) ? 'gltf' : 'glb';
  const base = jobId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(base)) return null;
  return `${base}.${ext}`;
}

export type MeshFetchOutcome =
  | {
    ok: true; path: string; name: string; bytes: number; cached?: boolean;
    /**
     * Triangles the container declared at admission, when it was readable. Absent
     * means unmeasured, not small: the grader measures what it actually loads, and
     * a delivery whose measurement exceeds this declaration lied at the door.
     */
    declaredTriangles?: number;
  }
  | { ok: false; reason: string };

export interface MeshFetchDeps {
  fetchFn?: typeof fetch;
  writeFile?: (path: string, data: Uint8Array) => void;
  mkdir?: (dir: string) => void;
  fileExists?: (path: string) => boolean;
  /** Where the file lands (default `<cwd>/generated/mcp`). */
  outDir?: string;
}

/**
 * Download one provider `resultUrl` into `generated/mcp/<jobId>.glb` so the Tier-1 gate
 * has something to read — or refuse, by name.
 *
 * `jobId` is a parameter rather than something parsed out of the URL: the file must be
 * addressable by the job the queue is showing, and a provider URL carries no id we own.
 */
export async function fetchMeshForGrading(
  resultUrl: string,
  jobId: string,
  deps: MeshFetchDeps = {},
): Promise<MeshFetchOutcome> {
  const doFetch = deps.fetchFn ?? fetch;
  const write = deps.writeFile ?? ((p: string, d: Uint8Array) => writeFileSync(p, d));
  const mkdir = deps.mkdir ?? ((d: string) => { mkdirSync(d, { recursive: true }); });
  const exists = deps.fileExists ?? existsSync;
  const outDir = deps.outDir ?? join(process.cwd(), 'generated', MCP_ASSET_DIR);

  let parsed: URL;
  try {
    parsed = new URL(resultUrl);
  } catch {
    return { ok: false, reason: `refused: "${resultUrl}" is not a URL` };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: `refused: ${parsed.protocol}// is not https — a provider mesh is only fetched over https` };
  }
  if (!meshHostAllowed(parsed.hostname)) {
    return {
      ok: false,
      reason: `refused: ${parsed.hostname} is not on the provider allow-list (${MESH_HOST_ALLOWLIST.join(', ')})`,
    };
  }
  const name = meshFileNameFor(jobId, parsed.pathname);
  if (!name) return { ok: false, reason: `refused: job id "${jobId}" cannot be a safe file name` };

  const path = join(outDir, name);
  // Already downloaded (the queue polls every few seconds) — never re-pull a paid result.
  if (exists(path)) return { ok: true, path, name, bytes: 0, cached: true };

  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await doFetch(resultUrl);
  } catch (e) {
    return { ok: false, reason: `refused: the download failed — ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!res.ok) return { ok: false, reason: `refused: the provider answered HTTP ${res.status}` };

  // A redirect may have left the allow-list; the final URL is the one that matters.
  const finalHost = (() => { try { return new URL(res.url).hostname; } catch { return parsed.hostname; } })();
  if (!meshHostAllowed(finalHost)) {
    return { ok: false, reason: `refused: the download followed a redirect to ${finalHost}, which is not on the provider allow-list` };
  }

  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const extLooksMesh = /\.(glb|gltf)$/i.test(parsed.pathname);
  const typeOk = MESH_CONTENT_TYPES.includes(type) || (type === 'application/octet-stream' && extLooksMesh);
  if (!typeOk) {
    return { ok: false, reason: `refused: content-type "${type || 'none'}" is not a mesh type (expected ${MESH_CONTENT_TYPES.join(' / ')}, or application/octet-stream on a .glb/.gltf URL)` };
  }

  const declared = Number(res.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > MESH_FETCH_MAX_BYTES) {
    return { ok: false, reason: `refused: the provider declared ${declared} bytes, over the ${MESH_FETCH_MAX_BYTES}-byte cap` };
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) return { ok: false, reason: 'refused: the provider returned an empty body' };
  if (buf.byteLength > MESH_FETCH_MAX_BYTES) {
    return { ok: false, reason: `refused: the body is ${buf.byteLength} bytes, over the ${MESH_FETCH_MAX_BYTES}-byte cap` };
  }

  // The byte caps above bound the WIRE; the grader is charged in triangles, and a
  // container declares its own. An arrival past the whole admission budget can never be
  // graded no matter how idle this server is, so it is refused here rather than written
  // and handed to a python subprocess that will load all of it.
  const tri = declaredGlbTriangles(buf);
  if (tri !== null && tri > MESH_FETCH_MAX_TRIANGLES) {
    return {
      ok: false,
      reason: `refused: the container declares ${Number.isFinite(tri) ? tri : 'an unreadable number of'} triangles, `
        + `over the ${MESH_FETCH_MAX_TRIANGLES}-triangle admission budget — `
        + `${buf.byteLength} bytes cleared the ${MESH_FETCH_MAX_BYTES}-byte cap, which cannot see geometry`,
    };
  }

  try {
    mkdir(outDir);
    write(path, buf);
  } catch (e) {
    return { ok: false, reason: `refused: could not write ${path} — ${e instanceof Error ? e.message : String(e)}` };
  }
  logger.info(
    `[mesh-fetch] ${jobId}: ${buf.byteLength} bytes from ${finalHost} → ${path}`
    + (tri === null ? ' (declared geometry unmeasured — not a readable glTF binary)' : ` (declares ${tri} triangles)`),
  );
  return { ok: true, path, name, bytes: buf.byteLength, ...(tri === null ? {} : { declaredTriangles: tri }) };
}
